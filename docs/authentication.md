# Better Auth / Resend の設定

## ローカル

`npm run setup:local` は `apps/api/.dev.vars` に32バイトの乱数によるシークレットを、`apps/mobile/.env.local` に接続先を設定します。存在するファイルは保持します。必要に応じて `.dev.vars.example` にある項目を既存ファイルへ追加してください。秘密情報をGitに追加しません。

| 設定 | 役割 |
| --- | --- |
| `BETTER_AUTH_SECRET` | 少なくとも32文字の固有のシークレット。環境ごとに別の値 |
| `BETTER_AUTH_URL` | Workersの外部URL。本番はHTTPS |
| `RESEND_API_KEY` | Resendの送信権限を持つAPIキー |
| `RESEND_FROM` | `Flocka <no-reply@flocka.zofax.net>` |
| `ALLOWED_ORIGINS` | Webフロントの完全なオリジンをカンマ区切りで設定 |
| `EXPO_PUBLIC_API_URL` | Expo側のWorkers接続先。秘密情報は入れない |

Resendで `flocka.zofax.net` を追加し、管理画面に示されたDNSレコードを設定して検証を完了します。DNSレコードの値を推測で設定しません。APIキーとDNS設定は本実装に含めて公開しません。

Webプレビューはフロント/APIでホストを一致させます。既定は `localhost:8081` と `localhost:8787` です。別サイト間のCookieを必要とする運用は想定していません。本番Webを使う場合も同じサイトのサブドメイン構成とHTTPSを使ってください。

## 流れ

1. メール、英数字を含む8〜128文字のパスワード、同意で登録する。登録だけではセッションを発行しない。
2. Resendで6桁の確認コードを送り、10分以内に確認する。コードは一度しか使えず、5回誤入力すると失効する。
3. 確認後にBetter Authセッションを発行し、初回はプロフィール登録へ進む。
4. 既存ユーザーは同じメールとパスワードでログインする。端末にデータがなければサーバーのプロフィールを取得する。設定・下書き・装飾はサーバーに自動保存されており、ログイン後の同期で復元する（手動のバックアップ復元は廃止）。
5. 再設定の申請は登録済み・未登録で同じメッセージを返す。登録済みの場合はResendに30分有効のリンクを渡す。
6. リンクは `/reset-password` 画面を開く。変更成功後はすべての既存セッションを失効させ、新しいパスワードでログインする。

メール確認専用にemailOTPプラグインを使います。OTPによるパスワードなしのログインや、リンクの代わりのOTP再設定は提供していません。

## Apple / Google

`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`、`APPLE_CLIENT_ID` + `APPLE_CLIENT_SECRET` を設定したプロバイダーだけボタンを有効にします。サーバーは設定済みのプロバイダー名だけを返します。秘密情報はExpoへ渡しません。

OAuthプロバイダーに登録するリダイレクトURI:

```text
https://<Workersのホスト>/api/auth/callback/google
https://<Workersのホスト>/api/auth/callback/apple
```

Expoの戻り先は `flocka://` です。安定したschemeを持つ開発ビルドを使ってください。Expo Goの `exp://` を本番用の許可オリジンへ追加しません。

Appleの `APPLE_CLIENT_SECRET` はApple Developerの鍵で署名したJWTです。有効期限（最長6か月）までに更新してください。AppleのOAuthコールバックにはHTTPSのドメインが必要です。資格情報やApple Developerの設定を用意していないプロバイダーの実通信は検証していません。

## 本番の秘密情報

引き継ぎ時点で本番設定とデプロイのコミットが追加されています。今回の修正は未デプロイです。今後更新する際は、本番のD1 ID、R2、HTTPS URL、許可オリジンを設定し、対話入力でSecretsを登録します。

```sh
cd apps/api
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put RESEND_API_KEY
# 必要なプロバイダーだけを登録
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put APPLE_CLIENT_ID
npx wrangler secret put APPLE_CLIENT_SECRET
```

`RESEND_FROM` は公開設定、APIキーは秘密情報です。公開URLを `.dev.vars` だけに変更しても本番設定には反映されません。本番のWrangler設定も更新する必要があります。

規約・プライバシーポリシーの本文は `packages/domain/src/legal.ts` に集約し、登録時と設定画面に表示します。運営者から正式本文は提供されていないため、現在の本文は運営情報と実装を基に作成した内容です。運営者による文言確認は未実施です。旧匿名セッションと未認証の端末デッキを、新規の認証済みアカウントへ自動で結び付けません。旧データは削除しませんが、この認証フローの復元対象にはなりません。

実装は [Better Auth Expo](https://better-auth.com/docs/integrations/expo)、[Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)、[Email OTP](https://better-auth.com/docs/plugins/email-otp)、[メール・パスワード](https://better-auth.com/docs/authentication/email-password)、[Apple](https://better-auth.com/docs/authentication/apple)、[Resend Workers](https://resend.com/docs/send-with-cloudflare-workers) の公式資料に基づきます。

Apple/Googleなどで登録し規約への同意が未記録の場合は、初回プロフィール登録で本文を提示し同意を確認します。`POST /v1/me/terms` は現在の文書の版と明示的な同意だけを受け付け、D1に版・時刻を記録します。同意のないアカウントは `POST /v1/accounts` で拒否します。メール登録時の同意はBetter Authの追加フィールドで記録しています。

## セッションの再確認

- 背景での再確認（フォーカス時など）が通信エラーや429で失敗しても、確認済みのセッションがあれば画面を保持し、「ログイン状態を確認できませんでした」のバナーから再確認できます。セッションがまだ無いときだけ確認画面で止めます。
- APIが `UNAUTHORIZED` / `ACCOUNT_CHANGED` を返すと、アプリはBetter Authのセッションを再取得し、失効していればログイン画面へ戻します。未保存の表示設定・自己PR下書きはアカウント別に端末へ残し、同じアカウントで再ログインしたときに、保存時のリビジョンがサーバーと一致する場合だけ送信します。一致しない場合は比較画面で選択します。
- 認証APIの429は日本語で表示し、`X-Retry-After` を読めた場合は待ち時間を示します。WebはAPIがこのヘッダーをCORSで公開していないため、待ち時間なしの文言になります。
- パスワード再設定の成功後はセッションを再取得し、失効したセッションでアプリへ戻りません。
- 起動時のエラー画面（メール未確認、削除処理中など）からもログアウトできます。
