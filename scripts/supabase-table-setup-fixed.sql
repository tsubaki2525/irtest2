-- 適時開示情報テーブル作成（修正版）
CREATE TABLE disclosures (
  id SERIAL PRIMARY KEY,
  company VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  category VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  pdf_url TEXT, -- SupabaseのパブリックURL
  
  -- 追加情報
  pdf_text TEXT, -- PDF全文
  summary TEXT, -- 要約
  post_link TEXT, -- ポストリンク
  status VARCHAR(100), -- 状況
  original_pdf_link TEXT, -- 元のPDFリンク
  acquired_time TIMESTAMPTZ, -- 取得日時
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 基本インデックス作成
CREATE INDEX idx_disclosures_timestamp ON disclosures(timestamp DESC);
CREATE INDEX idx_disclosures_company ON disclosures(company);
CREATE INDEX idx_disclosures_category ON disclosures(category);
CREATE INDEX idx_disclosures_code ON disclosures(code);

-- 簡易全文検索用インデックス（英語設定を使用）
CREATE INDEX idx_disclosures_title_search ON disclosures USING gin(to_tsvector('english', title));
CREATE INDEX idx_disclosures_company_search ON disclosures USING gin(to_tsvector('english', company));

-- 重複防止用ユニークインデックス
CREATE UNIQUE INDEX idx_disclosures_unique ON disclosures(code, title);

-- 更新日時の自動更新
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_disclosures_updated_at 
    BEFORE UPDATE ON disclosures 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
