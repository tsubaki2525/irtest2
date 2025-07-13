import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ひらがなをカタカナに変換する関数
function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) + 0x60)
  })
}

// 検索文字列を正規化する関数（ひらがな・カタカナ両方で検索）
function normalizeSearchString(search: string): string[] {
  const katakana = hiraganaToKatakana(search)
  const hiragana = search.replace(/[\u30a1-\u30f6]/g, (match) => {
    return String.fromCharCode(match.charCodeAt(0) - 0x60)
  })
  
  // 重複を除去して両方のパターンを返す
  return Array.from(new Set([search, katakana, hiragana]))
}

// Supabaseクライアントの作成
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseKey)
}

// テクニカル発生銘柄の型定義
interface TechnicalStock {
  id: number
  company: string
  code: string
  market: string | null
  price: number | null
  change: number | null
  change_rate: number | null
  ma5: number | null
  ma25: number | null
  market_cap: number | null
  per: number | null
  pbr: number | null
  yield_rate: number | null
  liquidity: string | null
  fetched_at: string
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()

    if (!supabase) {
      // 環境変数が設定されていない場合はダミーデータを返す
      const dummyData: TechnicalStock[] = [
        {
          id: 1,
          company: "エムスリー",
          code: "2413",
          market: "東証プライム",
          price: 1250.00,
          change: 40.00,
          change_rate: 3.2,
          ma5: 1210.00,
          ma25: 1180.00,
          market_cap: 850000.00,
          per: 25.5,
          pbr: 4.2,
          yield_rate: 0.8,
          liquidity: "○",
          fetched_at: "2024-01-15T10:00:00Z",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 2,
          company: "サイバーエージェント",
          code: "4751",
          market: "東証プライム",
          price: 890.50,
          change: 25.00,
          change_rate: 2.8,
          ma5: 875.00,
          ma25: 860.00,
          market_cap: 480000.00,
          per: 18.3,
          pbr: 2.1,
          yield_rate: 0.0,
          liquidity: "○",
          fetched_at: "2024-01-15T10:00:00Z",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 3,
          company: "メルカリ",
          code: "4385",
          market: "東証プライム",
          price: 450.00,
          change: 23.00,
          change_rate: 5.1,
          ma5: 435.00,
          ma25: 420.00,
          market_cap: 290000.00,
          per: 35.2,
          pbr: 3.8,
          yield_rate: 0.0,
          liquidity: "△",
          fetched_at: "2024-01-15T10:00:00Z",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 4,
          company: "ラクスル",
          code: "4384",
          market: "東証グロース",
          price: 320.00,
          change: 15.00,
          change_rate: 4.7,
          ma5: 310.00,
          ma25: 305.00,
          market_cap: 48000.00,
          per: 65.5,
          pbr: 8.2,
          yield_rate: 0.0,
          liquidity: "○",
          fetched_at: "2024-01-15T10:00:00Z",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 5,
          company: "フリー",
          code: "4478",
          market: "東証マザーズ",
          price: 280.00,
          change: 5.30,
          change_rate: 1.9,
          ma5: 275.00,
          ma25: 270.00,
          market_cap: 42000.00,
          per: 28.7,
          pbr: 6.5,
          yield_rate: 0.0,
          liquidity: "○",
          fetched_at: "2024-01-15T10:00:00Z",
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
      ]

      return NextResponse.json({
        data: dummyData,
        count: dummyData.length,
        totalPages: 1,
        message: "ダミーデータ (v0環境)",
      })
    }

    // URLパラメータを取得
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const market = searchParams.get("market") || ""
    const sortBy = searchParams.get("sortBy") || "change_rate"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    // ページネーション用の計算
    const from = (page - 1) * limit
    const to = from + limit - 1

    // クエリを構築
    let query = supabase.from("technical_stocks").select("*", { count: "exact" })

    // 検索条件を追加（ひらがな・カタカナ両方で検索）
    if (search) {
      const searchPatterns = normalizeSearchString(search)
      const conditions = searchPatterns.map(pattern => 
        `company.ilike.%${pattern}%,code.ilike.%${pattern}%`
      ).join(',')
      query = query.or(conditions)
    }

    // 市場フィルター
    if (market && market !== "all") {
      query = query.eq("market", market)
    }

    // ソート条件を追加（timestampはデータベースに存在しないのでfetched_atでソート）
    const actualSortBy = sortBy === "timestamp" ? "fetched_at" : sortBy
    query = query.order(actualSortBy, { ascending: sortOrder === "asc" })

    // ページネーションを適用
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "データの取得に失敗しました", details: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: data || [],
      count: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 })
  }
} 