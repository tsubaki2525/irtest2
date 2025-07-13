-- テクニカル発生銘柄テーブルの作成

-- 既存のテーブルを削除（存在する場合）
DROP TABLE IF EXISTS public.technical_stocks;

-- テクニカル発生銘柄テーブルを作成
CREATE TABLE public.technical_stocks (
    id BIGSERIAL PRIMARY KEY,
    company VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    market VARCHAR(50),
    price NUMERIC(10,2),
    change NUMERIC(10,2),
    change_rate NUMERIC(6,2),
    ma5 NUMERIC(10,2),
    ma25 NUMERIC(10,2),
    market_cap NUMERIC(15,2),
    per NUMERIC(8,2),
    pbr NUMERIC(6,2),
    yield_rate NUMERIC(6,2),
    liquidity TEXT,
    fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックスを作成
CREATE INDEX idx_technical_stocks_code ON public.technical_stocks(code);
CREATE INDEX idx_technical_stocks_company ON public.technical_stocks(company);
CREATE INDEX idx_technical_stocks_market ON public.technical_stocks(market);
CREATE INDEX idx_technical_stocks_price ON public.technical_stocks(price);
CREATE INDEX idx_technical_stocks_change_rate ON public.technical_stocks(change_rate DESC);
CREATE INDEX idx_technical_stocks_fetched_at ON public.technical_stocks(fetched_at DESC);

-- 全文検索用インデックス
CREATE INDEX idx_technical_stocks_company_search ON public.technical_stocks USING gin(to_tsvector('japanese', company));

-- RLSを有効化
ALTER TABLE public.technical_stocks ENABLE ROW LEVEL SECURITY;

-- 匿名ユーザーに読み取り権限を付与
CREATE POLICY "Allow anonymous read access" ON public.technical_stocks
    FOR SELECT
    TO anon
    USING (true);

-- 認証済みユーザーに全権限を付与
CREATE POLICY "Allow authenticated full access" ON public.technical_stocks
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- サービスロールに全権限を付与
CREATE POLICY "Allow service role full access" ON public.technical_stocks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- updated_atを自動更新するトリガー関数（既に存在する場合はスキップ）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_atを自動更新するトリガー
CREATE TRIGGER update_technical_stocks_updated_at
    BEFORE UPDATE ON public.technical_stocks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- テスト用のダミーデータを挿入
INSERT INTO public.technical_stocks (company, code, market, price, change, change_rate, ma5, ma25, market_cap, per, pbr, yield_rate, liquidity, fetched_at) VALUES
('エムスリー', '2413', '東証プライム', 1250.00, 40.00, 3.2, 1210.00, 1180.00, 850000.00, 25.5, 4.2, 0.8, '○', NOW()),
('サイバーエージェント', '4751', '東証プライム', 890.50, 25.00, 2.8, 875.00, 860.00, 480000.00, 18.3, 2.1, 0.0, '○', NOW()),
('メルカリ', '4385', '東証プライム', 450.00, 23.00, 5.1, 435.00, 420.00, 290000.00, 35.2, 3.8, 0.0, '△', NOW()),
('ラクスル', '4384', '東証グロース', 320.00, 15.00, 4.7, 310.00, 305.00, 48000.00, 65.5, 8.2, 0.0, '○', NOW()),
('フリー', '4478', '東証マザーズ', 280.00, 5.30, 1.9, 275.00, 270.00, 42000.00, 28.7, 6.5, 0.0, '○', NOW()),
('チームラボ', '3960', '東証グロース', 180.00, 11.30, 6.3, 175.00, 165.00, 18000.00, 45.2, 12.3, 0.0, '△', NOW()),
('ベイカレント', '6532', '東証プライム', 3400.00, 71.00, 2.1, 3350.00, 3280.00, 125000.00, 22.8, 3.4, 1.2, '○', NOW()),
('ロゼッタ', '6182', '東証グロース', 890.00, 43.00, 4.8, 870.00, 850.00, 32000.00, 38.9, 5.7, 0.0, '△', NOW());

-- テーブル作成完了メッセージ
SELECT 'テクニカル発生銘柄テーブルが正常に作成されました' AS message; 