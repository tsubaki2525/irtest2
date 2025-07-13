# Vercelへのデプロイ手順

## 📋 事前準備

### 必要なアカウント
- [ ] GitHubアカウント
- [ ] Vercelアカウント（無料で作成可能）
- [ ] Supabaseプロジェクト（環境変数用）

### 環境変数の準備
以下の値を事前に準備してください：
- `NEXT_PUBLIC_SUPABASE_URL`: SupabaseプロジェクトのURL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabaseの匿名キー

## 🚀 デプロイ方法

### 方法1: Vercel CLIを使用（推奨）

1. **Vercel CLIのインストール**
```bash
npm i -g vercel
```

2. **プロジェクトをデプロイ**
```bash
vercel
```

3. **プロンプトに従って設定**
- Set up and deploy? → `Y`
- Which scope? → あなたのアカウントを選択
- Link to existing project? → `N`（新規プロジェクトの場合）
- What's your project's name? → プロジェクト名を入力
- In which directory is your code located? → `./`
- Want to override the settings? → `N`

4. **環境変数の設定**
```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 方法2: GitHub経由でデプロイ

1. **GitHubにコードをプッシュ**
```bash
# 1. Gitリポジトリを初期化
git init

# 2. ユーザー情報を設定（初回のみ）
git config user.name "あなたの名前"
git config user.email "あなたのメールアドレス"

# 3. すべてのファイルをステージング
git add .

# 4. コミット
git commit -m "Initial commit - Teipick stock dashboard"

# 5. リモートリポジトリを追加
git remote add origin https://github.com/tsubaki2525/irtest.git

# 6. mainブランチに切り替え（必要な場合）
git branch -M main

# 7. プッシュ
git push -u origin main
```

もしプッシュ時に認証を求められた場合は、GitHubのユーザー名とパーソナルアクセストークン（パスワードではなく）を入力してください。

パーソナルアクセストークンの作成方法：
1. GitHub → Settings → Developer settings → Personal access tokens
2. "Generate new token"をクリック
3. 必要な権限（repo）を選択して作成

2. **Vercelでインポート**
- [vercel.com](https://vercel.com)にアクセス
- "New Project"をクリック
- GitHubリポジトリを選択してインポート

3. **環境変数を設定**
- Project Settings → Environment Variables
- 以下を追加：
  - Name: `NEXT_PUBLIC_SUPABASE_URL`
  - Value: あなたのSupabase URL
  - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Value: あなたのSupabase Anonキー

## ⚙️ デプロイ設定

### vercel.json の設定内容
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase_url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase_anon_key"
  }
}
```

## 🔍 デプロイ後の確認

1. **ビルドログの確認**
   - Vercelダッシュボードで"Functions"タブを確認
   - ビルドエラーがないか確認

2. **環境変数の確認**
   - Settings → Environment Variables
   - すべての必要な変数が設定されているか確認

3. **アプリケーションの動作確認**
   - デプロイされたURLにアクセス
   - 各タブが正常に動作するか確認
   - データが正しく表示されるか確認

## 🛠️ トラブルシューティング

### よくある問題と解決方法

#### 1. ビルドエラー
```
Error: Cannot find module
```
**解決策**: `package.json`の依存関係を確認し、`npm install`を実行

#### 2. 環境変数エラー
```
Error: Missing environment variables
```
**解決策**: Vercelダッシュボードで環境変数が正しく設定されているか確認

#### 3. API接続エラー
```
Error: Failed to fetch
```
**解決策**: 
- CORS設定を確認
- Supabaseの設定を確認
- 環境変数が正しいか確認

## 📝 追加の設定

### カスタムドメイン
1. Vercelダッシュボード → Settings → Domains
2. "Add Domain"をクリック
3. ドメインを追加してDNS設定を行う

### 自動デプロイ
- GitHubにプッシュすると自動的にデプロイされます
- プルリクエストごとにプレビューデプロイが作成されます

## 🎉 完了！

デプロイが成功したら、以下のURLでアクセスできます：
- 本番環境: `https://あなたのプロジェクト名.vercel.app`
- プレビュー環境: プルリクエストごとに自動生成 