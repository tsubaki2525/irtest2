"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Search,
  Building2,
  Calendar,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  FileText,
  RefreshCwIcon as Refresh,
} from "lucide-react"
import type { Disclosure } from "@/lib/supabase"

interface DashboardMainProps {
  supabaseUrl?: string
  supabaseKey?: string
}

export function DashboardMain({ supabaseUrl, supabaseKey }: DashboardMainProps) {
  const [disclosures, setDisclosures] = useState<Disclosure[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [totalCount, setTotalCount] = useState(0)

  // メトリクス用の状態
  const [metrics, setMetrics] = useState({
    total: 0,
    important: 0,
    earnings: 0,
    lowPrice: 0,
  })

  // データ取得関数
  const fetchDisclosures = async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        search,
        category,
        limit: "50",
        offset: "0",
      })

      // Supabase設定がある場合はパラメータに追加
      if (supabaseUrl && supabaseKey) {
        params.append("url", supabaseUrl)
        params.append("key", supabaseKey)
      }

      const response = await fetch(`/api/disclosures?${params}`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "データの取得に失敗しました")
      }

      setDisclosures(result.data)
      setTotalCount(result.count)

      // メトリクスの計算
      calculateMetrics(result.data)
    } catch (err: any) {
      setError(err.message)
      setDisclosures([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  // メトリクス計算
  const calculateMetrics = (data: Disclosure[]) => {
    const important = data.filter(
      (d) => d.title.includes("重要") || d.title.includes("業績") || d.title.includes("配当"),
    ).length

    const earnings = data.filter(
      (d) => d.title.includes("決算") || d.title.includes("業績") || d.title.includes("修正"),
    ).length

    const lowPrice = data.filter((d) => {
      const code = Number.parseInt(d.code)
      return code && code < 1000
    }).length

    setMetrics({
      total: data.length,
      important,
      earnings,
      lowPrice,
    })
  }

  // カテゴリーの色分け
  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      決算短信: "bg-blue-100 text-blue-800",
      有価証券報告書: "bg-green-100 text-green-800",
      適時開示: "bg-yellow-100 text-yellow-800",
      業績修正: "bg-red-100 text-red-800",
      その他: "bg-gray-100 text-gray-800",
    }
    return colors[category] || colors["その他"]
  }

  // 日時フォーマット
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="space-y-6">
      {/* 検索・フィルター */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            検索・フィルター
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="企業名、証券コード、タイトルで検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="カテゴリー" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="決算短信">決算短信</SelectItem>
                <SelectItem value="有価証券報告書">有価証券報告書</SelectItem>
                <SelectItem value="適時開示">適時開示</SelectItem>
                <SelectItem value="業績修正">業績修正</SelectItem>
                <SelectItem value="その他">その他</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchDisclosures} disabled={loading} className="flex items-center gap-2">
              <Refresh className="h-4 w-4" />
              {loading ? "取得中..." : "データ取得"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* メトリクス */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">総件数</p>
                <p className="text-2xl font-bold">{metrics.total}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">重要IR</p>
                <p className="text-2xl font-bold">{metrics.important}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">業績関連</p>
                <p className="text-2xl font-bold">{metrics.earnings}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">低位株注目</p>
                <p className="text-2xl font-bold">{metrics.lowPrice}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* エラー表示 */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* データ一覧 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              適時開示情報
            </span>
            <Badge variant="outline">{totalCount}件</Badge>
          </CardTitle>
          <CardDescription>最新の適時開示情報を表示しています</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))}
            </div>
          ) : disclosures.length > 0 ? (
            <div className="space-y-4">
              {disclosures.map((disclosure) => (
                <div key={disclosure.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {disclosure.code}
                      </Badge>
                      <span className="font-medium">{disclosure.company}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getCategoryColor(disclosure.category)}>{disclosure.category}</Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(disclosure.timestamp)}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-medium mb-2 line-clamp-2">{disclosure.title}</h3>

                  {disclosure.summary && (
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{disclosure.summary}</p>
                  )}

                  <div className="flex items-center gap-2">
                    {disclosure.pdf_url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={disclosure.pdf_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          PDF
                        </a>
                      </Button>
                    )}
                    {disclosure.post_link && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={disclosure.post_link} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          詳細
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>データがありません</p>
              <p className="text-sm">「データ取得」ボタンを押してデータを読み込んでください</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
