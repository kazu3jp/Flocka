# Flocka

OpenDesignの「強みカードを集めて、自己PRにする」を、Expo / React Nativeへ移植したnpm workspacesモノレポです。

| ディレクトリ | 役割 |
| --- | --- |
| `apps/mobile` | Expo SDK 57 / React Native / Expo Router。18画面を機能別に分割 |
| `apps/api` | Hono / Cloudflare Workers。D1と非公開R2のバインディング、SQLマイグレーション |
| `packages/domain` | カードの集計・予想・自己PR、型、Zodによる入出力検証 |
| `packages/api-client` | モバイルとテストで共用する型付きHTTPクライアント |
| `design` | 元のHTML・CSS・ブランドSVG。変更前の参照用 |
| `tests` | 元HTMLとのロジック比較と、Workers/D1/R2の実行テスト |

## 起動

Node.js 22.13以降が必要です。開発時に使用したバージョンは `.nvmrc` の22.22.3です。

```sh
cd '/Users/kazu3jp/Desktop/技育展/project/Flocka'
nvm use
npm ci
npm run dev:mobile
```

Webプレビューは `npm run dev:web`、iOSは `npm run ios`、Androidは `npm run android`。これらはExpo開発サーバーの起動コマンドです。ネイティブの署名済みアプリを作るコマンドではありません。

初回は6ステップの登録画面です。画面上部の「体験してみる」から元HTMLと同じハルカのサンプルを開けます。体験中の変更は保存されず、自分のデータを維持します。

## Workers・D1・R2をローカルで動かす

ターミナル1:

```sh
npm run db:migrate
npm run dev:api
```

`http://127.0.0.1:8787/health` でAPIの稼働を確認できます。D1とR2はWranglerのローカル環境で実際に読み書きします。Cloudflareアカウントのリソース作成や本番デプロイは実行していません。

ターミナル2:

```sh
cp apps/mobile/.env.example apps/mobile/.env.local
npm run dev:web
```

「自分」画面のバックアップ欄でAPIへの接続、D1へのデッキ保存、R2への写真保存、復元ができます。環境変数の変更後はExpo開発サーバーを再起動してください。実機では `EXPO_PUBLIC_API_URL` を開発PCのLANアドレスに、Androidエミュレーターでは `http://10.0.2.2:8787` に設定します。Webの起動ポートを変更する場合は `apps/api/wrangler.jsonc` の `ALLOWED_ORIGINS` も変更します。

API URLを設定していない場合は、元の端末内デモとして動きます。API URLを設定した際の通信エラーは画面に表示し、端末内への保存をサーバー保存の成功として扱いません。

## 検証

```sh
npm run validate
npm run export:web
npm run export:native
npm run build:api
```

`validate` はテストも含む型検査、Lint、元HTMLとの比較を含む18テスト、実際のWorkersランタイム/D1/R2を使う1つの統合テストを実行します。統合テストは独立した一時データベースとバケットを使用します。`build:api` は `wrangler deploy --dry-run` で、本番へデプロイしません。Expoの書き出し結果は `apps/mobile/dist` です。書き出しの成功は実機操作・画面比較の確認とは区別しています。

## 実装済みと今後の接続

Expoには登録、デッキ、開封、カード詳細・デコ、プロフィール、交換のデモ、印象・場面のメモ、自己PR、公開範囲・安全を実装しています。実際のバックエンドと接続しているUIはバックアップ保存・復元です。

Workersにはプロフィール、期限付き交換コード、双方承認の交換、証言の送受信・開封・公開設定、ブロック、通報・削除依頼の保存を実装し、HTTP経由で検証しています。交換・証言のネイティブ画面は現在も元のデモ相手を使用します。実際のプレイヤー一覧・QR・受信一覧へのUI接続、BLE検出、アカウント復旧、通知、運営による通報対応は今後の作業です。

匿名セッションは90日有効です。iOS/AndroidではトークンをSecureStore、Webプレビューではタブ単位のsessionStorageに保存します。現状では別端末へのログイン・セッション失効後の復旧を実装していません。サーバーの証言と端末内バックアップは別テーブルで管理し、バックアップを書き換えて証言を作ることはできません。

デザインの出典・移植方針は [DESIGN.md](DESIGN.md)、APIと保存方針は [docs/architecture.md](docs/architecture.md)、検証結果と未確認事項は [docs/validation.md](docs/validation.md) を参照してください。
