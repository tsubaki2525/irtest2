// kabutanドライブリンクをSupabaseパブリックURLに変換

/**
 * 設定値
 */
const KABUTAN_MIGRATION_CONFIG = {
  SHEET_NAME: "適時開示",
  SUPABASE_URL: "YOUR_SUPABASE_URL",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",

  // 列設定（スプレッドシートの構造に合わせて）
  COMPANY_COLUMN: "B", // 会社名
  CODE_COLUMN: "C", // 証券コード
  TIMESTAMP_COLUMN: "D", // 開示時刻
  CATEGORY_COLUMN: "E", // 種別
  TITLE_COLUMN: "F", // タイトル
  KABUTAN_LINK_COLUMN: "G", // kabutanドライブリンク
  SAVED_PDF_COLUMN: "H", // 保存PDF（ここにSupabaseのURLを保存）

  BATCH_SIZE: 5, // kabutanのAPI制限を考慮して少なめに
}

// Declare variables
const SpreadsheetApp = SpreadsheetApp
const DriveApp = DriveApp
const UrlFetchApp = UrlFetchApp
const Utilities = Utilities

/**
 * メイン実行：kabutanリンクをSupabaseに移行
 */
function migrateKabutanToSupabase() {
  try {
    console.log("=== kabutan → Supabase 移行開始 ===")

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(KABUTAN_MIGRATION_CONFIG.SHEET_NAME)

    if (!sheet) {
      console.error("シートが見つかりません")
      return
    }

    const lastRow = sheet.getLastRow()
    console.log(`処理対象行数: ${lastRow - 1}`)

    let successCount = 0
    let errorCount = 0
    let skipCount = 0

    // 行ごとに処理
    for (let row = 2; row <= lastRow; row++) {
      try {
        const result = processKabutanRow(sheet, row)

        if (result.success) {
          successCount++
          console.log(`✅ 行${row}: ${result.message}`)
        } else if (result.skip) {
          skipCount++
          console.log(`⏭️ 行${row}: ${result.message}`)
        } else {
          errorCount++
          console.error(`❌ 行${row}: ${result.message}`)
        }

        // API制限を避けるため長めに待機
        Utilities.sleep(3000)
      } catch (error) {
        errorCount++
        console.error(`❌ 行${row} 例外:`, error)
      }
    }

    console.log("=== 移行完了 ===")
    console.log(`成功: ${successCount}件`)
    console.log(`スキップ: ${skipCount}件`)
    console.log(`エラー: ${errorCount}件`)
  } catch (error) {
    console.error("移行エラー:", error)
  }
}

/**
 * 1行のkabutanリンクを処理
 */
function processKabutanRow(sheet, rowNumber) {
  try {
    // データ取得
    const company = sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.COMPANY_COLUMN}${rowNumber}`).getValue()
    const code = sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.CODE_COLUMN}${rowNumber}`).getValue()
    const timestamp = sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.TIMESTAMP_COLUMN}${rowNumber}`).getValue()
    const category = sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.CATEGORY_COLUMN}${rowNumber}`).getValue()
    const title = sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.TITLE_COLUMN}${rowNumber}`).getValue()
    const kabutanLink = sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.KABUTAN_LINK_COLUMN}${rowNumber}`).getValue()
    const savedPdf = sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.SAVED_PDF_COLUMN}${rowNumber}`).getValue()

    // 必須データチェック
    if (!company || !code || !title) {
      return { skip: true, message: "必須データが不足" }
    }

    // kabutanリンクチェック
    if (!kabutanLink || !String(kabutanLink).includes("kabutan.jp")) {
      return { skip: true, message: "kabutanリンクなし" }
    }

    // 既にSupabaseのURLがある場合はスキップ
    if (savedPdf && String(savedPdf).includes("supabase")) {
      return { skip: true, message: "既にSupabaseに移行済み" }
    }

    // kabutanリンクからドライブファイルIDを抽出
    const driveFileId = extractDriveIdFromKabutanLink(String(kabutanLink))
    if (!driveFileId) {
      return { success: false, message: "ドライブファイルIDを抽出できません" }
    }

    // ドライブファイルを取得
    let driveFile
    try {
      driveFile = DriveApp.getFileById(driveFileId)
    } catch (error) {
      return { success: false, message: `ドライブファイル取得エラー: ${error.message}` }
    }

    // PDFファイルかチェック
    if (driveFile.getMimeType() !== "application/pdf") {
      return { success: false, message: `PDFファイルではありません: ${driveFile.getMimeType()}` }
    }

    // Supabaseにアップロード
    const uploadResult = uploadToSupabaseStorage(driveFile, code, company)
    if (!uploadResult.success) {
      return { success: false, message: `アップロードエラー: ${uploadResult.error}` }
    }

    // H列（保存PDF）にSupabaseのパブリックURLを保存
    sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.SAVED_PDF_COLUMN}${rowNumber}`).setValue(uploadResult.publicUrl)

    // データベースにも保存（オプション）
    const disclosureData = {
      company: String(company).trim(),
      code: String(code).trim(),
      timestamp: formatTimestamp(timestamp),
      category: String(category).trim(),
      title: String(title).trim(),
      pdf_url: uploadResult.publicUrl, // SupabaseのパブリックURL
    }

    const dbResult = sendToSupabase([disclosureData])

    return {
      success: true,
      message: `${company} (${code}) → ${uploadResult.publicUrl}`,
    }
  } catch (error) {
    return { success: false, message: error.toString() }
  }
}

/**
 * kabutanリンクからドライブファイルIDを抽出
 */
function extractDriveIdFromKabutanLink(kabutanUrl) {
  try {
    // kabutanのリンクパターン例:
    // https://kabutan.jp/discl?code=1234&b=d&d=20250101&f=140120250101001234_20250101_001.pdf

    // URLからドライブファイルIDを抽出する複数のパターンを試行
    const patterns = [
      // パターン1: URLパラメータにfile_idがある場合
      /[?&]file_id=([a-zA-Z0-9_-]{25,})/,
      // パターン2: URLパラメータにidがある場合
      /[?&]id=([a-zA-Z0-9_-]{25,})/,
      // パターン3: URLパスにドライブIDが含まれる場合
      /\/([a-zA-Z0-9_-]{25,})\//,
      // パターン4: ドライブの共有リンクが含まれる場合
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    ]

    for (const pattern of patterns) {
      const match = kabutanUrl.match(pattern)
      if (match) {
        return match[1]
      }
    }

    // 直接ファイルIDの場合（25文字以上の英数字）
    const directIdMatch = kabutanUrl.match(/([a-zA-Z0-9_-]{25,})/)
    if (directIdMatch) {
      return directIdMatch[1]
    }

    return null
  } catch (error) {
    console.error("ドライブID抽出エラー:", error)
    return null
  }
}

/**
 * SupabaseストレージにアップロードしてパブリックURLを取得
 */
function uploadToSupabaseStorage(driveFile, code, company) {
  try {
    // ファイル名を生成（証券コード_会社名_タイムスタンプ）
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")
    const safeName = `${code}_${company.replace(/[^\w]/g, "")}_${timestamp}.pdf`.substring(0, 100) // 長すぎる場合は切り詰め

    const fileBlob = driveFile.getBlob()
    const fileBytes = fileBlob.getBytes()

    console.log(`アップロード: ${safeName} (${fileBytes.length} bytes)`)

    // Supabaseストレージにアップロード
    const uploadResponse = UrlFetchApp.fetch(
      `${KABUTAN_MIGRATION_CONFIG.SUPABASE_URL}/storage/v1/object/pdf-files/${safeName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KABUTAN_MIGRATION_CONFIG.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/pdf",
          apikey: KABUTAN_MIGRATION_CONFIG.SUPABASE_ANON_KEY,
        },
        payload: fileBytes,
      },
    )

    const uploadCode = uploadResponse.getResponseCode()

    if (uploadCode === 200 || uploadCode === 201) {
      // パブリックURLを生成
      const publicUrl = `${KABUTAN_MIGRATION_CONFIG.SUPABASE_URL}/storage/v1/object/public/pdf-files/${safeName}`

      return {
        success: true,
        publicUrl: publicUrl,
        fileName: safeName,
      }
    } else {
      return {
        success: false,
        error: `HTTP ${uploadCode}: ${uploadResponse.getContentText()}`,
      }
    }
  } catch (error) {
    return { success: false, error: error.toString() }
  }
}

/**
 * Supabaseデータベースに保存
 */
function sendToSupabase(dataArray) {
  try {
    const response = UrlFetchApp.fetch(`${KABUTAN_MIGRATION_CONFIG.SUPABASE_URL}/rest/v1/disclosures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: KABUTAN_MIGRATION_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${KABUTAN_MIGRATION_CONFIG.SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      payload: JSON.stringify(dataArray),
    })

    if (response.getResponseCode() === 201) {
      return { success: true }
    } else {
      return {
        success: false,
        error: `HTTP ${response.getResponseCode()}: ${response.getContentText()}`,
      }
    }
  } catch (error) {
    return { success: false, error: error.toString() }
  }
}

/**
 * タイムスタンプ変換
 */
function formatTimestamp(timestamp) {
  try {
    if (!timestamp) return new Date().toISOString()
    if (timestamp instanceof Date) return timestamp.toISOString()

    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return new Date().toISOString()

    return date.toISOString()
  } catch (error) {
    return new Date().toISOString()
  }
}

/**
 * テスト用：1行のみ処理
 */
function testKabutanMigration() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(KABUTAN_MIGRATION_CONFIG.SHEET_NAME)

    // 2行目をテスト
    const result = processKabutanRow(sheet, 2)
    console.log("テスト結果:", result)

    // kabutanリンクの確認
    const kabutanLink = sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.KABUTAN_LINK_COLUMN}2`).getValue()
    console.log("kabutanリンク:", kabutanLink)

    const driveId = extractDriveIdFromKabutanLink(String(kabutanLink))
    console.log("抽出されたドライブID:", driveId)
  } catch (error) {
    console.error("テストエラー:", error)
  }
}

/**
 * 列設定確認
 */
function checkKabutanColumns() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(KABUTAN_MIGRATION_CONFIG.SHEET_NAME)

    console.log("=== 列設定確認 ===")
    console.log(
      `会社名 (${KABUTAN_MIGRATION_CONFIG.COMPANY_COLUMN}): ${sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.COMPANY_COLUMN}2`).getValue()}`,
    )
    console.log(
      `証券コード (${KABUTAN_MIGRATION_CONFIG.CODE_COLUMN}): ${sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.CODE_COLUMN}2`).getValue()}`,
    )
    console.log(
      `kabutanリンク (${KABUTAN_MIGRATION_CONFIG.KABUTAN_LINK_COLUMN}): ${sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.KABUTAN_LINK_COLUMN}2`).getValue()}`,
    )
    console.log(
      `保存PDF (${KABUTAN_MIGRATION_CONFIG.SAVED_PDF_COLUMN}): ${sheet.getRange(`${KABUTAN_MIGRATION_CONFIG.SAVED_PDF_COLUMN}2`).getValue()}`,
    )
  } catch (error) {
    console.error("設定確認エラー:", error)
  }
}
