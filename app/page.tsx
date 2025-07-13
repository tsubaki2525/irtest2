"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, FileText, TrendingUp, BarChart3, BookOpen, ExternalLink, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle } from "lucide-react"
import type { Disclosure, EvoStock, TechnicalStock, RecommendedNote } from "@/lib/supabase"
import Image from "next/image"

export default function StockDashboard() {
  const [activeTab, setActiveTab] = useState("disclosures")
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  
  // テクニカル発生銘柄の詳細表示状態
  const [expandedTechnicalStock, setExpandedTechnicalStock] = useState<number | null>(null)
  
  // 適時開示の詳細表示状態
  const [expandedDisclosure, setExpandedDisclosure] = useState<number | null>(null)

  // データ状態
  const [disclosures, setDisclosures] = useState<Disclosure[]>([])
  const [allDisclosures, setAllDisclosures] = useState<Disclosure[]>([]) // サマリー計算用の全データ
  const [evoStocks, setEvoStocks] = useState<EvoStock[]>([])
  const [technicalStocks, setTechnicalStocks] = useState<TechnicalStock[]>([])
  const [recommendedNotes, setRecommendedNotes] = useState<RecommendedNote[]>([])

  // ページネーション状態
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // フィルター状態
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("")

  // ソート状態
  const [sortBy, setSortBy] = useState("change_rate")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  // 日時フォーマット関数
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

  // N分前を計算する関数
  const formatTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffMinutes < 1) {
      return "たった今"
    } else if (diffMinutes < 60) {
      return `${diffMinutes}分前`
    } else if (diffHours < 24) {
      return `${diffHours}時間前`
    } else {
      return `${diffDays}日前`
    }
  }

  // サマリーカードクリックハンドラー
  const handleSummaryCardClick = (filterType: string) => {
    setCurrentPage(1)
    
    switch (filterType) {
      case "today":
        setDateFilter("today")
        setCategoryFilter("all")
        break
      case "week":
        setDateFilter("week")
        setCategoryFilter("all")
        break
      case "important":
        setDateFilter("")
        setCategoryFilter("重要IR")
        break
      case "earnings":
        setDateFilter("")
        setCategoryFilter("業績修正等")
        break
      default:
        setDateFilter("")
        setCategoryFilter("all")
    }
  }

  // フィルターリセット
  const handleResetFilters = () => {
    setDateFilter("")
    setCategoryFilter("all")
    setSearchTerm("")
    setCurrentPage(1)
  }

  // ソートハンドラー
  const handleSort = (column: string) => {
    if (sortBy === column) {
      // 同じ列の場合は昇順・降順を切り替え
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      // 異なる列の場合は新しい列で降順ソート
      setSortBy(column)
      setSortOrder("desc")
    }
    setCurrentPage(1) // ページを1に戻す
  }

  // ソート状態に応じた色を返す関数
  const getSortColor = (column: string) => {
    if (sortBy !== column) {
      return "text-cyan-700 hover:bg-cyan-100" // 通常状態
    }
    return sortOrder === "asc" ? 
      "text-green-800 bg-green-100 hover:bg-green-200" : // 昇順
      "text-blue-800 bg-blue-100 hover:bg-blue-200" // 降順
  }

  // 適時開示のサマリーデータを計算（常に全データで計算）
  const calculateSummaryData = () => {
    const today = new Date()
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    const todayCount = allDisclosures.filter(d => {
      const disclosureDate = new Date(d.timestamp)
      return disclosureDate.toDateString() === today.toDateString()
    }).length

    const weekCount = allDisclosures.filter(d => {
      const disclosureDate = new Date(d.timestamp)
      return disclosureDate >= weekAgo
    }).length

    const importantCount = allDisclosures.filter(d => 
      ['決算短信', '業績修正等', '配当予想等'].includes(d.category)
    ).length

    const earningsCount = allDisclosures.filter(d => 
      d.category === '業績修正等'
    ).length

    return { todayCount, weekCount, importantCount, earningsCount }
  }

  const summaryData = calculateSummaryData()

  // EVO保有チェック関数
  const isEvoHolding = (code: string) => {
    return evoStocks.some(evo => evo.code === code)
  }

  // テクニカル発生銘柄チェック関数
  const isTechnicalStock = (code: string) => {
    return technicalStocks.some(stock => stock.code === code)
  }

  // 1週間以内の適時開示チェック関数
  const hasRecentDisclosure = (code: string) => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    return allDisclosures.some(disclosure => {
      const disclosureDate = new Date(disclosure.timestamp)
      return disclosure.code === code && disclosureDate >= weekAgo
    })
  }

  // テクニカル銘柄カードクリックハンドラー
  const handleTechnicalStockClick = (code: string) => {
    // 適時開示タブに移動
    setActiveTab("disclosures")
    // 検索条件をリセットしてから証券コードで検索
    setDateFilter("")
    setCategoryFilter("all")
    setSearchTerm(code)
    setCurrentPage(1)
  }

  // IRマーククリックハンドラー
  const handleIRClick = (e: React.MouseEvent, code: string) => {
    e.stopPropagation() // 親要素のクリックイベントを停止
    setActiveTab("disclosures")
    setDateFilter("")
    setCategoryFilter("all")
    setSearchTerm(code)
    setCurrentPage(1)
  }

  // EVOマーククリックハンドラー
  const handleEVOClick = (e: React.MouseEvent, code: string) => {
    e.stopPropagation() // 親要素のクリックイベントを停止
    setActiveTab("evo-stocks")
    setSearchTerm(code)
    setCurrentPage(1)
  }

  // テクニカルマーククリックハンドラー
  const handleTechnicalClick = (e: React.MouseEvent, code: string) => {
    e.stopPropagation() // 親要素のクリックイベントを停止
    setActiveTab("technical-stocks")
    setSearchTerm(code)
    setCurrentPage(1)
  }

  // データ取得関数（全データを取得してからフィルター）
  const fetchDisclosures = async () => {
    try {
      setLoading(true)
      
      // 全データを取得（フィルターなし）
      const allDataParams = new URLSearchParams({
        page: "1",
        limit: "1000", // 大きな値で全データを取得
        search: "",
        category: "all",
        dateFilter: "",
        sortBy: "timestamp",
        sortOrder: "desc",
      })

      const allDataResponse = await fetch(`/api/disclosures?${allDataParams}`)
      const allData = await allDataResponse.json()

      if (allDataResponse.ok) {
        // 全データを保存（サマリー計算用）
        setAllDisclosures(allData.data || [])
      }

      // フィルターされたデータを取得
      let categoryParam = categoryFilter
      if (categoryFilter === "重要IR") {
        categoryParam = "決算短信,業績修正等,配当予想等"
      }
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        search: searchTerm,
        category: categoryParam,
        dateFilter: dateFilter,
        sortBy: sortBy,
        sortOrder: sortOrder,
      })

      const response = await fetch(`/api/disclosures?${params}`)
      const data = await response.json()

      if (response.ok) {
        setDisclosures(data.data || [])
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.count || 0)
      } else {
        console.error("適時開示データの取得に失敗:", data.error)
      }
    } catch (error) {
      console.error("適時開示データの取得に失敗:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchEvoStocks = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        search: searchTerm,
        sortBy: sortBy,
        sortOrder: sortOrder,
      })

      const response = await fetch(`/api/evo-stocks?${params}`)
      const data = await response.json()

      if (response.ok) {
        setEvoStocks(data.data || [])
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.count || 0)
      } else {
        console.error("Evo保有銘柄データの取得に失敗:", data.error)
      }
    } catch (error) {
      console.error("Evo保有銘柄データの取得に失敗:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTechnicalStocks = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        search: searchTerm,
        sortBy: sortBy,
        sortOrder: sortOrder,
      })

      const response = await fetch(`/api/technical-stocks?${params}`)
      const data = await response.json()

      if (response.ok) {
        setTechnicalStocks(data.data || [])
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.count || 0)
      } else {
        console.error("テクニカル発生銘柄データの取得に失敗:", data.error)
      }
    } catch (error) {
      console.error("テクニカル発生銘柄データの取得に失敗:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecommendedNotes = async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "20",
        search: searchTerm,
        sortBy: "rank",
        sortOrder: "asc",
      })

      const response = await fetch(`/api/note-articles?${params}`)
      const data = await response.json()

      if (response.ok) {
        // APIから取得したデータを整形
        const formattedNotes: RecommendedNote[] = data.data.map((item: any) => ({
          id: item.id,
          rank: parseInt(item.rank) || 0,
          title: item.title || "",
          description: "", // APIにdescriptionがないため空文字
          price: item.price,
          url: item.article_url || "",
          image_url: item.eyecatch_url || "",
          sold_out: item.stock_count === "0" || item.stock_count === "売り切れ",
          like_count: item.like_count || 0,
          author_name: item.author_name || "",
          author_icon_url: item.author_icon_url || null,
          genre: item.genre || null,
          published_at: item.published_at || "",
          created_at: item.created_at,
          updated_at: item.updated_at,
        }))
        
        setRecommendedNotes(formattedNotes)
        setTotalPages(data.totalPages || 1)
        setTotalCount(data.totalCount || 0)
      } else {
        console.error("おすすめnoteデータの取得に失敗:", data.error)
      }
    } catch (error) {
      console.error("おすすめnoteデータの取得に失敗:", error)
    } finally {
      setLoading(false)
    }
  }

  // タブ変更時の処理
  useEffect(() => {
    setCurrentPage(1)
    setSearchTerm("")
    setCategoryFilter("all")
    setDateFilter("")

    // タブごとに適切なデフォルトソートを設定
    if (activeTab === "disclosures") {
      setSortBy("timestamp")
      setSortOrder("desc")
      fetchDisclosures()
    } else if (activeTab === "evo-stocks") {
      setSortBy("holding_ratio")
      setSortOrder("desc")
      fetchEvoStocks()
    } else if (activeTab === "technical-stocks") {
      setSortBy("change_rate")
      setSortOrder("desc")
      fetchTechnicalStocks()
    } else if (activeTab === "recommended-notes") {
      fetchRecommendedNotes()
    }
  }, [activeTab])

  // ページ変更時・ソート変更時・フィルター変更時の処理
  useEffect(() => {
    if (activeTab === "disclosures") {
      fetchDisclosures()
    } else if (activeTab === "evo-stocks") {
      fetchEvoStocks()
    } else if (activeTab === "technical-stocks") {
      fetchTechnicalStocks()
    } else if (activeTab === "recommended-notes") {
      fetchRecommendedNotes()
    }
  }, [currentPage, sortBy, sortOrder])

  // 適時開示タブのフィルター変更時の処理
  useEffect(() => {
    if (activeTab === "disclosures") {
      setCurrentPage(1)
      fetchDisclosures()
    }
  }, [categoryFilter, dateFilter])

  // 検索処理
  const handleSearch = () => {
    setCurrentPage(1)
    if (activeTab === "disclosures") {
      fetchDisclosures()
    } else if (activeTab === "evo-stocks") {
      fetchEvoStocks()
    } else if (activeTab === "technical-stocks") {
      fetchTechnicalStocks()
    } else if (activeTab === "recommended-notes") {
      fetchRecommendedNotes()
    }
  }

  // リフレッシュ処理（並び替えリセット付き）
  const handleRefresh = () => {
    // ページを1に戻す
    setCurrentPage(1)
    
    // タブごとにソートをデフォルト状態にリセット
    if (activeTab === "disclosures") {
      setSortBy("timestamp")
      setSortOrder("desc")
      fetchDisclosures()
    } else if (activeTab === "evo-stocks") {
      setSortBy("holding_ratio")
      setSortOrder("desc")
      fetchEvoStocks()
    } else if (activeTab === "technical-stocks") {
      setSortBy("change_rate")
      setSortOrder("desc")
      fetchTechnicalStocks()
    } else if (activeTab === "recommended-notes") {
      fetchRecommendedNotes()
    }
  }

  // ページネーション
  const Pagination = () => {
    if (totalPages <= 1) return null

    return (
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm text-slate-600">
          {totalCount}件中 {((currentPage - 1) * 20) + 1}~{Math.min(currentPage * 20, totalCount)}件を表示
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            前へ
          </Button>
          <span className="text-sm">
            {currentPage} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            次へ
          </Button>
        </div>
      </div>
    )
  }

  // 円グラフコンポーネント
  const CircleChart = ({ percentage, color = "blue" }: { percentage: number; color?: string }) => {
    const radius = 40
    const circumference = 2 * Math.PI * radius
    const strokeDasharray = circumference
    const strokeDashoffset = circumference - (percentage / 100) * circumference
    
    const colors = {
      blue: "#3b82f6",
      green: "#10b981",
      purple: "#8b5cf6",
      orange: "#f59e0b"
  }

  return (
      <div className="relative w-24 h-24 mx-auto">
        <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke="#e5e7eb"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            stroke={colors[color as keyof typeof colors]}
            strokeWidth="8"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold">{percentage}%</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-sky-50 to-blue-50 pt-12 p-3 md:p-4">
      <div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
        {/* ヘッダー */}
        <div className="text-center mt-6 md:mt-0">
          <div className="flex items-center justify-center space-x-2 md:flex-col md:space-x-0 md:space-y-2">
            <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">Teipick</h1>
            <p className="text-sm md:text-lg text-cyan-700 font-medium">株価が動く、その前に。</p>
          </div>
        </div>

        {/* メインコンテンツ */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 md:space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 -mt-2 md:mt-0 bg-transparent">
            <TabsTrigger value="disclosures" className="flex items-center justify-center gap-1 md:gap-2 text-sm md:text-base h-10 md:h-12 px-1 md:px-2 rounded-md data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-700 transition-colors">
              <FileText className="h-4 w-4 md:h-5 md:w-5" />
              適時開示
            </TabsTrigger>
            <TabsTrigger value="evo-stocks" className="flex items-center justify-center gap-1 md:gap-2 text-sm md:text-base h-10 md:h-12 px-1 md:px-2 rounded-md data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-700 transition-colors">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
              EVO保有銘柄
            </TabsTrigger>
            <TabsTrigger value="technical-stocks" className="flex items-center justify-center gap-1 md:gap-2 text-sm md:text-base h-10 md:h-12 px-1 md:px-2 rounded-md data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-700 transition-colors">
              <BarChart3 className="h-4 w-4 md:h-5 md:w-5" />
              テクニカル発生銘柄
            </TabsTrigger>
            <TabsTrigger value="recommended-notes" className="flex items-center justify-center gap-1 md:gap-2 text-sm md:text-base h-10 md:h-12 px-1 md:px-2 rounded-md data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-700 transition-colors">
              <BookOpen className="h-4 w-4 md:h-5 md:w-5" />
              おすすめ学習教材
            </TabsTrigger>
          </TabsList>

          {/* 適時開示タブ */}
          <TabsContent value="disclosures" className="mt-16">
            <div className="space-y-4 md:space-y-6">
              {/* サマリーカード */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-14 md:mt-0">
                <Card 
                  className={`p-2 md:p-3 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/80 backdrop-blur-sm border border-cyan-200 ${dateFilter === "today" ? "ring-2 ring-cyan-400 shadow-lg" : ""}`}
                  onClick={() => handleSummaryCardClick("today")}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm md:text-base font-medium text-cyan-700">今日のIR</h3>
                    <div className="text-lg md:text-xl font-bold text-right w-8 md:w-12 text-cyan-600">{summaryData.todayCount}</div>
                  </div>
                </Card>
                
                <Card 
                  className={`p-2 md:p-3 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/80 backdrop-blur-sm border border-cyan-200 ${dateFilter === "week" ? "ring-2 ring-cyan-400 shadow-lg" : ""}`}
                  onClick={() => handleSummaryCardClick("week")}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm md:text-base font-medium text-cyan-700">週間累計</h3>
                    <div className="text-lg md:text-xl font-bold text-right w-8 md:w-12 text-cyan-600">{summaryData.weekCount}</div>
                  </div>
                </Card>
                
                <Card 
                  className={`p-2 md:p-3 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/80 backdrop-blur-sm border border-cyan-200 ${categoryFilter === "重要IR" ? "ring-2 ring-cyan-400 shadow-lg" : ""}`}
                  onClick={() => handleSummaryCardClick("important")}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm md:text-base font-medium text-cyan-700">重要IR</h3>
                    <div className="text-lg md:text-xl font-bold text-right w-8 md:w-12 text-cyan-600">{summaryData.importantCount}</div>
                  </div>
                </Card>
                
                <Card 
                  className={`p-2 md:p-3 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-105 bg-white/80 backdrop-blur-sm border border-cyan-200 ${categoryFilter === "業績修正等" ? "ring-2 ring-cyan-400 shadow-lg" : ""}`}
                  onClick={() => handleSummaryCardClick("earnings")}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm md:text-base font-medium text-cyan-700">業績修正</h3>
                    <div className="text-lg md:text-xl font-bold text-right w-8 md:w-12 text-cyan-600">{summaryData.earningsCount}</div>
                  </div>
                </Card>
              </div>

              {/* アクティブフィルター表示とリセットボタン */}
              {(dateFilter || categoryFilter !== "all") && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-cyan-700 font-medium">アクティブフィルター:</span>
                  {dateFilter === "today" && <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-300">今日のIR</Badge>}
                  {dateFilter === "week" && <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-300">週間累計</Badge>}
                  {categoryFilter === "重要IR" && <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-300">重要IR</Badge>}
                  {categoryFilter === "業績修正等" && <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-300">業績修正</Badge>}
                  {categoryFilter !== "all" && categoryFilter !== "重要IR" && categoryFilter !== "業績修正等" && (
                    <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-300">{categoryFilter}</Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleResetFilters} className="hover:bg-cyan-100 hover:text-cyan-800 transition-colors">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    リセット
                  </Button>
                </div>
              )}

              {/* メインコンテンツ */}
            <Card className="bg-white/90 backdrop-blur-sm border-cyan-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-cyan-600" />
                    <span className="text-cyan-800">適時開示情報</span>
                  </div>
                  <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-300">{totalCount}件</Badge>
                </CardTitle>
                  <CardDescription>
                    <div className="flex items-center justify-between">
                      <div className="text-cyan-700">
                        最新の適時開示情報を確認できます
                        {allDisclosures.length > 0 && (
                          <div className="text-sm text-cyan-600 mt-1">
                            更新日時: {formatDate(allDisclosures.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0].updated_at)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-end">
                        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                          <SelectTrigger className="w-32 h-8 text-xs mt-5 bg-white/80 border-cyan-200 text-cyan-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white/95 backdrop-blur-sm border-cyan-200">
                            <SelectItem value="all">全てのカテゴリ</SelectItem>
                            <SelectItem value="重要IR">重要IR</SelectItem>
                            <SelectItem value="配当予想等">配当予想等</SelectItem>
                            <SelectItem value="エクイティ">エクイティ</SelectItem>
                            <SelectItem value="追加・訂正">追加・訂正</SelectItem>
                            <SelectItem value="自社株取得">自社株取得</SelectItem>
                            <SelectItem value="業績修正等">業績修正等</SelectItem>
                            <SelectItem value="決算短信">決算短信</SelectItem>
                            <SelectItem value="その他">その他</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardDescription>
              </CardHeader>
                <CardContent className="space-y-3">
                {/* 検索・フィルター */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" />
                      <Input
                          placeholder="会社名・コード・タイトル検索"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 text-sm bg-white/80 border-cyan-200 focus:border-cyan-400 focus:ring-cyan-400"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                    </div>
                    <Button onClick={handleSearch} disabled={loading} variant="outline" size="icon" className="border-cyan-200 text-cyan-600 hover:bg-cyan-50 hover:border-cyan-300 transition-colors">
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                    <Button onClick={handleRefresh} variant="outline" size="icon" className="border-cyan-200 text-cyan-600 hover:bg-cyan-50 hover:border-cyan-300 transition-colors">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                                    {/* ヘッダー行 - モバイル */}
                  <div className="md:hidden bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 mb-3 border border-cyan-200">
                    <div className="flex items-center gap-2">
                      <div 
                        className={`w-16 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("timestamp")}`}
                        onClick={() => handleSort("timestamp")}
                      >
                        時間
                      </div>
                      <div 
                        className={`flex-1 text-left text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("company")}`}
                        onClick={() => handleSort("company")}
                      >
                        会社名
                      </div>
                      <div 
                        className={`w-28 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("category")}`}
                        onClick={() => handleSort("category")}
                      >
                        カテゴリ
                      </div>
                    </div>
                  </div>

                  {/* ヘッダー行 - デスクトップ */}
                  <div className="hidden md:block bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 mb-3 overflow-x-auto border border-cyan-200">
                    <div className="flex items-center gap-3 min-w-fit">
                      <div className="w-16 text-center text-sm font-semibold text-cyan-700">時間</div>
                      <div 
                        className={`w-32 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("timestamp")}`}
                        onClick={() => handleSort("timestamp")}
                      >
                        時刻
                      </div>
                      <div 
                        className={`w-32 text-left text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("company")}`}
                        onClick={() => handleSort("company")}
                      >
                        会社名
                      </div>
                      <div 
                        className={`w-16 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("code")}`}
                        onClick={() => handleSort("code")}
                      >
                        コード
                      </div>
                      <div 
                        className={`w-28 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("category")}`}
                        onClick={() => handleSort("category")}
                      >
                        カテゴリ
                      </div>
                      <div className="w-16 text-center text-sm font-semibold text-cyan-700">マーク</div>
                      <div className="flex-1 text-left text-sm font-semibold text-cyan-700">タイトル</div>
                    </div>
                  </div>

                  {/* データカード */}
                  <div className="space-y-3">
                      {loading ? (
                      <div className="text-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-cyan-600" />
                            <span className="text-cyan-700">データを読み込み中...</span>
                      </div>
                      ) : disclosures.length === 0 ? (
                      <div className="text-center py-8 text-cyan-600">
                            データがありません
                      </div>
                      ) : (
                        disclosures.map((disclosure) => (
                        <Card key={disclosure.id} className="p-3 md:p-3 hover:shadow-xl transition-all duration-300 hover:scale-[1.01] bg-white/80 backdrop-blur-sm border-cyan-200">
                          {/* モバイル表示 */}
                          <div className="md:hidden">
                            <div 
                              className="flex items-center gap-2 cursor-pointer"
                              onClick={() => setExpandedDisclosure(expandedDisclosure === disclosure.id ? null : disclosure.id)}
                            >
                              {/* N分前 */}
                              <div className="w-16 text-center text-sm font-medium text-cyan-700">
                                {formatTimeAgo(disclosure.timestamp)}
                              </div>
                              
                              {/* 会社名 */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-sm truncate text-cyan-800">{disclosure.company}</h3>
                              </div>
                              
                              {/* カテゴリ */}
                              <div className="w-28 text-center">
                                <Badge variant="outline" className="text-sm px-2 py-1 border-cyan-300 text-cyan-700 bg-cyan-50">{disclosure.category}</Badge>
                              </div>
                            </div>
                            
                            {/* 詳細情報（展開時） */}
                            {expandedDisclosure === disclosure.id && (
                              <div className="mt-3 pt-3 border-t border-cyan-200 space-y-3">
                                {/* タイトル */}
                                <div>
                                  <div className="text-xs text-cyan-600 mb-2">タイトル</div>
                                  <a 
                                    href={disclosure.pdf_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {disclosure.title}
                                    <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                  </a>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4 text-center">
                                  {/* 詳細時刻 */}
                                  <div>
                                    <div className="text-xs text-cyan-600">時刻</div>
                                    <div className="text-sm font-medium text-cyan-800">{formatDate(disclosure.timestamp)}</div>
                                  </div>
                                  {/* 証券コード */}
                                  <div>
                                    <div className="text-xs text-cyan-600">証券コード</div>
                                    <div className="text-sm font-medium text-cyan-800">{disclosure.code}</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* デスクトップ表示 */}
                          <div className="hidden md:block overflow-x-auto">
                            <div className="flex items-center gap-3 min-w-fit">
                              {/* N分前 */}
                              <div className="w-16 text-center text-xs md:text-sm font-medium text-cyan-700">
                                {formatTimeAgo(disclosure.timestamp)}
                              </div>
                              
                              {/* 時刻 */}
                              <div className="w-32 text-center text-xs md:text-sm font-mono text-cyan-700">
                                {formatDate(disclosure.timestamp)}
                              </div>
                              
                              {/* 会社名 */}
                              <div className="w-32 min-w-0">
                                <h3 className="font-bold text-sm md:text-lg truncate text-cyan-800">{disclosure.company}</h3>
                              </div>
                              
                              {/* 証券コード */}
                              <div className="w-16 text-center text-xs md:text-sm font-medium text-cyan-700">
                                {disclosure.code}
                              </div>
                              
                              {/* カテゴリ */}
                              <div className="w-28 text-center">
                                <Badge variant="outline" className="text-xs md:text-sm px-2 py-1 border-cyan-300 text-cyan-700 bg-cyan-50">{disclosure.category}</Badge>
                              </div>
                              
                              {/* マーク */}
                              <div className="w-16 flex items-center justify-center gap-1">
                                {/* 実際のEVO保有マーク */}
                                {evoStocks.length > 0 && isEvoHolding(disclosure.code) && (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-xs bg-green-100 text-green-700 border-green-300 cursor-pointer hover:bg-green-200 transition-all duration-200 hover:scale-105 px-1 py-0"
                                    onClick={(e) => handleEVOClick(e, disclosure.code)}
                                  >
                                    EVO
                                  </Badge>
                                )}
                                {/* 実際のテクニカル発生銘柄マーク */}
                                {technicalStocks.length > 0 && isTechnicalStock(disclosure.code) && (
                                  <Badge 
                                    variant="secondary" 
                                    className="text-xs bg-purple-100 text-purple-700 border-purple-300 cursor-pointer hover:bg-purple-200 transition-all duration-200 hover:scale-105 px-1 py-0"
                                    onClick={(e) => handleTechnicalClick(e, disclosure.code)}
                                  >
                                    テク
                                  </Badge>
                                )}
                              </div>
                              
                              {/* タイトル */}
                              <div className="flex-1 min-w-0">
                                <a 
                                  href={disclosure.pdf_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="hover:text-blue-600 hover:underline flex items-center gap-1 text-xs md:text-sm text-cyan-800 transition-colors"
                                >
                                  <div className="line-clamp-2">{disclosure.title}</div>
                                  <ExternalLink className="h-4 w-4 flex-shrink-0" />
                                </a>
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))
                    )}
                </div>

                <Pagination />
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* EVO保有銘柄タブ */}
          <TabsContent value="evo-stocks" className="mt-16">
            <div className="mt-14 md:mt-0">
            <Card className="bg-white/90 backdrop-blur-sm border-cyan-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-cyan-600" />
                    <span className="text-cyan-800">EVO保有銘柄</span>
                  </div>
                  <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-300">{totalCount}銘柄</Badge>
                </CardTitle>
                <CardDescription>
                  <div className="flex items-center justify-between">
                    <div className="text-cyan-700">
                      EVOファンドの保有銘柄と保有割合を確認できます
                      {evoStocks.length > 0 && (
                        <div className="text-sm text-cyan-600 mt-1">
                          更新日時: {formatDate(evoStocks[0].updated_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 検索・フィルター */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" />
                      <Input
                        placeholder="会社名・コード検索"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 text-sm bg-white/80 border-cyan-200 focus:border-cyan-400 focus:ring-cyan-400"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                    </div>
                    <Button onClick={handleSearch} disabled={loading} variant="outline" size="icon" className="border-cyan-200 text-cyan-600 hover:bg-cyan-50 hover:border-cyan-300 transition-colors">
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                  <Button onClick={handleRefresh} variant="outline" size="icon" className="border-cyan-200 text-cyan-600 hover:bg-cyan-50 hover:border-cyan-300 transition-colors">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  </div>
                </div>

                {/* ヘッダー行 */}
                <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 mb-3 border border-cyan-200">
                  <div className="flex items-center gap-2 md:gap-4">
                    <div className="w-6 h-6 md:w-8 md:h-8 text-center text-xs md:text-sm font-semibold text-cyan-700">#</div>
                    <div 
                      className={`w-12 md:w-16 text-center text-xs md:text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("code")}`}
                      onClick={() => handleSort("code")}
                    >
                      コード
                    </div>
                    <div 
                      className={`flex-1 text-left text-xs md:text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("company")}`}
                      onClick={() => handleSort("company")}
                    >
                      会社名
                    </div>
                    <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm font-semibold text-cyan-700">マーク</div>
                    <div className="flex items-center gap-2 md:gap-3 text-xs md:text-sm font-semibold text-cyan-700">
                      <div 
                        className={`w-20 md:w-32 text-center cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("holding_ratio")}`}
                        onClick={() => handleSort("holding_ratio")}
                      >
                        保有割合
                      </div>
                      <div className="hidden md:block w-12 md:w-16 text-center">%</div>
                    </div>
                  </div>
                </div>

                {/* データカード */}
                <div className="space-y-3">
                      {loading ? (
                    <div className="text-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-cyan-600" />
                            <span className="text-cyan-700">データを読み込み中...</span>
                    </div>
                      ) : evoStocks.length === 0 ? (
                    <div className="text-center py-8 text-cyan-600">
                            データがありません
                    </div>
                      ) : (
                        evoStocks.map((stock, index) => (
                      <Card key={stock.id} className="p-3 md:p-4 hover:shadow-xl transition-all duration-300 hover:scale-[1.01] bg-white/80 backdrop-blur-sm border-cyan-200">
                        <div className="flex items-center gap-2 md:gap-4">
                          {/* 番号 */}
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-gradient-to-r from-cyan-100 to-blue-100 flex items-center justify-center text-xs md:text-sm font-bold text-cyan-700">
                            {index + 1}
                          </div>
                          
                          {/* 証券コード */}
                          <div className="w-12 md:w-16 text-center text-xs md:text-sm font-medium text-cyan-700">
                            {stock.code}
                          </div>
                          
                          {/* 会社名 */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-sm md:text-lg truncate text-cyan-800">{stock.company}</h3>
                          </div>
                          
                          {/* マーク */}
                          <div className="flex items-center gap-1 md:gap-2">
                            {/* 適時開示ありマーク */}
                            {hasRecentDisclosure(stock.code) && (
                              <Badge 
                                variant="secondary" 
                                className="text-xs bg-cyan-100 text-cyan-700 border-cyan-300 cursor-pointer hover:bg-cyan-200 transition-all duration-200 hover:scale-105 px-1 py-0"
                                onClick={(e) => handleIRClick(e, stock.code)}
                              >
                                IR
                              </Badge>
                            )}
                            {/* テクニカル発生銘柄マーク */}
                            {isTechnicalStock(stock.code) && (
                              <Badge 
                                variant="secondary" 
                                className="text-xs bg-cyan-100 text-cyan-700 border-cyan-300 cursor-pointer hover:bg-cyan-200 transition-all duration-200 hover:scale-105 px-1 py-0"
                                onClick={(e) => handleTechnicalClick(e, stock.code)}
                              >
                                テク
                              </Badge>
                            )}
                          </div>
                          
                          {/* 保有割合 */}
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-20 md:w-32">
                              {/* モバイルでは棒グラフの上に保有割合を表示 */}
                              <div className="text-xs text-cyan-700 text-center mb-1 md:hidden">
                                {stock.holding_ratio}%
                              </div>
                              <div className="w-full bg-cyan-200 rounded-full h-2 md:h-3 shadow-inner">
                                <div
                                  className="h-2 md:h-3 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-cyan-400 to-blue-500"
                                  style={{ width: `${Math.min(stock.holding_ratio, 100)}%` }}
                                ></div>
                                </div>
                              </div>
                            <div className="hidden md:block text-sm md:text-xl font-bold text-cyan-600 min-w-[3rem] md:min-w-[4rem] text-right">
                              {stock.holding_ratio}%
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>

                <Pagination />
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* テクニカル発生銘柄タブ */}
          <TabsContent value="technical-stocks" className="mt-16">
            <div className="mt-14 md:mt-0">
            <Card className="bg-white/90 backdrop-blur-sm border-cyan-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-cyan-600" />
                  <span className="text-cyan-800">テクニカル発生銘柄</span>
                  </div>
                  <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-300">{totalCount}銘柄</Badge>
                </CardTitle>
                <CardDescription>
                  <div className="flex items-center justify-between">
                    <div className="text-cyan-700">
                      テクニカル分析に基づく注目銘柄
                      {technicalStocks.length > 0 && (
                        <div className="text-sm text-cyan-600 mt-1">
                          更新日時: {formatDate(technicalStocks[0].fetched_at)}
                        </div>
                      )}
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 検索・フィルター */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" />
                      <Input
                        placeholder="会社名・コード検索"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 text-sm bg-white/80 border-cyan-200 focus:border-cyan-400 focus:ring-cyan-400"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                </div>
                    <Button onClick={handleSearch} disabled={loading} variant="outline" size="icon" className="border-cyan-200 text-cyan-600 hover:bg-cyan-50 hover:border-cyan-300 transition-colors">
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                    <Button onClick={handleRefresh} variant="outline" size="icon" className="border-cyan-200 text-cyan-600 hover:bg-cyan-50 hover:border-cyan-300 transition-colors">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* ヘッダー行 - モバイル */}
                <div className="md:hidden bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 mb-3 border border-cyan-200">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 text-center text-xs font-semibold text-cyan-700">#</div>
                    <div 
                      className={`flex-1 text-left text-xs font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("company")}`}
                      onClick={() => handleSort("company")}
                    >
                      会社名
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold text-cyan-700">マーク</div>
                    <div 
                      className={`w-16 text-center text-xs font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("price")}`}
                      onClick={() => handleSort("price")}
                    >
                      株価
                    </div>
                    <div 
                      className={`w-20 text-center text-xs font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("change_rate")}`}
                      onClick={() => handleSort("change_rate")}
                    >
                      騰落率
                    </div>
                  </div>
                </div>

                {/* ヘッダー行 - デスクトップ */}
                <div className="hidden md:block bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-3 mb-3 overflow-x-auto border border-cyan-200">
                  <div className="flex items-center gap-3 min-w-fit">
                    <div className="w-8 text-center text-sm font-semibold text-cyan-700">#</div>
                    <div 
                      className={`w-16 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("code")}`}
                      onClick={() => handleSort("code")}
                    >
                      コード
                    </div>
                    <div 
                      className={`w-32 text-left text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("company")}`}
                      onClick={() => handleSort("company")}
                    >
                      会社名
                    </div>
                    <div className="w-16 text-center text-sm font-semibold text-cyan-700">マーク</div>
                    <div 
                      className={`w-20 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("price")}`}
                      onClick={() => handleSort("price")}
                    >
                      株価
                    </div>
                    <div 
                      className={`w-16 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("per")}`}
                      onClick={() => handleSort("per")}
                    >
                      PER
                    </div>
                    <div 
                      className={`w-16 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("pbr")}`}
                      onClick={() => handleSort("pbr")}
                    >
                      PBR
                    </div>
                    <div 
                      className={`w-20 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("ma5")}`}
                      onClick={() => handleSort("ma5")}
                    >
                      5日MA
                    </div>
                    <div 
                      className={`w-20 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("ma25")}`}
                      onClick={() => handleSort("ma25")}
                    >
                      25日MA
                    </div>
                    <div 
                      className={`w-20 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("yield_rate")}`}
                      onClick={() => handleSort("yield_rate")}
                    >
                      配当利回り
                    </div>
                    <div 
                      className={`w-32 text-center text-sm font-semibold cursor-pointer rounded px-1 py-1 transition-colors ${getSortColor("change_rate")}`}
                      onClick={() => handleSort("change_rate")}
                    >
                      騰落率
                    </div>
                    <div className="w-16 text-center text-sm font-semibold text-cyan-700">%</div>
                  </div>
                </div>

                {/* データテーブル */}
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-cyan-600" />
                      <span className="text-cyan-700">データを読み込み中...</span>
                    </div>
                  ) : technicalStocks.length === 0 ? (
                    <div className="text-center py-8 text-cyan-600">
                      データがありません
                    </div>
                  ) : (
                    technicalStocks.map((stock, index) => (
                      <Card 
                        key={stock.id} 
                        className="p-3 md:p-4 hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.01] bg-white/80 backdrop-blur-sm border-cyan-200" 
                      >
                        {/* モバイル表示 */}
                        <div className="md:hidden">
                          <div 
                            className="flex items-center gap-2"
                            onClick={() => setExpandedTechnicalStock(expandedTechnicalStock === stock.id ? null : stock.id)}
                          >
                            {/* 番号 */}
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-100 to-blue-100 flex items-center justify-center text-xs font-bold text-cyan-700">
                              {index + 1}
                            </div>
                            
                            {/* 会社名 */}
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-sm truncate text-cyan-800">{stock.company}</h3>
                            </div>
                            
                            {/* マーク */}
                            <div className="flex items-center gap-1">
                              {/* EVO保有マーク */}
                              {isEvoHolding(stock.code) && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs bg-cyan-100 text-cyan-700 border-cyan-300 cursor-pointer hover:bg-cyan-200 transition-all duration-200 hover:scale-105 px-1 py-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEVOClick(e, stock.code)
                                  }}
                                >
                                  EVO
                                </Badge>
                              )}
                              {/* 適時開示ありマーク */}
                              {hasRecentDisclosure(stock.code) && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs bg-cyan-100 text-cyan-700 border-cyan-300 cursor-pointer hover:bg-cyan-200 transition-all duration-200 hover:scale-105 px-1 py-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleIRClick(e, stock.code)
                                  }}
                                >
                                  IR
                                </Badge>
                              )}
                            </div>
                            
                            {/* 株価 */}
                            <div className="w-16 text-center text-xs font-medium text-cyan-700">
                              {stock.price !== null ? `¥${stock.price.toLocaleString()}` : "-"}
                            </div>
                            
                            {/* 騰落率 */}
                            <div className="w-20 text-center">
                              <div className="text-xs text-cyan-700 mb-1">
                                {stock.change_rate !== null ? `${stock.change_rate.toFixed(2)}%` : "-"}
                              </div>
                              <div className="w-full bg-cyan-200 rounded-full h-2 shadow-inner">
                                {stock.change_rate !== null && (
                                  <div
                                    className={`h-2 rounded-full transition-all duration-500 ease-out ${
                                      stock.change_rate >= 0 ? 'bg-gradient-to-r from-cyan-400 to-blue-500' : 'bg-gradient-to-r from-red-400 to-rose-500'
                                    }`}
                                    style={{ 
                                      width: `${Math.min(Math.abs(stock.change_rate) * 10, 100)}%`,
                                      marginLeft: stock.change_rate < 0 ? `${100 - Math.min(Math.abs(stock.change_rate) * 10, 100)}%` : '0'
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* 詳細情報（展開時） */}
                          {expandedTechnicalStock === stock.id && (
                            <div className="mt-3 pt-3 border-t border-cyan-200">
                              <div className="grid grid-cols-3 gap-2 text-center">
                                {/* 証券コード */}
                                <div>
                                  <div className="text-xs text-cyan-600">コード</div>
                                  <div className="text-sm font-medium text-cyan-800">{stock.code}</div>
                                </div>
                                {/* PER */}
                                <div>
                                  <div className="text-xs text-cyan-600">PER</div>
                                  <div className="text-sm font-medium text-cyan-800">{stock.per !== null ? `${stock.per.toFixed(2)}倍` : "-"}</div>
                                </div>
                                {/* PBR */}
                                <div>
                                  <div className="text-xs text-cyan-600">PBR</div>
                                  <div className="text-sm font-medium text-cyan-800">{stock.pbr !== null ? `${stock.pbr.toFixed(2)}倍` : "-"}</div>
                                </div>
                                {/* 5日MA */}
                                <div>
                                  <div className="text-xs text-cyan-600">5日MA</div>
                                  <div className="text-sm font-medium text-cyan-800">{stock.ma5 !== null ? `¥${stock.ma5.toLocaleString()}` : "-"}</div>
                                </div>
                                {/* 25日MA */}
                                <div>
                                  <div className="text-xs text-cyan-600">25日MA</div>
                                  <div className="text-sm font-medium text-cyan-800">{stock.ma25 !== null ? `¥${stock.ma25.toLocaleString()}` : "-"}</div>
                                </div>
                                {/* 配当利回り */}
                                <div>
                                  <div className="text-xs text-cyan-600">配当利回り</div>
                                  <div className="text-sm font-medium text-cyan-800">{stock.yield_rate !== null ? `${stock.yield_rate.toFixed(2)}%` : "-"}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* デスクトップ表示 */}
                        <div className="hidden md:block overflow-x-auto">
                          <div className="flex items-center gap-3 min-w-fit">
                            {/* 番号 */}
                            <div className="w-8 rounded-full bg-gradient-to-r from-cyan-100 to-blue-100 flex items-center justify-center text-sm font-bold text-cyan-700 h-8">
                              {index + 1}
                            </div>
                            
                            {/* 証券コード */}
                            <div className="w-16 text-center text-sm font-medium text-cyan-700">
                              {stock.code}
                            </div>
                            
                            {/* 会社名 */}
                            <div className="w-32 min-w-0">
                              <h3 className="font-bold text-sm truncate text-cyan-800">{stock.company}</h3>
                            </div>
                            
                            {/* マーク */}
                            <div className="w-16 flex items-center justify-center gap-1">
                              {/* EVO保有マーク */}
                              {isEvoHolding(stock.code) && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs bg-cyan-100 text-cyan-700 border-cyan-300 cursor-pointer hover:bg-cyan-200 transition-all duration-200 hover:scale-105 px-1 py-0"
                                  onClick={(e) => handleEVOClick(e, stock.code)}
                                >
                                  EVO
                                </Badge>
                              )}
                              {/* 適時開示ありマーク */}
                              {hasRecentDisclosure(stock.code) && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs bg-cyan-100 text-cyan-700 border-cyan-300 cursor-pointer hover:bg-cyan-200 transition-all duration-200 hover:scale-105 px-1 py-0"
                                  onClick={(e) => handleIRClick(e, stock.code)}
                                >
                                  IR
                                </Badge>
                              )}
                            </div>
                            
                            {/* 株価 */}
                            <div className="w-20 text-center text-sm font-medium text-cyan-700">
                              {stock.price !== null ? `¥${stock.price.toLocaleString()}` : "-"}
                            </div>
                            
                            {/* PER */}
                            <div className="w-16 text-center text-sm font-medium text-cyan-700">
                              {stock.per !== null ? `${stock.per.toFixed(2)}倍` : "-"}
                            </div>
                            
                            {/* PBR */}
                            <div className="w-16 text-center text-sm font-medium text-cyan-700">
                              {stock.pbr !== null ? `${stock.pbr.toFixed(2)}倍` : "-"}
                            </div>
                            
                            {/* 5日MA */}
                            <div className="w-20 text-center text-sm font-medium text-cyan-700">
                              {stock.ma5 !== null ? `¥${stock.ma5.toLocaleString()}` : "-"}
                            </div>
                            
                            {/* 25日MA */}
                            <div className="w-20 text-center text-sm font-medium text-cyan-700">
                              {stock.ma25 !== null ? `¥${stock.ma25.toLocaleString()}` : "-"}
                            </div>
                            
                            {/* 配当利回り */}
                            <div className="w-20 text-center text-sm font-medium text-cyan-700">
                              {stock.yield_rate !== null ? `${stock.yield_rate.toFixed(2)}%` : "-"}
                            </div>
                            
                            {/* 騰落率 */}
                            <div className="w-32 flex items-center">
                              <div className="w-full bg-cyan-200 rounded-full h-3 shadow-inner">
                                {stock.change_rate !== null && (
                                  <div
                                    className={`h-3 rounded-full transition-all duration-500 ease-out ${
                                      stock.change_rate >= 0 ? 'bg-gradient-to-r from-cyan-400 to-blue-500' : 'bg-gradient-to-r from-red-400 to-rose-500'
                                    }`}
                                    style={{ 
                                      width: `${Math.min(Math.abs(stock.change_rate) * 10, 100)}%`,
                                      marginLeft: stock.change_rate < 0 ? `${100 - Math.min(Math.abs(stock.change_rate) * 10, 100)}%` : '0'
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                            
                            {/* 騰落率パーセント */}
                            <div className="w-16 text-center text-lg font-bold text-cyan-600">
                              {stock.change_rate !== null ? `${stock.change_rate.toFixed(2)}%` : "-"}
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>

                <Pagination />
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* おすすめ学習教材タブ */}
          <TabsContent value="recommended-notes" className="mt-16">
            <div className="mt-14 md:mt-0">
            <Card className="bg-white/90 backdrop-blur-sm border-cyan-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-cyan-600" />
                    <span className="text-cyan-800">おすすめ学習教材</span>
                  </div>
                  <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 border-cyan-300">{totalCount}記事</Badge>
                </CardTitle>
                <CardDescription>
                  <div className="flex items-center justify-between">
                    <div className="text-cyan-700">
                      投資に役立つ学習教材をピックアップ
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* 検索・フィルター */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-500" />
                      <Input
                        placeholder="タイトル・詳細検索"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 text-sm bg-white/80 border-cyan-200 focus:border-cyan-400 focus:ring-cyan-400"
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      />
                    </div>
                    <Button onClick={handleSearch} disabled={loading} variant="outline" size="icon" className="border-cyan-200 text-cyan-600 hover:bg-cyan-50 hover:border-cyan-300 transition-colors">
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                    <Button onClick={handleRefresh} variant="outline" size="icon" className="border-cyan-200 text-cyan-600 hover:bg-cyan-50 hover:border-cyan-300 transition-colors">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                                {/* データカード */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {loading ? (
                    <div className="col-span-full text-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-cyan-600" />
                      <span className="text-cyan-700">データを読み込み中...</span>
                    </div>
                  ) : recommendedNotes.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-cyan-600">
                      データがありません
                    </div>
                  ) : (
                    recommendedNotes.map((note) => {
                      // ダミーデータの売り切れフラグを使用
                      const isSoldOut = note.sold_out || false
                      
                      return (
                      <Card key={note.id} className={`relative overflow-hidden transition-all duration-300 border-cyan-200 ${isSoldOut ? 'bg-gray-100/80' : 'hover:shadow-xl hover:scale-[1.02] bg-white/80'} backdrop-blur-sm`}>
                        {/* 売り切れオーバーレイ */}
                        {isSoldOut && (
                          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                            <div className="transform -rotate-45 bg-red-500 text-white font-bold px-8 py-2 text-lg shadow-lg opacity-100">
                              売り切れ
                            </div>
                          </div>
                        )}
                        
                        {/* 売り切れ時のコンテンツオーバーレイ */}
                        {isSoldOut && (
                          <div className="absolute inset-0 z-40 bg-gray-200/60 pointer-events-none"></div>
                        )}
                        
                        {/* 画像 */}
                        {note.image_url && (
                          <div className="relative h-36 md:h-48 w-full overflow-hidden">
                            <Image
                              src={note.image_url}
                              alt={note.title}
                              fill
                              className="object-cover transition-transform duration-300 hover:scale-105"
                            />
                          </div>
                        )}
                        
                        <CardContent className="p-3 md:p-4">
                          {/* 順位バッジ & いいね数 */}
                          <div className="flex items-center justify-between mb-2 md:mb-3">
                            <Badge variant={note.rank <= 3 ? "default" : "secondary"} className={`text-xs ${note.rank <= 3 ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white' : 'bg-cyan-100 text-cyan-800 border-cyan-300'}`}>
                              {note.rank}位
                            </Badge>
                            <div className="flex items-center gap-1">
                              <span className="text-red-500">♡</span>
                              <span className="text-xs md:text-sm text-cyan-600">{note.like_count || 0}</span>
                            </div>
                          </div>
                          
                          {/* タイトル */}
                          <h3 className="font-bold text-sm md:text-lg mb-2 line-clamp-2 text-cyan-800">
                            {note.title}
                          </h3>
                          
                          {/* 説明 */}
                          <p className="text-xs md:text-sm text-cyan-700 mb-3 md:mb-4 line-clamp-3">
                            {note.description}
                          </p>
                          
                          {/* 価格 */}
                          <div className="flex items-center justify-between mb-3 md:mb-4">
                            <div className="text-lg md:text-xl font-bold">
                              {isSoldOut ? (
                                <span className="text-red-600">売り切れ</span>
                              ) : note.price ? (
                                <span className="text-cyan-600">¥{note.price.toLocaleString()}</span>
                              ) : (
                                <span className="text-blue-600">無料</span>
                              )}
                            </div>
                            <span className="text-xs md:text-sm text-cyan-600">{formatTimeAgo(note.published_at || note.created_at)}</span>
                          </div>
                          
                          {/* 作者情報 */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {note.author_icon_url ? (
                                <Image
                                  src={note.author_icon_url}
                                  alt={note.author_name || "作者"}
                                  width={32}
                                  height={32}
                                  className="rounded-full"
                                />
                              ) : (
                                <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-r from-cyan-100 to-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-xs md:text-sm font-medium text-cyan-700">
                                    {note.author_name ? note.author_name.charAt(0) : "?"}
                                  </span>
                                </div>
                              )}
                              <div>
                                <p className="text-xs md:text-sm font-medium text-cyan-800">{note.author_name || "名前なし"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {note.genre && (
                                <Badge variant="outline" className="text-xs border-cyan-300 text-cyan-700">{note.genre}</Badge>
                              )}
                              <Button variant="ghost" size="sm" asChild className="hover:bg-cyan-50 transition-colors">
                                <a href={note.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 md:h-4 md:w-4 text-cyan-600" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      )
                    })
                  )}
                </div>

                <Pagination />
              </CardContent>
            </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
