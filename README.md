# Flocka

OpenDesignの「強みカードを集めて、自己PRにする」を、Expo / React Nativeへ移植したnpm workspacesモノレポです。

| ディレクトリ | 役割 |
| --- | --- |
| `apps/mobile` | Expo SDK 57 / React Native / Expo Router。認証・プロフィール・カード画面を機能別に分割 |
| `apps/api` | Hono / Cloudflare Workers / Better Auth / Resend。D1と非公開R2 |
| `packages/domain` | カードの集計・予想・自己PR、型、Zodによる入出力検証 |
| `packages/api-client` | モバイルとテストで共用する型付きHTTPクライアント |
| `design` | 更新済みの参照HTML・CSS・ブランドSVG |
| `tests` | 元HTMLとのロジック比較と、Workers/D1/R2の実行テスト |

## 起動

Node.js 22.13以降が必要です。使用バージョンは `.nvmrc` の22.22.3です。

```sh
cd '/Users/kazu3jp/Desktop/技育展/project/Flocka'
nvm use
npm ci
npm run setup:local
```

`setup:local` は `.dev.vars` と `.env.local` を作成し、認証シークレットを生成します。既存ファイルは上書きせず、秘密情報を表示しません。`apps/api/.dev.vars` の `RESEND_API_KEY` を設定してください。送信元は `Flocka <no-reply@flocka.zofax.net>` です。Resendでこのドメインを検証する必要があります。詳しくは [認証設定](docs/authentication.md) を参照してください。

ターミナル1でAPIとローカルD1/R2を起動:

```sh
npm run db:migrate
npm run dev:api
```

ターミナル2でWebプレビュー:

```sh
npm run dev:web
```

Webは `http://localhost:8081`、APIの稼働確認は `http://localhost:8787/health` です。WebとAPIのホストをともに `localhost` に合わせてください。`npm run dev:mobile` はExpoのQRを表示し、`npm run ios` / `npm run android` は各開発プレビューを起動します。ネイティブの署名済みビルドとは別のコマンドです。

初回はウェルカム、アカウント作成、メール確認、6ステップのプロフィール登録へ進みます。メール未確認ではログインできません。登録後の「体験してみる」は元HTMLのサンプル専用で、サーバーのアカウントや保存データとは分けています。

「自分」画面からバックアップをD1/R2に保存・復元し、ログアウトできます。端末データはユーザーID別の保存領域です。API未設定や通信失敗を認証成功として扱いません。

実機では `EXPO_PUBLIC_API_URL` と `BETTER_AUTH_URL` を開発PCのLANアドレスに、Androidエミュレーターでは `http://10.0.2.2:8787` に設定します。Webのホスト・ポートを変える場合は `ALLOWED_ORIGINS` も設定し、Expo/Workersを再起動してください。Apple/Googleとメールの再設定リンクには安定した `flocka://` を持つ開発ビルドを使います。

Cloudflare本番リソース作成・デプロイは実施していません。

## 検証

```sh
npm run validate
npm run export:web
npm run export:native
npm run build:api
```

`validate` はテストも含む型検査、Lint、元HTMLとの比較を含む18テスト、実際のWorkersランタイム/D1/R2を使う4つの統合テスト（計22テスト）を実行します。統合テストは独立した一時データベースとバケットを使用します。`build:api` は `wrangler deploy --dry-run` で、本番へデプロイしません。Expoの書き出し結果は `apps/mobile/dist` です。書き出しの成功は実機操作・画面比較の確認とは区別しています。

## 実装済みと今後の接続

Expoの全画面が実サーバーと接続しています。交換コードのQR・手入力、近くのプレイヤー検出（BLE、`apps/mobile/modules/flocka-nearby`）、双方承認の交換、印象・場面の送受信、公開範囲・ブロック・通報、端末設定の同期、プッシュ通知の端末登録、運営向けの通報対応画面（`ADMIN_USER_IDS` に含まれるアカウントのみ）を実装しています。BLEと通知は開発ビルド（`npm run ios` / `npm run android`）の実機が必要で、Expo Goやシミュレーターでは動きません。

Workersにはプロフィール、期限付き交換コード、双方承認の交換、証言の送受信・開封・公開設定、ブロック、通報・削除依頼の保存と運営による対応、通知outboxとExpo Pushへの配信、5分ごとのCron（通知配信・期限切れデータと未参照写真の削除）を実装し、HTTP経由で検証しています。

Better Authでメール・パスワード認証、6桁のメール確認、再設定リンク、ログアウトを実装しています。Apple/Googleは資格情報を設定した場合のみ有効です。セッションは30日有効で、ネイティブではExpoプラグインとSecureStore、WebではHttpOnly Cookieを使います。パスワード再設定は既存セッションを失効させます。既存の匿名トークンは0003マイグレーションで失効し、古い端末データを別アカウントへ自動で引き継ぎません。

サーバーの証言と端末内バックアップは別テーブルで管理し、バックアップを書き換えて証言を作ることはできません。規約・プライバシーポリシーの本文はデザインにある公開前プレースホルダーです。

デザインの出典・移植方針は [DESIGN.md](DESIGN.md)、APIと保存方針は [docs/architecture.md](docs/architecture.md)、検証結果と未確認事項は [docs/validation.md](docs/validation.md) を参照してください。
