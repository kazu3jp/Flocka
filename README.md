# Flocka

OpenDesignの「強みカードを集めて、自己PRにする」を、Expo / React Nativeへ移植したnpm workspacesモノレポです。

| ディレクトリ          | 役割                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------- |
| `apps/mobile`         | Expo SDK 57 / React Native / Expo Router。認証・プロフィール・カード画面を機能別に分割 |
| `apps/api`            | Hono / Cloudflare Workers / Better Auth / Resend。D1と非公開R2                         |
| `packages/domain`     | カードの集計・予想・自己PR、型、Zodによる入出力検証                                    |
| `packages/api-client` | モバイルとテストで共用する型付きHTTPクライアント                                       |
| `design`              | 更新済みの参照HTML・CSS・ブランドSVG                                                   |
| `tests`               | 元HTMLとのロジック比較と、Workers/D1/R2の実行テスト                                    |

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

Webは `http://localhost:8081`、APIの稼働確認は `http://localhost:8787/health` です。WebとAPIのホストをともに `localhost` に合わせてください。`npm run dev:mobile` はExpoのQRを表示し、`npm run ios` / `npm run android` はネイティブの開発ビルドを作成して起動します。ストア公開用の署名済みビルドとは区別してください。

初回はウェルカム、アカウント作成、メール確認、6ステップのプロフィール登録へ進みます。メール未確認ではログインできません。ウェルカムのサンプルカードは機能の説明用です。登録後の交換・証言・プロフィールはサーバーの実データを使用します。

「自分」画面からバックアップをD1/R2に保存・復元し、ログアウト・アカウント削除を開始できます。端末データはユーザーID別の保存領域です。API未設定や通信失敗を認証成功として扱いません。

実機では `EXPO_PUBLIC_API_URL` と `BETTER_AUTH_URL` を開発PCのLANアドレスに、Androidエミュレーターでは `http://10.0.2.2:8787` に設定します。Webのホスト・ポートを変える場合は `ALLOWED_ORIGINS` も設定し、Expo/Workersを再起動してください。Apple/Googleとメールの再設定リンクには安定した `flocka://` を持つ開発ビルドを使います。

引き継ぎ時点で `flocka-app-api` と本番D1/R2の設定が追加されていました。2026年10月14日に `https://api.flocka.zofax.net/health` のHTTP 200を確認しています。今回の再開後の変更と0005〜0008マイグレーションは本番へ適用していません。

## 検証

未完了の要件と検証範囲は [完成条件の照合](docs/release-readiness.md)、実行結果は [検証記録](docs/validation.md) にまとめています。

画面の回帰テストは `npm run test:vrt`、比較レポートの表示は `npm run test:vrt:report` です。初回は `npx playwright install chromium` を実行してください。対象画面と基準画像の更新方法は [画面テスト](docs/visual-testing.md) を参照してください。

```sh
npm run validate
EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net npm run export:web
EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net npm run verify:export -- web
EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net npm run export:native
EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net npm run verify:export -- native
npm run build:api
```

`validate` はテストも含む型検査、Lint、元HTMLとの比較、認証、交換・公開証言のページ分割、通報の競合、通知の再試行・配信結果確認とアカウント削除を含む27テストを実行します。統合テストは独立した一時データベースとバケットを使用します。`build:api` は `wrangler deploy --dry-run` で、本番へデプロイしません。Expoの書き出し結果は `apps/mobile/dist` です。書き出しの成功は実機操作・画面比較の確認とは区別しています。

## 実装と接続設定

Expoの全画面が実サーバーと接続しています。交換コードのQR・手入力、近くのプレイヤー検出（BLE、`apps/mobile/modules/flocka-nearby`）、双方承認の交換、印象・場面の送受信、公開範囲・ブロック・通報、端末設定の同期、プッシュ通知の端末登録、運営向けの通報対応画面（`ADMIN_USER_IDS` に含まれるアカウントのみ）を実装しています。BLEと通知は開発ビルド（`npm run ios` / `npm run android`）の実機が必要で、Expo Goやシミュレーターでは動きません。

Workersにはプロフィール、期限付き交換コード、双方承認の交換、証言の送受信・開封・公開設定、ブロック、通報・削除依頼の保存と運営による対応、通知outboxとExpo Pushへの配信、5分ごとのCron（通知配信・期限切れデータと未参照写真の削除）を実装し、HTTP経由で検証しています。

Better Authでメール・パスワード認証、6桁のメール確認、再設定リンク、ログアウトを実装しています。Apple/Googleは資格情報を設定した場合のみ有効です。セッションは30日有効で、ネイティブではExpoプラグインとSecureStore、WebではHttpOnly Cookieを使います。パスワード再設定は既存セッションを失効させます。既存の匿名トークンは0003マイグレーションで失効し、古い端末データを別アカウントへ自動で引き継ぎません。

アカウント削除は「自分」画面とWebの `/delete-account` から開始します。メールで本人確認した後に削除を確定し、D1・R2のデータ、全セッション、通知登録とApple/Google連携を削除します。途中の失敗は「処理中」として再試行し、成功扱いにしません。Web画面の公開と本番への反映は未実施です。手順・対象データ・検証範囲は [アカウント削除](docs/account-deletion.md) を参照してください。

装飾の「完了」はサーバーへの保存を待ちます。通信失敗時は画面に残り、再試行できます。模様・色・フレーム・シールは元デザインの素材を使用し、設定とバックアップの両方で有効な種類・枚数・配置を検証します。

サーバーの証言と端末内バックアップは別テーブルで管理し、バックアップを書き換えて証言を作ることはできません。規約・プライバシーポリシーは `packages/domain/src/legal.ts` で版管理し、登録画面と設定画面から読めます。運営者名と窓口を反映しています。正式な文書を別途提示いただいていないため、掲載した本文の運営者による内容確認は必要です。

デザインの出典・移植方針は [DESIGN.md](DESIGN.md)、APIと保存方針は [docs/architecture.md](docs/architecture.md)、検証結果と未確認事項は [docs/validation.md](docs/validation.md) を参照してください。

通知は「公開範囲・安全」の設定から端末ごとに有効化・停止できます。ログアウト時は端末登録を解除します。Expoへの受付済みチケットとAPNs/FCMへの配信結果は別に保存し、エラーを成功として扱いません。通知を開くと、現在のアカウントで再同期して対応する画面を開きます。

Expo/EASは開発者がビルド・通知の資格情報を管理するサービスです。Flocka利用者のログインとは別です。開発者向けの設定手順は [通知設定](docs/notifications.md) を参照してください。

配布ビルドの設定は `apps/mobile/eas.json` で管理します。既存のExpoプロジェクトは `@kazu3jppurin/flocka` です。各プロファイルはNode 22.22.3と公開API URL `https://api.flocka.zofax.net` を共通設定から継承します。ローカル開発は引き続き `.env.local` の接続先を使用します。ResendやOAuthなどの秘密情報はモバイルの公開環境変数へ入れません。本番Workerの更新・マイグレーション・通知資格情報の準備は [検証記録](docs/validation.md) の未確認項目を参照してください。

配布用の書き出しはキャッシュを消して実行し、生成直後にAPI接続先を検証します。

```sh
EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net npm run export:web
EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net npm run verify:export -- web
EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net npm run export:native
EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net npm run verify:export -- native
```
