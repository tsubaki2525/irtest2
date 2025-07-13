// 新しいGASプロジェクト用のコード
// Drive APIを使用しない、データ取得専用

/**
 * 設定値
 */
const CONFIG = {
  SHEET_NAME: "適時開示",
  SPREADSHEET_ID: "YOUR_SPREADSHEET_ID_HERE", // 既存のスプレッドシートIDを設定
}

// Declare SpreadsheetApp and ContentService
const SpreadsheetApp = SpreadsheetApp
const ContentService = ContentService

/**
 * Web API用 - 指定したスプレッドシートのB:G列データを返す
 */
function doGet(e) {
  try {
    // スプレッドシートIDを指定して開く
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME)

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ error: "シートが見つかりません" })).setMimeType(
        ContentService.MimeType.JSON,
      )
    }

    const lastRow = sheet.getLastRow()
    if (lastRow <= 1) {
      return ContentService.createTextOutput(JSON.stringify({ data: [] })).setMimeType(ContentService.MimeType.JSON)
    }

    // B:G列のデータを取得
    const dataRows = Math.min(lastRow - 1, 100) // 最大100件
    const data = sheet.getRange(2, 2, dataRows, 6).getValues()

    // 空行をフィルタリング
    const filteredData = data.filter((row) => row[0] && row[1]) // 会社名と証券コードがある行のみ

    // JSONオブジェクトに変換
    const jsonData = filteredData.map((row, index) => ({
      id: index + 1,
      company: row[0] || "", // B列: 会社名
      code: row[1] || "", // C列: 証券コード
      timestamp: row[2] || "", // D列: 開示時刻
      category: row[3] || "", // E列: 種別
      title: row[4] || "", // F列: タイトル
      pdfUrl: row[5] || "", // G列: PDFリンク
    }))

    return ContentService.createTextOutput(
      JSON.stringify({
        data: jsonData,
        total: jsonData.length,
        lastUpdated: new Date().toISOString(),
        status: "success",
      }),
    ).setMimeType(ContentService.MimeType.JSON)
  } catch (error) {
    console.error("API Error:", error)
    return ContentService.createTextOutput(
      JSON.stringify({
        error: error.message,
        status: "error",
      }),
    ).setMimeType(ContentService.MimeType.JSON)
  }
}

/**
 * テスト用関数
 */
function testApi() {
  const result = doGet()
  console.log(result.getContent())
}
