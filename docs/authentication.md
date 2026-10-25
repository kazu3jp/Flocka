# Better Auth / Resend の設定

## ローカル

`npm run setup:local` は `apps/api/.dev.vars` に32バイトの乱数によるシークレットを、`apps/mobile/.env.local` に接続先を設定します。存在するファイルは保持します。必要に応じて `.dev.vars.example` にある項目を既存ファイルへ追加してください。秘密情報をGitに追加しません。

| 設定                               | 役割                                                                                                     |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`               | 少なくとも32文字の固有のシークレット。環境ごとに別の値                                                   |
| `BETTER_AUTH_URL`                  | Workersの外部URL。本番はHTTPS                                                                            |
| `RESEND_API_KEY`                   | Resendの送信権限を持つAPIキー                                                                            |
| `RESEND_FROM`                      | `Flocka <no-reply@flocka.zofax.net>`                                                                     |
| `ALLOWED_ORIGINS`                  | Webフロントの完全なオリジンをカンマ区切りで設定                                                          |
| `EXPO_PUBLIC_API_URL`              | Expo側のWorkers接続先。秘密情報は入れない                                                                |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | 任意。Androidのアプリ内Googleログイン用のウェブクライアントID（公開値）。未設定ならAndroidもブラウザ方式 |

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

## Google

`GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` を設定するとGoogleのボタンを有効にします。サーバーは設定済みの場合だけ `google` を返します。秘密情報はExpoへ渡しません。Appleログインは廃止し、ボタン・認証プロバイダー・Appleからのコールバックの特別許可を削除しています。

**本番で登録する文字列（コードで確認済み）**: `apps/api/wrangler.jsonc` の `BETTER_AUTH_URL` は `https://api.flocka.zofax.net` で、Better Authが送る `redirect_uri` は末尾スラッシュの有無にかかわらず次の1つです（`tests/google-sign-in.integration.test.ts` で検査）。Google CloudのウェブアプリケーションのOAuthクライアントの「承認済みのリダイレクトURI」へ、この文字列をそのまま（http ではなく https、末尾スラッシュなし、パスは `/api/auth/callback/google`）登録してください。

```text
https://api.flocka.zofax.net/api/auth/callback/google
```

Googleの `redirect_uri_mismatch`（Error 400）はこの登録がないときにGoogleの画面で出るもので、アプリのコードの不具合ではありません。登録の反映には数分かかることがあります。

OAuthプロバイダーに登録するリダイレクトURI:

```text
https://<Workersのホスト>/api/auth/callback/google
```

Expoの戻り先は `flocka://` です。安定したschemeを持つ開発ビルドを使ってください。Expo Goの `exp://` を本番用の許可オリジンへ追加しません。

GoogleのローカルWeb開発では `http://localhost:8787/api/auth/callback/google` を登録します。Googleの資格情報を用意していないため、実際のOAuth通信は未検証です。

### ブラウザ方式の失敗の見え方

ブラウザ（Custom Tab）方式は `errorCallbackURL`（Android・iOSは `flocka://auth`、Webは `<オリジン>/auth`）を指定しています。指定しないと、失敗したときにBetter Authが自分のエラーページを開いたままにし、アプリには何も返りません。現在は、失敗が `?error=<コード>` としてアプリへ戻り、日本語の説明と末尾のコード（例：`（invalid_code）`）を表示します。アプリのコードは [google-sign-in.ts](../apps/mobile/src/features/auth/google-sign-in.ts)、文言は [auth-error-message.ts](../apps/mobile/src/features/auth/auth-error-message.ts) です。

次の失敗はアプリに戻らず、Googleの画面または端末のブラウザ上に表示されます。画面の文言をそのまま報告してください。

| 表示される場所                                        | 主な原因                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Googleの画面 `Error 400: redirect_uri_mismatch`       | 上の「リダイレクトURI」を、**ウェブアプリケーション**のOAuthクライアントに登録していない（ホスト・パスの1文字違いでも不一致）         |
| Googleの画面 `Error 403: access_denied`（審査中）     | OAuth同意画面が「テスト」で、ログインしたアカウントがテストユーザーに入っていない                                                     |
| Googleの画面 `Error 401: invalid_client`              | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` が別のクライアントの値、または削除・再生成済み                                            |
| アプリへ戻り `（invalid_code）`                       | シークレット不一致、またはトークン交換時のリダイレクトURI不一致。Workersのログに `Failed to validate authorization code` 系の行が出る |
| アプリへ戻り `（state_mismatch）` / `state_not_found` | ブラウザ→APIで状態Cookieを保持できていない（別ブラウザへ切り替わった、Cookie遮断など）                                                |
| ブラウザで `flocka://` が開けない                     | 端末にアプリが無い、または別のアプリが同じschemeを持つ                                                                                |

### Androidのネイティブ（アプリ内）Googleログイン

Androidでは、ブラウザを開かず、端末のGoogleアカウント選択（Credential Manager）を使ってIDトークンを取得し、`signIn.social({ provider: "google", idToken: { token, nonce } })` でBetter Authへ渡します。サーバーはGoogleの公開鍵で署名・発行元・有効期限・`aud`・`nonce` を検証してからセッションを発行します。ネイティブのIDトークンの `aud` は、アプリが `serverClientId` として渡した**ウェブアプリケーションのクライアントID**になるため、サーバーの既存の `GOOGLE_CLIENT_ID` でそのまま検証できます（Better Auth 1.7.7のソースと、`tests/google-sign-in.integration.test.ts` の偽のGoogle鍵で確認）。iOSとWebは従来のブラウザ方式のままです。

アプリ側の設定は `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`（ウェブアプリケーションのクライアントID。公開して構わない値で、秘密ではありません）だけで、読む場所は [google-config.ts](../apps/mobile/src/features/auth/google-config.ts) の1か所です。**ビルド時に設定されたときだけ**ネイティブ方式が有効になります。未設定のビルドでは、Androidも従来のブラウザ方式へ戻り、`[auth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID was not set at build time` をログに1回出します。サーバー側の変更・秘密情報の追加は要りません。

運営者がGoogle Cloudで行うこと（アプリ側のコードだけでは動きません）:

1. 同じプロジェクトで「OAuth同意画面」を設定する（公開前は「テスト」のままだとテストユーザー以外はログインできない）。
2. **ウェブアプリケーション**のOAuthクライアントを使う（既にサーバーの `GOOGLE_CLIENT_ID` として使っているものでよい）。そのクライアントIDを `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` に設定する。
3. **Android**のOAuthクライアントを新規作成する。パッケージ名は `jp.kazu3.flocka`、SHA-1は**そのAPKに署名した鍵**のもの。AndroidクライアントのクライアントIDはアプリへもサーバーへも設定しません（Googleが署名とパッケージ名の照合に使います）。
4. SHA-1の取得。現在のリリースビルドは `signingConfigs.debug`（`android/app/debug.keystore`）で署名されています。

   ```sh
   cd apps/mobile
   npx expo prebuild --platform android --no-install   # android/app/debug.keystore を生成
   keytool -list -v -keystore android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

   表示される `SHA1:` の行をAndroidクライアントへ登録します。開発用に別のPCで作ったdebug鍵も別のSHA-1になるため、APKを作るPCごとに登録するか、配布用の固有の鍵を作って署名を切り替えます（切り替えるとSHA-1も変わるので、Androidクライアントを作り直す）。Play App Signingを使う場合は、Play Consoleに表示される「アプリ署名鍵」のSHA-1も登録します。

5. ビルド時に環境変数を渡して作り直す（`EXPO_PUBLIC_*` はビルド時に埋め込まれるため、既存のAPKは変わりません）。

   ```sh
   EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<ウェブアプリケーションのクライアントID>    npx expo run:android --variant release
   ```

   EASを使う場合は `apps/mobile/eas.json` の `build.base.env` に同じ名前で値を足します（秘密ではないのでGitに入れて構いません）。

6. ネイティブモジュールを足しているため、既存の開発ビルドは作り直しが必要です。

端末側の失敗は、アプリ内で次のように扱います（[google-native-signin.ts](../apps/mobile/src/features/auth/google-native-signin.ts)）。

| 状況                                         | 動き                                                                                                                        |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 画面を閉じた（キャンセル）                   | 何も表示しない                                                                                                              |
| 端末にGoogleアカウントがない                 | 「この端末にGoogleアカウントがありません…」                                                                                 |
| Google Play開発者サービスが無い・無効        | 「Google Play開発者サービスを利用できません…」                                                                              |
| 通信の中断                                   | 「通信が中断されました…」（成功にはしない）                                                                                 |
| パッケージ名・SHA-1・クライアントIDの不一致  | 「このアプリのGoogleログイン設定…が一致していません」（Googleの `28444` を検出）                                            |
| サーバーがトークンを拒否（署名・aud・nonce） | 「Googleの認証情報をサーバーが確認できませんでした…」。セッションは作られない                                               |
| その他                                       | 「Googleログインを開始できませんでした（コード）」。ログ（logcat）に `[auth] native Google sign-in failed: <コード> <説明>` |

`nonce` は端末で毎回16バイトの乱数を作り、Googleのトークンに入った値とサーバーで照合します。Googleのメールが未確認のアカウント（`email_verified` が偽）は、ブラウザ方式・ネイティブ方式とも拒否します（`requireEmailVerification`）。新規のGoogleユーザーは、これまでと同じく初回プロフィール登録で規約へ同意するまで `POST /v1/accounts` が拒否されます。

ライブラリの選定は [validation.md](validation.md) に記録しています。

過去に保存されたApple連携データを安全に削除するため、トークン失効処理だけは残しています。この互換処理用の `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` を設定してもAppleログインは有効になりません。新規設定では不要です。

## Better Authダッシュボード / Sentinel

`@better-auth/infra` をAPIとモバイルに導入しています。APIは `BETTER_AUTH_API_KEY` が設定された場合にだけ `dash({ apiKey })` と `sentinel({ apiKey })` を有効にします。未設定ではダッシュボード連携は無効です。Google OAuthの資格情報とは別です。

1. [Better Authダッシュボード](https://dash.better-auth.com)でプロジェクトを作成し、APIキーを発行します。
2. `apps/api/.dev.vars` に `BETTER_AUTH_API_KEY="発行されたキー"` を追加し、APIを再起動します。キーはGitや `EXPO_PUBLIC_*` へ入れません。
3. ダッシュボードの接続先に認証APIのURL（ローカルWeb開発では `http://localhost:8787/api/auth`）を指定します。接続元から到達可能なURLが必要です。クラウドから接続する場合は公開HTTPSのAPIを使用します。
4. Expoを再起動してログイン操作を行い、ダッシュボードでユーザーとイベントを確認します。設定しただけで接続成功とはみなしません。

アプリ側は、ビルド時に `EXPO_PUBLIC_BETTER_AUTH_INFRA=enabled` を指定したときだけこれらのクライアントを読み込みます（未指定では外部サービスへの端末識別の通信は起きません）。サーバーのキーとこのビルド設定の両方がそろって初めて有効になります。

Webでは `dashClient()` / `sentinelClient()`、iOS・Androidでは `dashClient()` / `sentinelNativeClient()` を使用します。ネイティブの識別子はSecureStoreに保存します。`expo-crypto` を追加しているため、既存の開発ビルドに含まれていなければ作り直してください。

WebのSentinelに必要な識別・PoWヘッダーをCORSで許可・公開し、ダッシュボードのオリジンはキー設定時の `/api/auth/dash/*` だけ許可しています。ダッシュボードの管理APIにはプラグインの署名検証も必要で、オリジンを許可しただけでは操作できません。Workersのバックグラウンド処理は `waitUntil` へ渡します。

ユーザー情報・認証イベント・端末識別情報をBetter Authの外部サービスへ送る連携です。公開前にプライバシーポリシーと利用条件を確認してください。追加のアクティビティ追跡やディレクトリ同期は有効にしていないため、この設定でDBマイグレーションの追加はありません。

本番で有効にする際は `apps/api` で `npx wrangler secret put BETTER_AUTH_API_KEY` を実行し、対応APIをデプロイします。本作業では本番Secretの登録・デプロイは行いません。

## 本番の秘密情報

引き継ぎ時点で本番設定とデプロイのコミットが追加されています。今回の修正は未デプロイです。今後更新する際は、本番のD1 ID、R2、HTTPS URL、許可オリジンを設定し、対話入力でSecretsを登録します。

```sh
cd apps/api
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put RESEND_API_KEY
# Googleを使う場合だけ登録
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

`RESEND_FROM` は公開設定、APIキーは秘密情報です。公開URLを `.dev.vars` だけに変更しても本番設定には反映されません。本番のWrangler設定も更新する必要があります。

規約・プライバシーポリシーの本文は `packages/domain/src/legal.ts` に集約し、登録時と設定画面に表示します。運営者から正式本文は提供されていないため、現在の本文は運営情報と実装を基に作成した内容です。運営者による文言確認は未実施です。旧匿名セッションと未認証の端末デッキを、新規の認証済みアカウントへ自動で結び付けません。旧データは削除しませんが、この認証フローの復元対象にはなりません。

実装は [Better Auth Expo](https://better-auth.com/docs/integrations/expo)、[Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)、[Email OTP](https://better-auth.com/docs/plugins/email-otp)、[メール・パスワード](https://better-auth.com/docs/authentication/email-password)、[Google](https://better-auth.com/docs/authentication/google)、[Resend Workers](https://resend.com/docs/send-with-cloudflare-workers) の公式資料に基づきます。

Apple/Googleなどで登録し規約への同意が未記録の場合は、初回プロフィール登録で本文を提示し同意を確認します。`POST /v1/me/terms` は現在の文書の版と明示的な同意だけを受け付け、D1に版・時刻を記録します。同意のないアカウントは `POST /v1/accounts` で拒否します。メール登録時の同意はBetter Authの追加フィールドで記録しています。

## セッションの再確認

- 背景での再確認（フォーカス時など）が通信エラーや429で失敗しても、確認済みのセッションがあれば画面を保持し、「ログイン状態を確認できませんでした」のバナーから再確認できます。セッションがまだ無いときだけ確認画面で止めます。
- APIが `UNAUTHORIZED` / `ACCOUNT_CHANGED` を返すと、アプリはBetter Authのセッションを再取得し、失効していればログイン画面へ戻します。未保存の表示設定・自己PR下書きはアカウント別に端末へ残し、同じアカウントで再ログインしたときに、保存時のリビジョンがサーバーと一致する場合だけ送信します。一致しない場合は比較画面で選択します。
- 認証APIの429は日本語で表示し、`X-Retry-After` を読めた場合は待ち時間を示します。WebはAPIがこのヘッダーをCORSで公開していないため、待ち時間なしの文言になります。
- パスワード再設定の成功後はセッションを再取得し、失効したセッションでアプリへ戻りません。
- 起動時のエラー画面（メール未確認、削除処理中など）からもログアウトできます。
