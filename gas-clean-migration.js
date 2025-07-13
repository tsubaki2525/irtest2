// ダッシュボードシートのH列ドライブリンクをSupabaseに変換（クリーン版）

/**
 * 設定値
 */
const DASHBOARD_MIGRATION_CONFIG = {
  SHEET_NAME: "ダッシュボード",
  SUPABASE_URL: "YOUR_SUPABASE_URL", // ← ここに入力
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY", // ← ここに入力

  // 列設定
  COMPANY_COLUMN: "B", // 会社名
  CODE_COLUMN: "C", // 証券コード
  TIMESTAMP_COLUMN: "D", // 開示時刻
  CATEGORY_COLUMN: "E", // 種別
  TITLE_COLUMN: "F", // タイトル
  SAVED_PDF_COLUMN: "H", // 保存PDF（ドライブリンク）
}

// Declare SpreadsheetApp, DriveApp, and UrlFetchApp
const SpreadsheetApp = SpreadsheetApp
const DriveApp = DriveApp
const UrlFetchApp = UrlFetchApp

/**
 * 設定確認
 */
function checkSettings() {
  try {
    console.log("=== 設定確認 ===")
    console.log(`Supabase URL: ${DASHBOARD_MIGRATION_CONFIG.SUPABASE_URL}`)
    console.log(`Supabase Key: ${DASHBOARD_MIGRATION_CONFIG.SUPABASE_ANON_KEY ? "設定済み" : "未設定"}`)

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(DASHBOARD_MIGRATION_CONFIG.SHEET_NAME)

    if (!sheet) {
      console.error(`シート「${DASHBOARD_MIGRATION_CONFIG.SHEET_NAME}」が見つかりません`)
      return
    }

    console.log("=== 列データ確認 ===")
    console.log(`B列 会社名: ${sheet.getRange("B2").getValue()}`)
    console.log(`C列 証券コード: ${sheet.getRange("C2").getValue()}`)
    console.log(`F列 タイトル: ${sheet.getRange("F2").getValue()}`)
    console.log(`H列 保存PDF: ${sheet.getRange("H2").getValue()}`)

    console.log("✅ 設定確認完了")
  } catch (error) {
    console.error("設定確認エラー:", error)
  }
}

/**
 * テスト実行（1行のみ）
 */
function testMigration() {
  try {
    console.log("=== テスト実行開始 ===")

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(DASHBOARD_MIGRATION_CONFIG.SHEET_NAME)

    if (!sheet) {
      console.error("シートが見つかりません")
      return
    }

    const result = processSingleRow(sheet, 2)
    console.log("テスト結果:", result)
  } catch (error) {
    console.error("テストエラー:", error)
  }
}

/**
 * 1行を処理
 */
function processSingleRow(sheet, rowNumber) {
  try {
    const company = sheet.getRange(`${DASHBOARD_MIGRATION_CONFIG.COMPANY_COLUMN}${rowNumber}`).getValue()
    const code = sheet.getRange(`${DASHBOARD_MIGRATION_CONFIG.CODE_COLUMN}${rowNumber}`).getValue()
    const timestamp = sheet.getRange(`${DASHBOARD_MIGRATION_CONFIG.TIMESTAMP_COLUMN}${rowNumber}`).getValue()
    const category = sheet.getRange(`${DASHBOARD_MIGRATION_CONFIG.CATEGORY_COLUMN}${rowNumber}`).getValue()
    const title = sheet.getRange(`${DASHBOARD_MIGRATION_CONFIG.TITLE_COLUMN}${rowNumber}`).getValue()
    const savedPdf = sheet.getRange(`${DASHBOARD_MIGRATION_CONFIG.SAVED_PDF_COLUMN}${rowNumber}`).getValue()

    if (!company || !code || !title) {
      return { skip: true, message: "必須データが不足" }
    }

    if (!savedPdf) {
      return { skip: true, message: "H列にドライブリンクなし" }
    }

    const driveFileId = extractDriveFileId(String(savedPdf))
    if (!driveFileId) {
      return { success: false, message: "ドライブファイルIDを抽出できません" }
    }

    console.log(`処理中: ${company} (${code}) - ドライブID: ${driveFileId}`)

    let driveFile
    try {
      driveFile = DriveApp.getFileById(driveFileId)
    } catch (error) {
      return { success: false, message: `ドライブファイル取得エラー: ${error.message}` }
    }

    if (driveFile.getMimeType() !== "application/pdf") {
      return { success: false, message: `PDFファイルではありません: ${driveFile.getMimeType()}` }
    }

    const uploadResult = uploadToSupabase(driveFile, String(code), String(company))
    if (!uploadResult.success) {
      return { success: false, message: `アップロードエラー: ${uploadResult.error}` }
    }

    const disclosureData = {
      company: String(company || "").trim(),
      code: String(code || "").trim(),
      timestamp: formatTimestamp(timestamp),
      category: String(category || "").trim(),
      title: String(title || "").trim(),
      pdf_url: uploadResult.publicUrl,
    }

    const dbResult = saveToDatabase([disclosureData])
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
 * ドライブファイルIDを抽出
 */
function extractDriveFileId(input) {
  if (!input) return null

  const inputStr = String(input).trim()

  if (inputStr.match(/^[a-zA-Z0-9_-]{25,}$/)) {
    return inputStr
  }

  let match = inputStr.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]

  match = inputStr.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (match) return match[1]

  match = inputStr.match(/([a-zA-Z0-9_-]{25,})/)
  if (match) return match[1]

  return null
}

/**
 * Supabaseにアップロード
 */
function uploadToSupabase(driveFile, code, company) {
  try {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")
    const safeName = `${code}_${company.replace(/[^\w]/g, "")}_${timestamp}.pdf`.substring(0, 100)

    const fileBlob = driveFile.getBlob()
    const fileBytes = fileBlob.getBytes()

    console.log(`アップロード: ${safeName} (${fileBytes.length} bytes)`)

    const uploadResponse = UrlFetchApp.fetch(
      `${DASHBOARD_MIGRATION_CONFIG.SUPABASE_URL}/storage/v1/object/pdf-files/${safeName}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DASHBOARD_MIGRATION_CONFIG.SUPABASE_ANON_KEY}`,
          "Content-Type": "application/pdf",
          apikey: DASHBOARD_MIGRATION_CONFIG.SUPABASE_ANON_KEY,
        },
        payload: fileBytes,
      },
    )

    const uploadCode = uploadResponse.getResponseCode()

    if (uploadCode === 200 || uploadCode === 201) {
      const publicUrl = `${DASHBOARD_MIGRATION_CONFIG.SUPABASE_URL}/storage/v1/object/public/pdf-files/${safeName}`
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
 * データベースに保存
 */
function saveToDatabase(dataArray) {
  try {
    const response = UrlFetchApp.fetch(`${DASHBOARD_MIGRATION_CONFIG.SUPABASE_URL}/rest/v1/disclosures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: DASHBOARD_MIGRATION_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${DASHBOARD_MIGRATION_CONFIG.SUPABASE_ANON_KEY}`,
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

// ここで終了！余計な宣言は一切なし！
