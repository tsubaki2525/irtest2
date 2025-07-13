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

// Evo保有銘柄の型定義
interface EvoStock {
  id: number
  company: string
  code: string
  holding_ratio: number
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()

    if (!supabase) {
      // 環境変数が設定されていない場合はダミーデータを返す
      const dummyData: EvoStock[] = [
        {
          id: 1,
          company: "トヨタ自動車",
          code: "7203",
          holding_ratio: 15.5,
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 2,
          company: "ソフトバンクグループ",
          code: "9984",
          holding_ratio: 12.3,
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 3,
          company: "任天堂",
          code: "7974",
          holding_ratio: 8.7,
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 4,
          company: "キーエンス",
          code: "6861",
          holding_ratio: 6.2,
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 5,
          company: "ファーストリテイリング",
          code: "9983",
          holding_ratio: 5.8,
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 6,
          company: "信越化学工業",
          code: "4063",
          holding_ratio: 4.9,
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 7,
          company: "KDDI",
          code: "9433",
          holding_ratio: 4.2,
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
        {
          id: 8,
          company: "東京エレクトロン",
          code: "8035",
          holding_ratio: 3.8,
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-15T10:00:00Z",
        },
      ]

      return NextResponse.json({
        data: dummyData,
        count: dummyData.length,
        message: "ダミーデータ (v0環境)",
      })
    }

    // URLパラメータを取得
    const { searchParams } = new URL(request.url)
    const page = Number.parseInt(searchParams.get("page") || "1")
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const search = searchParams.get("search") || ""
    const sortBy = searchParams.get("sortBy") || "holding_ratio"
    const sortOrder = searchParams.get("sortOrder") || "desc"

    // ページネーション用の計算
    const from = (page - 1) * limit
    const to = from + limit - 1

    // クエリを構築
    let query = supabase.from("evo_stocks").select("*", { count: "exact" })

    // 検索条件を追加（ひらがな・カタカナ両方で検索）
    if (search) {
      const searchPatterns = normalizeSearchString(search)
      const conditions = searchPatterns.map(pattern => 
        `company.ilike.%${pattern}%,code.ilike.%${pattern}%`
      ).join(',')
      query = query.or(conditions)
    }

    // ソート条件を追加
    query = query.order(sortBy, { ascending: sortOrder === "asc" })

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
