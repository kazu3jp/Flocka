# 通知の開発者設定

Expo/EASは、アプリのビルドとApple/Googleへ通知を届けるための資格情報を管理する開発者向けサービスです。Flockaのメール・パスワードによるログインとは別で、利用者がExpoアカウントを作る必要はありません。

開発担当者が一度設定します。

```sh
cd apps/mobile
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build:configure
npx eas-cli@latest credentials
```

`init` はExpo側のプロジェクトとこのアプリを関連付け、`app.json` の `expo.extra.eas.projectId` にIDを設定します。既存プロジェクトを使う場合は、そのIDを指定します。APIキーやApple/Googleの秘密情報をGitへ追加しないでください。

AndroidはFCM v1の資格情報、iOSはApple DeveloperのAPNsキーをEASで設定します。iOSの実機用ビルドにはAppleの署名設定も必要です。設定後に開発ビルドを作り直します。

Androidの設定:

- **Firebase:** プロジェクト `flocka-app` に、パッケージ `jp.kazu3.flocka` のAndroidアプリを登録しています。
- **`google-services.json`:** `apps/mobile/google-services.json` に置き、`app.json` の `android.googleServicesFile` から参照します。公開して構わない識別子だけを含むため、Gitに含めます。生成物の `apps/mobile/android/` には置かないでください（prebuildで消えます）。
- **FCM V1の送信用キー:** Firebaseのサービスアカウントキーを `npx eas-cli@latest credentials` で登録します。秘密情報のため、Gitには追加しません。このキーが無いと、端末の登録は成功しても通知は届きません。
- **ネイティブ設定の反映:** 既存の `android/` に変更を反映するときは、`npx expo prebuild --platform android --no-clean` を使います。このExpoのprebuildは既定でフォルダーを作り直し、Windowsでは使用中のファイルがあると失敗します。

iOSは、有料のApple Developer ProgramでAPNsキーと通知の権限（`aps-environment`）を設定するまで、リモート通知が届きません。AltStoreで無料のApple IDを使って入れたIPAも同じです。

```sh
npx expo run:android
npx expo run:ios
```

スマートフォンでFlockaへログインし、「公開範囲・安全」から「この端末で通知を受け取る」を押します。OSの通知許可を承認します。交換した別アカウントから証言を贈り、通知の到着・通知タップ後の同期を確認してください。設定が足りない場合は登録成功として表示しません。WebやExpo Goでプッシュ通知を疑似再現しません。

バックエンドはCronで通知を送信します。配信待ち・受付チケット・配信結果は別テーブルです。Expo側でアクセストークン保護を有効にした場合はWorkersの `EXPO_ACCESS_TOKEN` を設定してください。

公式資料: [通知のセットアップ](https://docs.expo.dev/push-notifications/push-notifications-setup/)、[送信と配信結果](https://docs.expo.dev/push-notifications/sending-notifications/)。今回、外部への実通知は送っていません。

ログアウト時に通知の登録解除が失敗した場合は、成功として扱わず理由を表示します。利用者が「通知の解除を後で再試行してログアウト」を選ぶと、トークンを解除待ちとして端末に残し、同じアカウントで次にログインしたとき（起動時の登録確認）に解除を再試行します。別のアカウントでは旧アカウントのトークンを解除できません。トークンが変わった場合は新しいトークンを先に登録し、古いトークンの解除失敗は解除待ちとして再試行します。OSによるトークン更新は `addPushTokenListener` で検知して再登録します。
