-- 適時開示情報テーブル作成
CREATE TABLE disclosures (
  id SERIAL PRIMARY KEY,
  company VARCHAR(255) NOT NULL,
  code VARCHAR(10) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  category VARCHAR(100) NOT NULL,
  title TEXT NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス作成（高速検索用）
CREATE INDEX idx_disclosures_timestamp ON disclosures(timestamp DESC);
CREATE INDEX idx_disclosures_company ON disclosures(company);
CREATE INDEX idx_disclosures_category ON disclosures(category);
CREATE INDEX idx_disclosures_code ON disclosures(code);

-- 全文検索用インデックス（日本語対応）
CREATE INDEX idx_disclosures_title_search ON disclosures USING gin(to_tsvector('japanese', title));
CREATE INDEX idx_disclosures_company_search ON disclosures USING gin(to_tsvector('japanese', company));

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
