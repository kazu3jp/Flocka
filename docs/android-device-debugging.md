# Android実機でのデバッグ（USB）

Flockaは独自のBluetoothモジュールを含むため、開発用ビルドを端末へインストールして使います。ここではUSB経由でMac上のAPIとMetroへ接続します。

## 1. 端末を接続する

Androidの「開発者向けオプション」で「USBデバッグ」を有効にし、データ通信対応のUSBケーブルでMacへ接続します。端末に出る、このMacからのUSBデバッグの許可を承認してください。

```bash
adb devices -l
```

端末の行が `device` になれば接続できています。`unauthorized` の場合は端末をロック解除し、許可ダイアログを確認してください。何も表示されない場合はUSB接続と端末側の設定を確認します。

## 2. ローカルAPIを起動する

このMacのNode.js 22を使い、プロジェクト直下で実行します。

```bash
cd '/Users/kazu3jp/Desktop/技育展/project/Flocka'
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
npm run db:migrate
npm run dev:api
```

現在のローカル設定は次のとおりです。秘密情報をチャットやGitへ書き込む必要はありません。

- `apps/mobile/.env.local`: `EXPO_PUBLIC_API_URL=http://localhost:8787`
- `apps/api/.dev.vars`: `BETTER_AUTH_URL="http://localhost:8787"`

メール登録・再設定の確認には、ローカルの `.dev.vars` に有効なResend設定が必要です。

## 3. ビルドして実機へインストールする

別のターミナルで実行します。JDK 21とAndroid SDKはこのMacの既存インストールを使います。

```bash
cd '/Users/kazu3jp/Desktop/技育展/project/Flocka'
export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
export JAVA_HOME='/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home'
export ANDROID_HOME="$HOME/Library/Android/sdk"
adb reverse tcp:8787 tcp:8787
adb reverse tcp:8081 tcp:8081
REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 npm run android -- --device
```

接続した実機を選択します。ビルド・インストール後にFlockaが起動し、MetroからJavaScriptを読み込みます。`adb reverse` により、端末からの `localhost:8787` と `localhost:8081` がMacへ転送されます。MetroのホストもUSB転送先の127.0.0.1に指定しています。

複数の端末・エミュレーターを接続している場合、`adb -s <端末ID> reverse ...` で接続先を指定してください。USBをつなぎ直した場合はreverse設定を再実行します。

## 4. コードを変更して確認する

JavaScript/TypeScriptだけの変更は、保存するとFast Refreshで反映されます。Metroを終了した後は、APIを起動したまま次で再開できます。

```bash
npm run dev:mobile -- --dev-client --localhost
```

Expoのターミナルで `j` を押すとReact Native DevToolsを開けます。Consoleでログ、Sourcesでブレークポイント、NetworkでAPI通信を確認できます。ネイティブモジュールやconfig pluginを変更した場合は、手順3でビルドし直します。

この手順はデバッグ用です。ストア向けの署名済み配布ビルドとは別です。

参照: [Expoのローカル開発ビルド](https://docs.expo.dev/guides/local-app-development/)、[React Native DevTools](https://docs.expo.dev/debugging/tools/)、[AndroidのUSBデバッグ](https://developer.android.com/tools/adb#Enabling)、[ADBのreverse転送](https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/docs/user/adb.1.md)
