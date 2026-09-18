# kakeibo-server

「ふたりの家計簿」の公開Webアプリ版バックエンド（Node.js + Express + Prisma + PostgreSQL）。
`server/` の一つ上の階層にある `index.html` / `styles.css` / `js/` をそのまま配信し、
`/api/*` でREST APIを提供する（同一オリジンなのでCORS設定は不要）。

## 1. ローカルで動かす

```bash
cd server
cp .env.example .env      # 値を編集する（下記参照）
npm install
npm run migrate:dev        # 初回のみ: テーブルを作成
npm run dev
```

ブラウザで `http://localhost:3000` を開く。**VSCodeのLive Serverではなく、この
Node サーバーを起点にする**必要がある（フロントとAPIが同じオリジンでないと
Cookieセッションが機能しないため）。

### .env の値

| 変数 | 説明 |
|---|---|
| `DATABASE_URL` | PostgreSQL接続文字列。ローカルなら `postgresql://user:pass@localhost:5432/kakeibo`、本番はNeonが発行するもの |
| `SESSION_SECRET` | ランダムな長い文字列。`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` で生成 |
| `ANTHROPIC_API_KEY` | 運営者自身のAnthropic APIキー。レシート解析（`/api/receipts/scan`）にのみ使用 |
| `ANTHROPIC_MODEL` | 使用するモデルID。[docs.claude.com/en/docs/about-claude/models](https://docs.claude.com/en/docs/about-claude/models) で現在の画像対応モデルを確認して設定する（時間が経つとモデル名が変わるため、コード側にはデフォルト値を持たせていない） |
| `RECEIPT_SCAN_HOUSEHOLD_MONTHLY_LIMIT` | 1世帯あたりの月間レシート解析回数の上限（デフォルト100） |
| `RECEIPT_SCAN_GLOBAL_DAILY_LIMIT` | 全世帯合計の1日あたりの上限（デフォルト200）。運営者のAPIキー1本で動くため、想定外の課金を防ぐための全体キャップ |

## 2. データベースのテーブル構成

`prisma/schema.prisma` を参照。`npm run migrate:dev`（開発）/ `npm run migrate`
（本番、`prisma migrate deploy`）でマイグレーションを適用する。

## 3. 無料枠でのデプロイ（Neon + Render）

1. **Neon.tech** で無料のPostgreSQLプロジェクトを作成し、接続文字列を控える。
2. GitHubリポジトリ（`h-momoka/Kakeibo-app`）を **Render.com** に接続し、
   「Web Service」を新規作成する。
   - Root Directory: `server`
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `npm run migrate && npm start`
   - Plan: Free
3. Renderの環境変数に上記 `.env` の内容（`DATABASE_URL` はNeonのものに差し替え）を設定する。
4. デプロイ後、`https://<service名>.onrender.com` で公開される。無料プランは
   一定時間アクセスがないとスリープするため、初回アクセス時に数十秒かかることがある。

実費が発生し得るのはAnthropic APIの実利用分のみ。NeonとRenderは無料枠の範囲で運用できる。

## 4. Apidogでの動作確認

`openapi.yaml`（このリポジトリのルート）をApidogに **Import > OpenAPI** でインポートすると、
全エンドポイントがまとまった状態で試せる。ログインが必要なエンドポイントは、先に
`/api/auth/login` などでCookieを取得した状態のセッションで叩く（Apidogのcookie jar機能を使う）。

## 5. 既知の制約 / 今後の検討事項

- リアルタイム同期はWebSocketではなくポーリング（15〜30秒間隔 + タブがフォーカスされた時）。
  二人分のリアルタイム性を重視するなら、後日 SSE や WebSocket への切り替えを検討できる。
- レシート画像はPostgreSQLに直接保存している（`receipt_assets.image_bytes`）。将来的に
  画像点数が増える場合は、S3互換の無料枠オブジェクトストレージへ切り出す余地がある。
- このサンドボックス環境では npm レジストリへの接続が一時的に不安定で、
  `npm install` や自動テストの実行を最後まで確認できなかった。コードはすべて
  `node --check` で構文検証済みだが、**初回セットアップ時は手順1を実際に
  実行して動作確認してほしい**。
