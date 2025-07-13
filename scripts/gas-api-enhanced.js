// 改良版GASプロジェクト用のコード
// より多くのデータを取得可能

/**
 * 設定値
 */
const CONFIG = {
  SHEET_NAME: "適時開示",
  SPREADSHEET_ID: "YOUR_SPREADSHEET_ID_HERE", // 既存のスプレッドシートIDを設定
  MAX_ROWS: 500, // 最大取得件数を500件に増加
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
      return ContentService.createTextOutput(JSON.stringify({ data: [], total: 0 })).setMimeType(
        ContentService.MimeType.JSON,
      )
    }

    // B:G列のデータを取得（制限を大幅に緩和）
    const dataRows = Math.min(lastRow - 1, CONFIG.MAX_ROWS) // 最大500件
    const data = sheet.getRange(2, 2, dataRows, 6).getValues()

    console.log(`取得行数: ${dataRows}, 実際のデータ行数: ${data.length}`)

    // 空行をフィルタリング（より厳密に）
    const filteredData = data.filter((row) => {
      // 会社名と証券コードとタイトルがすべて存在する行のみ
      return (
        row[0] &&
        row[1] &&
        row[4] &&
        String(row[0]).trim() !== "" &&
        String(row[1]).trim() !== "" &&
        String(row[4]).trim() !== ""
      )
    })

    console.log(`フィルタ後のデータ件数: ${filteredData.length}`)

    // JSONオブジェクトに変換
    const jsonData = filteredData.map((row, index) => ({
      id: index + 1,
      company: String(row[0] || "").trim(), // B列: 会社名
      code: String(row[1] || "").trim(), // C列: 証券コード
      timestamp: String(row[2] || "").trim(), // D列: 開示時刻
      category: String(row[3] || "").trim(), // E列: 種別
      title: String(row[4] || "").trim(), // F列: タイトル
      pdfUrl: String(row[5] || "").trim(), // G列: PDFリンク
    }))

    return ContentService.createTextOutput(
      JSON.stringify({
        data: jsonData,
        total: jsonData.length,
        rawDataRows: dataRows,
        actualLastRow: lastRow,
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
 * テスト用関数 - より詳細な情報を表示
 */
function testApiDetailed() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME)

    console.log(`シート名: ${sheet.getName()}`)
    console.log(`最終行: ${sheet.getLastRow()}`)
    console.log(`最終列: ${sheet.getLastColumn()}`)

    const result = doGet()
    const response = JSON.parse(result.getContent())

    console.log(`取得データ件数: ${response.total}`)
    console.log(`生データ行数: ${response.rawDataRows}`)
    console.log(`実際の最終行: ${response.actualLastRow}`)

    // 最初の3件を表示
    if (response.data && response.data.length > 0) {
      console.log("最初の3件:")
      response.data.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.company} (${item.code}) - ${item.title}`)
      })
    }
  } catch (error) {
    console.error("テストエラー:", error)
  }
}

/**
 * シート情報確認用関数
 */
function checkSheetInfo() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME)

    const lastRow = sheet.getLastRow()
    const lastCol = sheet.getLastColumn()

    console.log(`=== シート情報 ===`)
    console.log(`シート名: ${sheet.getName()}`)
    console.log(`最終行: ${lastRow}`)
    console.log(`最終列: ${lastCol}`)
    console.log(`データ範囲: A1:${String.fromCharCode(64 + lastCol)}${lastRow}`)

    // ヘッダー行を確認
    if (lastRow > 0) {
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
      console.log(`ヘッダー: ${headers.join(", ")}`)
    }

    // B:G列の最初の5行を確認
    if (lastRow > 1) {
      const sampleData = sheet.getRange(2, 2, Math.min(5, lastRow - 1), 6).getValues()
      console.log(`=== サンプルデータ (B:G列) ===`)
      sampleData.forEach((row, index) => {
        console.log(`行${index + 2}: [${row.join(", ")}]`)
      })
    }
  } catch (error) {
    console.error("シート情報確認エラー:", error)
  }
}
