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

// 適時開示の型定義
interface Disclosure {
  id: number
  company: string
  code: string
  title: string
  category: string
  pdf_url: string
  timestamp: string
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()

    if (!supabase) {
      // 環境変数が設定されていない場合はダミーデータを返す
      const dummyData: Disclosure[] = [
        {
          id: 1,
          company: "トヨタ自動車",
          code: "7203",
          title: "2024年3月期 第3四半期決算短信",
          category: "決算短信",
          pdf_url: "https://example.com/toyota_q3.pdf",
          timestamp: "2024-01-15 15:00",
          created_at: "2024-01-15T15:00:00Z",
          updated_at: "2024-01-15T15:00:00Z",
        },
        {
          id: 2,
          company: "ソフトバンクグループ",
          code: "9984",
          title: "業績予想の修正に関するお知らせ",
          category: "業績修正等",
          pdf_url: "https://example.com/softbank_revision.pdf",
          timestamp: "2024-01-15 14:30",
          created_at: "2024-01-15T14:30:00Z",
          updated_at: "2024-01-15T14:30:00Z",
        },
        {
          id: 3,
          company: "任天堂",
          code: "7974",
          title: "新商品発表に関するお知らせ",
          category: "その他",
          pdf_url: "https://example.com/nintendo_product.pdf",
          timestamp: "2024-01-15 13:00",
          created_at: "2024-01-15T13:00:00Z",
          updated_at: "2024-01-15T13:00:00Z",
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
    const category = searchParams.get("category") || ""
    const dateFilter = searchParams.get("dateFilter") || ""
    const sortBy = searchParams.get("sortBy") || "timestamp"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    // ページネーション用の計算
    const from = (page - 1) * limit
    const to = from + limit - 1

    // クエリを構築
    let query = supabase.from("disclosures").select("*", { count: "exact" })

    // 検索条件を追加（ひらがな・カタカナ両方で検索）
    if (search) {
      const searchPatterns = normalizeSearchString(search)
      const conditions = searchPatterns.map(pattern => 
        `company.ilike.%${pattern}%,code.ilike.%${pattern}%,title.ilike.%${pattern}%`
      ).join(',')
      query = query.or(conditions)
    }

    // 日付フィルター
    if (dateFilter) {
      const now = new Date()
      if (dateFilter === "today") {
        // 今日のデータのみ
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
        query = query.gte("timestamp", todayStart.toISOString())
        query = query.lt("timestamp", todayEnd.toISOString())
      } else if (dateFilter === "week") {
        // 過去7日間のデータ
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        query = query.gte("timestamp", weekAgo.toISOString())
      }
    }

    // カテゴリフィルター
    if (category && category !== "全て" && category !== "all") {
      // 複数のカテゴリがカンマ区切りで送られてきた場合
      const categories = category.split(",").map(cat => cat.trim())
      if (categories.length > 1) {
        query = query.in("category", categories)
      } else {
        query = query.eq("category", category)
      }
    }

    // ソート条件を追加（change_rateはデータベースに存在しないのでtimestampでソート）
    const actualSortBy = sortBy === "change_rate" ? "timestamp" : sortBy
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
