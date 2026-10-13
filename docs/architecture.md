# 構成とAPI

## 責務

Expoの画面は `apps/mobile/src/features` 内の画面単位のファイルに置きます。表示部品は `components`、端末内の保存とナビゲーションは `store.tsx`、バックアップ操作は `features/sync` に分けています。

共有ロジックは `packages/domain` の `game.ts`、`state.ts`、`exchange.ts`、`navigation.ts`、`types.ts` に分けています。React NativeにもCloudflareにも依存しません。`api.ts` のZodスキーマをWorkersとHTTPクライアントの双方で使います。

Workersの入口は `apps/api/src/index.ts`。CORS、認証、共通エラーを入口で処理し、機能別ルートからRepositoryへDBアクセスを委ねます。SQLはすべてプレースホルダーへ値をバインドします。EnvはWranglerの設定から生成しています。

## API一覧

`/api/auth/*` にBetter Authのハンドラーを配置しています。`/v1/*` はすべて有効なBetter Authセッションとメール確認を要求します。`POST /v1/accounts` は認証済みユーザーにプロフィールと自己申告カード2〜3枚を作成します。ユーザーIDとプレイヤーIDを共通にし、他人のIDをリクエストから採用しません。APIクライアントはWebでCookieを送信し、ネイティブでExpoプラグインのSecureStoreからCookieを取得して送信します。

| メソッド・パス | 内容 |
| --- | --- |
| `GET /health` | D1接続を含む稼働確認 |
| `GET /auth/config` | 設定済みのApple/Googleプロバイダー名のみを返す |
| `GET/POST /api/auth/*` | Better Authのメール登録・確認・ログイン・再設定・ログアウト |
| `POST /v1/accounts` | 認証済みユーザーのプレイヤープロフィール作成（再試行時は既存を返す） |
| `GET/PATCH /v1/me` | 自分のプロフィール取得・更新 |
| `PUT /v1/me/settings` | 証言の受け取り設定 |
| `POST /v1/invites` | 10分有効・1人が使用できる交換コード |
| `GET/POST /v1/exchanges` | 自分の交換一覧・コードから交換開始 |
| `GET /v1/exchanges/:id` | 参加者だけが交換を取得 |
| `POST /v1/exchanges/:id/approve` | 自分の出会いのメモと承認を保存 |
| `POST /v1/exchanges/:id/cancel` | 参加者が交換を取り消す |
| `GET/POST /v1/testimonies` | 届いた証言取得・承認済み相手へ贈る |
| `PATCH /v1/testimonies/:id` | 受信者だけが開封・予想・公開範囲を更新 |
| `POST /v1/blocks` / `DELETE /v1/blocks/:id` | ブロック・解除 |
| `POST /v1/moderation` / `POST /v1/moderation/:id/withdraw` | 通報・削除依頼の記録・取り下げ |
| `GET/PUT /v1/me/backup` | 本人だけが端末データを保存・取得 |
| `GET/PUT /v1/me/avatar` | 本人のR2写真を保存・取得 |
| `GET /v1/me/backup/avatar` | 保存済みバックアップに対応する写真を取得 |

`GET /v1/sync` は100件ずつページ送りします。通報の受付記録はD1に保存し、運営は `GET /v1/admin/moderation` と `POST /v1/admin/moderation/:id/resolve` で対応します（`ADMIN_USER_IDS` のアカウントのみ。対応は `moderation_audit` に記録）。`PUT/DELETE /v1/me/push-devices` でExpo Pushトークンを登録します。

## D1

`auth_users`、`auth_accounts`、`auth_sessions`、`auth_verifications`、`auth_rate_limits` が認証専用テーブルです。DrizzleのD1アダプターを使用し、D1で未対応のトランザクションは有効にしません。旧 `sessions` は0003で空にし、今後の認証には使いません。

`accounts`、`invites`、`exchanges`、`exchange_participants`、`testimonies`、`blocks`、`moderation_requests`、`backups` を管理します。双方の承認がそろった時点で交換が成立します。出会いのメモは参加者ごとに保存し、相手の個人メモを返しません。

同じ2人の有効な交換、同じ送り主から相手への印象1件を、一意インデックスで守ります。証言の送り主と受信者はセッション・交換参加者から決め、クライアントが任意の相手を詐称できないようにします。交換が成立しただけで封筒を自動生成しません。

端末データのバックアップは共同作業で受信した証言とは別の保存領域です。更新番号が一致しない保存には409を返します。モバイルは通信失敗や競合を画面へ表示します。

## R2

JPEG/PNGのみ、最大1 MiBを受け付け、Content-Typeとファイル先頭の形式を確認します。プロフィール写真は `avatars/<account-id>/<random-id>` の非公開オブジェクトに保存し、Workerで認証してストリームを返します。バックアップにはその画像キーを対応付け、後の写真更新や競合した保存で旧バックアップの写真が変わらないようにします。

Cron（5分ごと）が、24時間以上前に保存された未参照の画像、期限切れセッション・確認コード・交換コードを削除します。画像の形式判定はデコードやマルウェア検査を行うものではありません。

## 認証とメール

設定・メール配信・Drizzleスキーマを `apps/api/src/auth` に分けています。メール確認コードは10分有効、5回の誤入力までで、D1にはハッシュを保存します。再送はIPごとに30秒に1回に制限します。再設定リンクは30分有効です。登録時の同意と英数字のパスワード要件はAPIでも検証します。認証用のリクエスト本文は16KiBまでです。

確認メールの送信エラーは502を返します。Better Authがメールコールバックのエラーを捕捉するため、リクエスト単位のafterフックで明示的な再送処理にエラーを返しています。パスワード再設定はメールアドレスの存在を漏らさない共通応答を返し、送信をWorkersのwaitUntilで完了させます。配信失敗は個人情報を含まないイベント名だけで記録します。これはメールが受信箱へ届いた保証を返す処理ではありません。

## 本番へ進める際の未実装事項

本番D1/R2の作成と設定、HTTPS URL・CORSの設定、`ADMIN_USER_IDS` の設定、EASプロジェクトID（プッシュ通知用）、本番マイグレーションとデプロイは実行していません。通知はExpo Pushへ送信した結果を記録するもので、端末への到達を保証しません。BLE探索と通知は実機で未検証です。

Wranglerローカル開発・D1・R2の扱いは [Cloudflareの開発ドキュメント](https://developers.cloudflare.com/workers/local-development/) と [D1のWorker API](https://developers.cloudflare.com/d1/worker-api/d1-database/)、[R2のWorker API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) に基づいています。
