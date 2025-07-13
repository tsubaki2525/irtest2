import { createClient } from "@supabase/supabase-js"

// 環境変数の型定義
interface SupabaseConfig {
  url: string
  anonKey: string
}

// Supabaseクライアントの設定
function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    console.warn("Supabase環境変数が設定されていません")
    return null
  }

  return { url, anonKey }
}

// Supabaseクライアントの作成
function createSupabaseClient() {
  const config = getSupabaseConfig()

  if (!config) {
    return null
  }

  return createClient(config.url, config.anonKey)
}

// シングルトンパターンでクライアントを作成
export const supabase = createSupabaseClient()

// 型定義をエクスポート
export interface Disclosure {
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

export interface EvoStock {
  id: number
  company: string
  code: string
  holding_ratio: number
  created_at: string
  updated_at: string
}

export interface TechnicalStock {
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

export interface RecommendedNote {
  id: number
  rank: number
  title: string
  description: string
  price: number | null
  url: string
  image_url: string | null
  sold_out?: boolean
  like_count?: number
  author_name?: string
  author_icon_url?: string | null
  genre?: string | null
  published_at?: string
  created_at: string
  updated_at: string
}

// Supabaseクライアントの状態をチェックする関数
export function isSupabaseConfigured(): boolean {
  return supabase !== null
}

// デフォルトエクスポート
export default supabase
