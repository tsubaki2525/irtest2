// 適時開示シートの指定列からドライブファイルを自動アップロード

/**
 * 設定値
 */
const DRIVE_MIGRATION_CONFIG = {
  SHEET_NAME: "適時開示",
  SUPABASE_URL: "YOUR_SUPABASE_URL",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",

  // 列設定（アルファベットで指定）
  COMPANY_COLUMN: "B", // 会社名
  CODE_COLUMN: "C", // 証券コード
  TIMESTAMP_COLUMN: "D", // 開示時刻
  CATEGORY_COLUMN: "E", // 種別
  TITLE_COLUMN: "F", // タイトル
  PDF_URL_COLUMN: "G", // 現在のPDF URL
  DRIVE_FILE_COLUMN: "H", // ← ここを指定！ドライブファイルID/URLの列

  BATCH_SIZE: 10, // 一度に処理する件数
}

// Declare variables
const SpreadsheetApp = SpreadsheetApp
const DriveApp = DriveApp
const UrlFetchApp = UrlFetchApp
const Utilities = Utilities

/**
 * メイン実行関数：指定列からドライブファイルを移行
 */
function migrateDriveFromColumn() {
  try {
    console.log("=== ドライブファイル移行開始 ===")

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(DRIVE_MIGRATION_CONFIG.SHEET_NAME)

    if (!sheet) {
      console.error("シートが見つかりません")
      return
    }

    const lastRow = sheet.getLastRow()
    if (lastRow <= 1) {
      console.log("データがありません")
      return
    }

    console.log(`処理対象行数: ${lastRow - 1}`)

    let successCount = 0
    let errorCount = 0
    let skipCount = 0

    // 行ごとに処理
    for (let row = 2; row <= lastRow; row++) {
      try {
        const result = processSingleRow(sheet, row)

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

        // API制限を避けるため待機
        Utilities.sleep(1500)
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
 * 1行を処理
 */
function processSingleRow(sheet, rowNumber) {
  try {
    // 各列のデータを取得
    const company = sheet.getRange(`${DRIVE_MIGRATION_CONFIG.COMPANY_COLUMN}${rowNumber}`).getValue()
    const code = sheet.getRange(`${DRIVE_MIGRATION_CONFIG.CODE_COLUMN}${rowNumber}`).getValue()
    const timestamp = sheet.getRange(`${DRIVE_MIGRATION_CONFIG.TIMESTAMP_COLUMN}${rowNumber}`).getValue()
    const category = sheet.getRange(`${DRIVE_MIGRATION_CONFIG.CATEGORY_COLUMN}${rowNumber}`).getValue()
    const title = sheet.getRange(`${DRIVE_MIGRATION_CONFIG.TITLE_COLUMN}${rowNumber}`).getValue()
    const currentPdfUrl = sheet.getRange(`${DRIVE_MIGRATION_CONFIG.PDF_URL_COLUMN}${rowNumber}`).getValue()
    const driveFileInfo = sheet.getRange(`${DRIVE_MIGRATION_CONFIG.DRIVE_FILE_COLUMN}${rowNumber}`).getValue()

    // 必須データチェック
    if (!company || !code || !title) {
      return { skip: true, message: "必須データが不足" }
    }

    // ドライブファイル情報チェック
    if (!driveFileInfo) {
      return { skip: true, message: "ドライブファイル情報なし" }
    }

    // 既にSupabaseのURLの場合はスキップ
    if (String(currentPdfUrl).includes("supabase")) {
      return { skip: true, message: "既にSupabaseに移行済み" }
    }

    // ドライブファイルIDを抽出
    const fileId = extractDriveFileId(String(driveFileInfo))
    if (!fileId) {
      return { success: false, message: "ドライブファイルIDを抽出できません" }
    }

    // ドライブファイルを取得
    let driveFile
    try {
      driveFile = DriveApp.getFileById(fileId)
    } catch (error) {
      return { success: false, message: `ドライブファイル取得エラー: ${error.message}` }
    }

    // PDFファイルかチェック
    if (driveFile.getMimeType() !== "application/pdf") {
      return { success: false, message: `PDFファイルではありません: ${driveFile.getMimeType()}` }
    }

    // Supabaseにアップロード
    const uploadResult = uploadDriveFileToSupabase(driveFile, code, company)
    if (!uploadResult.success) {
      return { success: false, message: `アップロードエラー: ${uploadResult.error}` }
    }

    // データベースに保存
    const disclosureData = {
      company: String(company).trim(),
      code: String(code).trim(),
      timestamp: formatTimestamp(timestamp),
      category: String(category).trim(),
      title: String(title).trim(),
      pdf_url: uploadResult.url,
    }

    const dbResult = sendToSupabase([disclosureData])
    if (!dbResult.success) {
      return { success: false, message: `DB保存エラー: ${dbResult.error}` }
    }

    // スプレッドシートのPDF URLを更新
    sheet.getRange(`${DRIVE_MIGRATION_CONFIG.PDF_URL_COLUMN}${rowNumber}`).setValue(uploadResult.url)

    return {
      success: true,
      message: `${company} (${code}) - ${driveFile.getName()} → Supabase`,
    }
  } catch (error) {
    return { success: false, message: error.toString() }
  }
}

/**
 * ドライブファイルIDを抽出
 */
function extractDriveFileId(input) {
  if (!input) return null

  const inputStr = String(input).trim()

  // パターン1: 直接ファイルID
  if (inputStr.match(/^[a-zA-Z0-9_-]{25,}$/)) {
    return inputStr
  }

  // パターン2: https://drive.google.com/file/d/FILE_ID/view
  let match = inputStr.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]

  // パターン3: https://drive.google.com/open?id=FILE_ID
  match = inputStr.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return match[1]

  // パターン4: https://docs.google.com/document/d/FILE_ID/
  match = inputStr.match(/\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]

  return null
}

/**
 * ドライブファイルをSupabaseにアップロード（改良版）
 */
function uploadDriveFileToSupabase(driveFile, code, company) {
  try {
    // ファイル名を生成（証券コード_会社名_元ファイル名）
    const originalName = driveFile.getName()
    const safeName = `${code}_${company.replace(/[^\w\s]/g, "")}_${originalName}`.replace(/\s+/g, "_").substring(0, 100) // 長すぎる場合は切り詰め

    const fileBlob = driveFile.getBlob()
    const fileBytes = fileBlob.getBytes()

    console.log(`アップロード: ${safeName} (${fileBytes.length} bytes)`)

    // Supabaseにアップロード
    const uploadResponse = UrlFetchApp.fetch(
      `${DRIVE_MIGRATION_CONFIG.SUPABASE_URL}/storage/v1/object/pdf-files/${safeName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DRIVE_MIGRATION_CONFIG.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/pdf",
          apikey: DRIVE_MIGRATION_CONFIG.SUPABASE_ANON_KEY,
        },
        payload: fileBytes,
      },
    )

    const uploadCode = uploadResponse.getResponseCode()

    if (uploadCode === 200 || uploadCode === 201) {
      const savedUrl = `${DRIVE_MIGRATION_CONFIG.SUPABASE_URL}/storage/v1/object/public/pdf-files/${safeName}`
      return { success: true, url: savedUrl, fileName: safeName }
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
 * Supabaseにデータを送信
 */
function sendToSupabase(dataArray) {
  try {
    const response = UrlFetchApp.fetch(`${DRIVE_MIGRATION_CONFIG.SUPABASE_URL}/rest/v1/disclosures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: DRIVE_MIGRATION_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${DRIVE_MIGRATION_CONFIG.SUPABASE_ANON_KEY}`,
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
 * タイムスタンプをISO形式に変換
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
function testSingleRowMigration() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(DRIVE_MIGRATION_CONFIG.SHEET_NAME)

    // 2行目（最初のデータ行）をテスト
    const result = processSingleRow(sheet, 2)
    console.log("テスト結果:", result)
  } catch (error) {
    console.error("テストエラー:", error)
  }
}

/**
 * 設定確認用
 */
function checkColumnSettings() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(DRIVE_MIGRATION_CONFIG.SHEET_NAME)

    console.log("=== 列設定確認 ===")
    console.log(
      `会社名 (${DRIVE_MIGRATION_CONFIG.COMPANY_COLUMN}): ${sheet.getRange(`${DRIVE_MIGRATION_CONFIG.COMPANY_COLUMN}2`).getValue()}`,
    )
    console.log(
      `証券コード (${DRIVE_MIGRATION_CONFIG.CODE_COLUMN}): ${sheet.getRange(`${DRIVE_MIGRATION_CONFIG.CODE_COLUMN}2`).getValue()}`,
    )
    console.log(
      `タイトル (${DRIVE_MIGRATION_CONFIG.TITLE_COLUMN}): ${sheet.getRange(`${DRIVE_MIGRATION_CONFIG.TITLE_COLUMN}2`).getValue()}`,
    )
    console.log(
      `現在PDF URL (${DRIVE_MIGRATION_CONFIG.PDF_URL_COLUMN}): ${sheet.getRange(`${DRIVE_MIGRATION_CONFIG.PDF_URL_COLUMN}2`).getValue()}`,
    )
    console.log(
      `ドライブファイル (${DRIVE_MIGRATION_CONFIG.DRIVE_FILE_COLUMN}): ${sheet.getRange(`${DRIVE_MIGRATION_CONFIG.DRIVE_FILE_COLUMN}2`).getValue()}`,
    )
  } catch (error) {
    console.error("設定確認エラー:", error)
  }
}
