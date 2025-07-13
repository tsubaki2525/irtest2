// ダッシュボードシートのH列ドライブリンクをSupabaseに変換

/**
 * 設定値
 */
const DASHBOARD_CONFIG = {
  SHEET_NAME: "ダッシュボード", // シート名を変更
  SUPABASE_URL: "YOUR_SUPABASE_URL",
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY",

  // 列設定（ダッシュボードシートの構造）
  NUMBER_COLUMN: "A", // 番号
  COMPANY_COLUMN: "B", // 会社名
  CODE_COLUMN: "C", // 証券コード
  TIMESTAMP_COLUMN: "D", // 開示時刻
  CATEGORY_COLUMN: "E", // 種別
  TITLE_COLUMN: "F", // タイトル
  PDF_LINK_COLUMN: "G", // PDFリンク
  SAVED_PDF_COLUMN: "H", // 保存PDF（ドライブリンク）
  PDF_TEXT_COLUMN: "I", // PDF全文
  ACQUIRED_TIME_COLUMN: "J", // 取得日時
  SUMMARY_COLUMN: "K", // 要約
  POST_LINK_COLUMN: "L", // ポストリンク
  STATUS_COLUMN: "M", // 状況

  BATCH_SIZE: 5,
}

// Declare variables
const SpreadsheetApp = SpreadsheetApp
const DriveApp = DriveApp
const UrlFetchApp = UrlFetchApp
const Utilities = Utilities

/**
 * メイン実行：ダッシュボードH列をSupabaseに移行
 */
function migrateDashboardToSupabase() {
  try {
    console.log("=== ダッシュボード → Supabase 移行開始 ===")

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(DASHBOARD_CONFIG.SHEET_NAME)

    if (!sheet) {
      console.error("ダッシュボードシートが見つかりません")
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
        const result = processDashboardRow(sheet, row)

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
        Utilities.sleep(2000)
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
 * 1行のダッシュボードデータを処理
 */
function processDashboardRow(sheet, rowNumber) {
  try {
    // 全列のデータを取得
    const number = sheet.getRange(`${DASHBOARD_CONFIG.NUMBER_COLUMN}${rowNumber}`).getValue()
    const company = sheet.getRange(`${DASHBOARD_CONFIG.COMPANY_COLUMN}${rowNumber}`).getValue()
    const code = sheet.getRange(`${DASHBOARD_CONFIG.CODE_COLUMN}${rowNumber}`).getValue()
    const timestamp = sheet.getRange(`${DASHBOARD_CONFIG.TIMESTAMP_COLUMN}${rowNumber}`).getValue()
    const category = sheet.getRange(`${DASHBOARD_CONFIG.CATEGORY_COLUMN}${rowNumber}`).getValue()
    const title = sheet.getRange(`${DASHBOARD_CONFIG.TITLE_COLUMN}${rowNumber}`).getValue()
    const pdfLink = sheet.getRange(`${DASHBOARD_CONFIG.PDF_LINK_COLUMN}${rowNumber}`).getValue()
    const savedPdf = sheet.getRange(`${DASHBOARD_CONFIG.SAVED_PDF_COLUMN}${rowNumber}`).getValue() // H列：ドライブリンク
    const pdfText = sheet.getRange(`${DASHBOARD_CONFIG.PDF_TEXT_COLUMN}${rowNumber}`).getValue()
    const acquiredTime = sheet.getRange(`${DASHBOARD_CONFIG.ACQUIRED_TIME_COLUMN}${rowNumber}`).getValue()
    const summary = sheet.getRange(`${DASHBOARD_CONFIG.SUMMARY_COLUMN}${rowNumber}`).getValue()
    const postLink = sheet.getRange(`${DASHBOARD_CONFIG.POST_LINK_COLUMN}${rowNumber}`).getValue()
    const status = sheet.getRange(`${DASHBOARD_CONFIG.STATUS_COLUMN}${rowNumber}`).getValue()

    // 必須データチェック
    if (!company || !code || !title) {
      return { skip: true, message: "必須データが不足" }
    }

    // H列のドライブリンクチェック
    if (!savedPdf) {
      return { skip: true, message: "H列にドライブリンクなし" }
    }

    // 既にSupabaseに移行済みかチェック（データベースで確認）
    const existingRecord = checkExistingRecord(String(code), String(title))
    if (existingRecord) {
      return { skip: true, message: "既にSupabaseに移行済み" }
    }

    // ドライブファイルIDを抽出
    const driveFileId = extractDriveFileId(String(savedPdf))
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
    const uploadResult = uploadToSupabaseStorage(driveFile, String(code), String(company))
    if (!uploadResult.success) {
      return { success: false, message: `アップロードエラー: ${uploadResult.error}` }
    }

    // Supabaseデータベースに保存（スプレッドシートは更新しない）
    const disclosureData = {
      company: String(company || "").trim(),
      code: String(code || "").trim(),
      timestamp: formatTimestamp(timestamp),
      category: String(category || "").trim(),
      title: String(title || "").trim(),
      pdf_url: uploadResult.publicUrl, // SupabaseのパブリックURL
      // 追加情報も保存
      pdf_text: String(pdfText || "").trim(),
      summary: String(summary || "").trim(),
      post_link: String(postLink || "").trim(),
      status: String(status || "").trim(),
      original_pdf_link: String(pdfLink || "").trim(), // 元のPDFリンク
      acquired_time: acquiredTime ? new Date(acquiredTime).toISOString() : null,
    }

    const dbResult = sendToSupabaseExtended([disclosureData])
    if (!dbResult.success) {
      return { success: false, message: `DB保存エラー: ${dbResult.error}` }
    }

    return {
      success: true,
      message: `${company} (${code}) → Supabase保存完了`,
    }
  } catch (error) {
    return { success: false, message: error.toString() }
  }
}

/**
 * ドライブファイルIDを抽出（改良版）
 */
function extractDriveFileId(input) {
  if (!input) return null

  const inputStr = String(input).trim()

  // パターン1: 直接ファイルID（25文字以上の英数字）
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

  // パターン5: その他のGoogleドライブURL
  match = inputStr.match(/([a-zA-Z0-9_-]{25,})/)
  if (match) return match[1]

  return null
}

/**
 * Supabaseストレージにアップロード
 */
function uploadToSupabaseStorage(driveFile, code, company) {
  try {
    // ファイル名を生成
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")
    const safeName = `${code}_${company.replace(/[^\w]/g, "")}_${timestamp}.pdf`.substring(0, 100)

    const fileBlob = driveFile.getBlob()
    const fileBytes = fileBlob.getBytes()

    console.log(`アップロード: ${safeName} (${fileBytes.length} bytes)`)

    // Supabaseストレージにアップロード
    const uploadResponse = UrlFetchApp.fetch(
      `${DASHBOARD_CONFIG.SUPABASE_URL}/storage/v1/object/pdf-files/${safeName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DASHBOARD_CONFIG.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/pdf",
          apikey: DASHBOARD_CONFIG.SUPABASE_ANON_KEY,
        },
        payload: fileBytes,
      },
    )

    const uploadCode = uploadResponse.getResponseCode()

    if (uploadCode === 200 || uploadCode === 201) {
      const publicUrl = `${DASHBOARD_CONFIG.SUPABASE_URL}/storage/v1/object/public/pdf-files/${safeName}`
      return { success: true, publicUrl: publicUrl, fileName: safeName }
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
 * 拡張データベーステーブルに保存
 */
function sendToSupabaseExtended(dataArray) {
  try {
    const response = UrlFetchApp.fetch(`${DASHBOARD_CONFIG.SUPABASE_URL}/rest/v1/disclosures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: DASHBOARD_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${DASHBOARD_CONFIG.SUPABASE_ANON_KEY}`,
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
 * 既存レコードをチェック
 */
function checkExistingRecord(code, title) {
  try {
    const response = UrlFetchApp.fetch(
      `${DASHBOARD_CONFIG.SUPABASE_URL}/rest/v1/disclosures?code=eq.${code}&title=eq.${encodeURIComponent(title)}&select=id`,
      {
        method: "GET",
        headers: {
          apikey: DASHBOARD_CONFIG.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${DASHBOARD_CONFIG.SUPABASE_ANON_KEY}`,
        },
      },
    )

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText())
      return data.length > 0
    }
    return false
  } catch (error) {
    console.error("既存レコードチェックエラー:", error)
    return false
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
function testDashboardMigration() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(DASHBOARD_CONFIG.SHEET_NAME)

    console.log("=== テスト実行 ===")

    // 2行目をテスト
    const result = processDashboardRow(sheet, 2)
    console.log("テスト結果:", result)

    // H列の内容確認
    const savedPdf = sheet.getRange(`${DASHBOARD_CONFIG.SAVED_PDF_COLUMN}2`).getValue()
    console.log("H列の内容:", savedPdf)

    const driveId = extractDriveFileId(String(savedPdf))
    console.log("抽出されたドライブID:", driveId)
  } catch (error) {
    console.error("テストエラー:", error)
  }
}

/**
 * ダッシュボード列設定確認
 */
function checkDashboardColumns() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(DASHBOARD_CONFIG.SHEET_NAME)

    console.log("=== ダッシュボード列設定確認 ===")
    console.log(`A列 番号: ${sheet.getRange("A2").getValue()}`)
    console.log(`B列 会社名: ${sheet.getRange("B2").getValue()}`)
    console.log(`C列 証券コード: ${sheet.getRange("C2").getValue()}`)
    console.log(`D列 開示時刻: ${sheet.getRange("D2").getValue()}`)
    console.log(`E列 種別: ${sheet.getRange("E2").getValue()}`)
    console.log(`F列 タイトル: ${sheet.getRange("F2").getValue()}`)
    console.log(`G列 PDFリンク: ${sheet.getRange("G2").getValue()}`)
    console.log(`H列 保存PDF: ${sheet.getRange("H2").getValue()}`)
    console.log(`I列 PDF全文: ${sheet.getRange("I2").getValue()}`)
    console.log(`J列 取得日時: ${sheet.getRange("J2").getValue()}`)
    console.log(`K列 要約: ${sheet.getRange("K2").getValue()}`)
    console.log(`L列 ポストリンク: ${sheet.getRange("L2").getValue()}`)
    console.log(`M列 状況: ${sheet.getRange("M2").getValue()}`)
  } catch (error) {
    console.error("設定確認エラー:", error)
  }
}
