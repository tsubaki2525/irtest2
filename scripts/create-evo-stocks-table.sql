-- Evo保有銘柄テーブルの作成

-- 既存のテーブルを削除（存在する場合）
DROP TABLE IF EXISTS public.evo_stocks;

-- Evo保有銘柄テーブルを作成
CREATE TABLE public.evo_stocks (
    id BIGSERIAL PRIMARY KEY,
    company TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    holding_ratio DECIMAL(5,2) NOT NULL CHECK (holding_ratio >= 0 AND holding_ratio <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックスを作成
CREATE INDEX idx_evo_stocks_code ON public.evo_stocks(code);
CREATE INDEX idx_evo_stocks_company ON public.evo_stocks(company);
CREATE INDEX idx_evo_stocks_holding_ratio ON public.evo_stocks(holding_ratio DESC);

-- RLSを有効化
ALTER TABLE public.evo_stocks ENABLE ROW LEVEL SECURITY;

-- 匿名ユーザーに読み取り権限を付与
CREATE POLICY "Allow anonymous read access" ON public.evo_stocks
    FOR SELECT
    TO anon
    USING (true);

-- 認証済みユーザーに全権限を付与
CREATE POLICY "Allow authenticated full access" ON public.evo_stocks
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- サービスロールに全権限を付与
CREATE POLICY "Allow service role full access" ON public.evo_stocks
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- updated_atを自動更新するトリガー関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- updated_atを自動更新するトリガー
CREATE TRIGGER update_evo_stocks_updated_at
    BEFORE UPDATE ON public.evo_stocks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- テーブル作成完了メッセージ
SELECT 'Evo保有銘柄テーブルが正常に作成されました' AS message;
