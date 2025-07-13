// GAS用 - Evo保有銘柄シートからSupabaseへのデータ移行

/**
 * 設定値 - gas-dashboard-migration-fixed.jsと同じ設定を使用
 */
const EVO_CONFIG = {
  SHEET_NAME: "Evo保有銘柄",
  SUPABASE_URL: "https://twemtpqhawmlnjuxbabg.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3ZW10cHFoYXdtbG5qdXhiYWJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY3NTU5NzQsImV4cCI6MjA1MjMzMTk3NH0.vQgzgzgzgzgzgzgzgzgzgzgzgzgzgzgzgzgzgzgzgzgzg", // 実際のキーに変更してください
  MAX_ROWS: 1000,
}

/**
 * Evo保有銘柄データをSupabaseに移行（重複チェック付き）
 */
function migrateEvoStocksToSupabase() {
  try {
    console.log("=== Evo保有銘柄データ移行開始 ===")

    // 現在のスプレッドシートを取得
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(EVO_CONFIG.SHEET_NAME)

    if (!sheet) {
      throw new Error(`シート "${EVO_CONFIG.SHEET_NAME}" が見つかりません`)
    }

    console.log(`スプレッドシートID: ${spreadsheet.getId()}`)
    console.log(`シート名: ${sheet.getName()}`)

    const lastRow = sheet.getLastRow()
    console.log(`最終行: ${lastRow}`)

    if (lastRow <= 1) {
      console.log("データが存在しません")
      return
    }

    // データを取得（A列:会社名, B列:証券コード, C列:保有割合）
    const dataRows = Math.min(lastRow - 1, EVO_CONFIG.MAX_ROWS)
    const rawData = sheet.getRange(2, 1, dataRows, 3).getValues()

    console.log(`取得行数: ${dataRows}`)

    // データを整形
    const evoStocks = []
    const seenCodes = new Set() // 重複チェック用

    rawData.forEach((row, index) => {
      const company = String(row[0] || "").trim()
      const code = String(row[1] || "").trim()
      const holdingRatio = Number.parseFloat(row[2]) || 0

      // 必須項目のチェック
      if (company && code && holdingRatio > 0) {
        // 重複チェック
        if (seenCodes.has(code)) {
          console.log(`行${index + 2}をスキップ: 重複する証券コード [${code}]`)
          return
        }

        seenCodes.add(code)
        evoStocks.push({
          company: company,
          code: code,
          holding_ratio: holdingRatio,
        })
      } else {
        console.log(`行${index + 2}をスキップ: 必須項目が不足 [${company}, ${code}, ${holdingRatio}]`)
      }
    })

    console.log(`有効なデータ件数: ${evoStocks.length}`)

    if (evoStocks.length === 0) {
      console.log("移行対象のデータがありません")
      return
    }

    // 既存データを削除してから挿入（修正版）
    console.log("既存データを削除中...")
    const deleteResult = deleteAllEvoStocksFixed()
    console.log("削除結果:", deleteResult)

    // Supabaseに送信
    const result = insertEvoStocksToSupabase(evoStocks)
    console.log("移行結果:", result)

    console.log("=== Evo保有銘柄データ移行完了 ===")
  } catch (error) {
    console.error("移行エラー:", error)
    throw error
  }
}

/**
 * SupabaseにEvo保有銘柄データを挿入
 */
function insertEvoStocksToSupabase(evoStocks) {
  try {
    const url = `${EVO_CONFIG.SUPABASE_URL}/rest/v1/evo_stocks`

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVO_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${EVO_CONFIG.SUPABASE_ANON_KEY}`,
        Prefer: "return=minimal",
      },
      payload: JSON.stringify(evoStocks),
      muteHttpExceptions: true, // エラーレスポンスの詳細を取得
    }

    console.log(`Supabaseに${evoStocks.length}件のデータを送信中...`)

    const response = UrlFetchApp.fetch(url, options)
    const statusCode = response.getResponseCode()
    const responseText = response.getContentText()

    console.log(`レスポンスコード: ${statusCode}`)

    if (statusCode === 201 || statusCode === 200) {
      return {
        success: true,
        message: `${evoStocks.length}件のデータを正常に挿入しました`,
        statusCode: statusCode,
      }
    } else {
      console.error("Supabaseエラー:", responseText)
      return {
        success: false,
        error: responseText,
        statusCode: statusCode,
      }
    }
  } catch (error) {
    console.error("Supabase挿入エラー:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 既存のEvo保有銘柄データを全削除（修正版）
 */
function deleteAllEvoStocksFixed() {
  try {
    // まず既存データを取得
    const getUrl = `${EVO_CONFIG.SUPABASE_URL}/rest/v1/evo_stocks?select=id`

    const getOptions = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        apikey: EVO_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${EVO_CONFIG.SUPABASE_ANON_KEY}`,
      },
      muteHttpExceptions: true,
    }

    const getResponse = UrlFetchApp.fetch(getUrl, getOptions)
    const getStatusCode = getResponse.getResponseCode()

    if (getStatusCode !== 200) {
      console.log("既存データの取得に失敗、削除をスキップします")
      return { success: true, message: "削除をスキップしました" }
    }

    const existingData = JSON.parse(getResponse.getContentText())

    if (existingData.length === 0) {
      console.log("削除対象のデータがありません")
      return { success: true, message: "削除対象のデータがありません" }
    }

    // WHERE句を使用して削除（id > 0 で全件削除）
    const deleteUrl = `${EVO_CONFIG.SUPABASE_URL}/rest/v1/evo_stocks?id=gt.0`

    const deleteOptions = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        apikey: EVO_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${EVO_CONFIG.SUPABASE_ANON_KEY}`,
      },
      muteHttpExceptions: true,
    }

    const deleteResponse = UrlFetchApp.fetch(deleteUrl, deleteOptions)
    const deleteStatusCode = deleteResponse.getResponseCode()

    console.log(`削除レスポンスコード: ${deleteStatusCode}`)

    return {
      success: deleteStatusCode >= 200 && deleteStatusCode < 300,
      statusCode: deleteStatusCode,
      message:
        deleteStatusCode >= 200 && deleteStatusCode < 300
          ? `${existingData.length}件のデータを削除しました`
          : "削除に失敗しました",
    }
  } catch (error) {
    console.error("削除エラー:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * 既存のEvo保有銘柄データを全削除（旧版）
 */
function deleteAllEvoStocks() {
  try {
    const url = `${EVO_CONFIG.SUPABASE_URL}/rest/v1/evo_stocks`

    const options = {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        apikey: EVO_CONFIG.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${EVO_CONFIG.SUPABASE_ANON_KEY}`,
      },
      muteHttpExceptions: true, // エラーレスポンスの詳細を取得
    }

    const response = UrlFetchApp.fetch(url, options)
    const statusCode = response.getResponseCode()
    const responseText = response.getContentText()

    console.log(`削除レスポンスコード: ${statusCode}`)
    if (statusCode !== 204) {
      console.log(`削除レスポンス: ${responseText}`)
    }

    return {
      success: statusCode >= 200 && statusCode < 300,
      statusCode: statusCode,
      message: statusCode >= 200 && statusCode < 300 ? "既存データを削除しました" : "削除に失敗しました",
    }
  } catch (error) {
    console.error("削除エラー:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

/**
 * テスト用関数
 */
function testEvoStocksMigration() {
  try {
    console.log("=== Evo保有銘柄移行テスト ===")

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet()
    const sheet = spreadsheet.getSheetByName(EVO_CONFIG.SHEET_NAME)

    if (!sheet) {
      console.log(`エラー: シート "${EVO_CONFIG.SHEET_NAME}" が見つかりません`)
      return
    }

    console.log(`スプレッドシートID: ${spreadsheet.getId()}`)
    console.log(`シート名: ${sheet.getName()}`)
    console.log(`最終行: ${sheet.getLastRow()}`)
    console.log(`最終列: ${sheet.getLastColumn()}`)

    // サンプルデータを表示
    if (sheet.getLastRow() > 1) {
      const sampleData = sheet.getRange(2, 1, Math.min(5, sheet.getLastRow() - 1), 3).getValues()
      console.log("サンプルデータ:")
      sampleData.forEach((row, index) => {
        console.log(`行${index + 2}: [${row.join(", ")}]`)
      })
    }

    console.log("=== テスト完了 ===")
  } catch (error) {
    console.error("テストエラー:", error)
  }
}
