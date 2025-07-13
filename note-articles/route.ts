import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Supabaseクライアントの作成
function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseKey)
}

// Note記事の型定義
interface NoteArticle {
  id?: number
  rank: string | null
  article_id: string | null
  article_key: string | null
  title: string | null
  author_name: string | null
  author_url: string | null
  published_at: string | null
  like_count: number
  comment_count: number
  price: number
  is_free: boolean
  eyecatch_url: string | null
  author_icon_url: string | null
  article_url: string | null
  stock_count: string | null
  genre: string | null
  created_at: string
  updated_at: string
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()

    if (!supabase) {
      console.error("Supabase client could not be created")
      return NextResponse.json(
        { 
          error: "データベース接続エラー",
          details: "Supabase環境変数が設定されていません" 
        },
        { status: 500 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // クエリパラメータの取得
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const search = searchParams.get("search") || ""
    const genre = searchParams.get("genre") || "all"
    const sortBy = searchParams.get("sortBy") || "rank"
    const sortOrder = searchParams.get("sortOrder") || "asc"
    const isFree = searchParams.get("isFree") || "all"

    // ベースクエリの作成
    let query = supabase
      .from("note_articles")
      .select("*", { count: "exact" })

    // 検索条件の追加
    if (search) {
      query = query.or(`title.ilike.%${search}%,author_name.ilike.%${search}%`)
    }

    // ジャンルフィルタ
    if (genre !== "all") {
      query = query.eq("genre", genre)
    }

    // 無料/有料フィルタ
    if (isFree === "free") {
      query = query.eq("is_free", true)
    } else if (isFree === "paid") {
      query = query.eq("is_free", false)
    }

    // ソート
    query = query.order(sortBy, { ascending: sortOrder === "asc" })

    // ページネーション
    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    // クエリの実行
    const { data, error, count } = await query

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        { 
          error: "データ取得エラー",
          details: error.message 
        },
        { status: 500 }
      )
    }

    // レスポンスの作成
    return NextResponse.json({
      data: data || [],
      totalCount: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    })

  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { 
        error: "サーバーエラー",
        details: error instanceof Error ? error.message : "不明なエラー" 
      },
      { status: 500 }
    )
  }
}

// POST: 新しい記事の追加
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "データベース接続エラー" },
        { status: 500 }
      )
    }

    const body = await request.json()
    
    // created_at と updated_at を自動設定
    const articleData = {
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase
      .from("note_articles")
      .insert([articleData])
      .select()
      .single()

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json(
        { error: "データ追加エラー", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })

  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json(
      { error: "サーバーエラー" },
      { status: 500 }
    )
  }
} 