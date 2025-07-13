// GAS側：スプレッドシートデータをSupabaseに送信

/**
 * 設定値
 */
const CONFIG = {
  SHEET_NAME: "適時開示",
  SUPABASE_URL: "YOUR_SUPABASE_URL", // Supabaseプロジェクトから取得
  SUPABASE_ANON_KEY: "YOUR_SUPABASE_ANON_KEY", // Supabaseプロジェクトから取得
  BATCH_SIZE: 50, // 一度に送信する件数
}

// Declare the variables before using them
const SpreadsheetApp = SpreadsheetApp
const Utilities = Utilities
const UrlFetchApp = UrlFetchApp

/**
 * スプレッドシートデータをSupabaseに移行
 */
function migrateToSupabase() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME)

    if (!sheet) {
      console.error("シートが見つかりません")
      return
    }

    const lastRow = sheet.getLastRow()
    if (lastRow <= 1) {
      console.log("データがありません")
      return
    }

    // 全データを取得
    const data = sheet.getRange(2, 2, lastRow - 1, 6).getValues()
    console.log(`取得データ件数: ${data.length}`)

    // データをクリーニング
    const cleanedData = data
      .filter((row) => {
        return (
          row[0] &&
          row[1] &&
          row[4] &&
          String(row[0]).trim() !== "" &&
          String(row[1]).trim() !== "" &&
          String(row[4]).trim() !== ""
        )
      })
      .map((row) => ({
        company: String(row[0]).trim(),
        code: String(row[1]).trim(),
        timestamp: formatTimestamp(row[2]),
        category: String(row[3]).trim(),
        title: String(row[4]).trim(),
        pdf_url: String(row[5]).trim(),
      }))

    console.log(`クリーニング後: ${cleanedData.length}件`)

    // バッチ処理でSupabaseに送信
    const batches = []
    for (let i = 0; i < cleanedData.length; i += CONFIG.BATCH_SIZE) {
      batches.push(cleanedData.slice(i, i + CONFIG.BATCH_SIZE))
    }

    console.log(`${batches.length}個のバッチで処理開始`)

    let successCount = 0
    let errorCount = 0

    batches.forEach((batch, index) => {
      try {
        const result = sendToSupabase(batch)
        if (result.success) {
          successCount += batch.length
          console.log(`バッチ ${index + 1}/${batches.length} 成功: ${batch.length}件`)
        } else {
          errorCount += batch.length
          console.error(`バッチ ${index + 1} エラー:`, result.error)
        }

        // API制限を避けるため少し待機
        Utilities.sleep(1000)
      } catch (error) {
        errorCount += batch.length
        console.error(`バッチ ${index + 1} 例外:`, error)
      }
    })

    console.log(`=== 移行完了 ===`)
    console.log(`成功: ${successCount}件`)
    console.log(`エラー: ${errorCount}件`)
  } catch (error) {
    console.error("移行エラー:", error)
  }
}

/**
 * Supabaseにデータを送信
 */
function sendToSupabase(dataArray) {
  try {
    const response = UrlFetchApp.fetch(`${CONFIG.SUPABASE_URL}/rest/v1/disclosures`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
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

    // 既にDateオブジェクトの場合
    if (timestamp instanceof Date) {
      return timestamp.toISOString()
    }

    // 文字列の場合はパース
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) {
      return new Date().toISOString()
    }

    return date.toISOString()
  } catch (error) {
    console.error("タイムスタンプ変換エラー:", error)
    return new Date().toISOString()
  }
}

/**
 * テスト用：少量データで試行
 */
function testMigration() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(CONFIG.SHEET_NAME)

    // 最初の5件のみテスト
    const data = sheet.getRange(2, 2, 5, 6).getValues()
    const testData = data.map((row) => ({
      company: String(row[0]).trim(),
      code: String(row[1]).trim(),
      timestamp: formatTimestamp(row[2]),
      category: String(row[3]).trim(),
      title: String(row[4]).trim(),
      pdf_url: String(row[5]).trim(),
    }))

    console.log("テストデータ:", testData)

    const result = sendToSupabase(testData)
    console.log("テスト結果:", result)
  } catch (error) {
    console.error("テストエラー:", error)
  }
}
