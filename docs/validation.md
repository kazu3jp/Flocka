# 検証記録（2026-10-17）

再開時のHEADは `fcf6166`、作業ツリーはクリーンでした。Claudeによる通知・通報・Cronの実装と本番設定の追加を読み直してから変更しています。

| 検証                                            | 結果                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 型検査・Lint・26件のテスト (`npm run validate`) | 通過（26/26）                                                                                                |
| Chromium VRT・画面操作                          | 4サイズ・44/44通過。156枚の基準画像                                                                          |
| UIからの認証ライフサイクル                      | 登録・メール確認・全6ステップの初期設定・保存・ログアウト・パスワード再設定・再ログイン・アカウント削除を4サイズで確認       |
| Expo Web・iOS・Androidの書き出し                | 最終コードで通過                                                                                             |
| Expo Doctor                                     | 前回21/21通過（今回は未実行）                                                                                                    |
| Android BLEモジュールのKotlinコンパイル         | 通過                                                                                                         |
| Androidアプリ全体のDebugビルド | 削除機能追加前の2026-10-17、`assembleDebug`成功。APKのv2署名、パッケージ名、4 CPU向けライブラリを確認 |
| iOS prebuild・CocoaPods                         | 通過。121依存関係、120 Pods                                                                                  |
| iOS Simulatorネイティブビルド                   | 削除機能追加前に通過。arm64・x86_64、署名なしのDebugビルド                                                                   |
| ローカルD1マイグレーション                      | 0001〜0008適用成功                                                                                           |
| 本番 `/health`                                  | 2026-10-14の既存デプロイでHTTP 200、`status: ok`を確認                                                                                       |
| GitHubリポジトリ                                | PRIVATEを確認                                                                                                |
| 配布用API接続先 | EASのAndroid/iOS設定と、Web/Android/iOSの実エントリーバンドルでHTTPS URLを確認 |
| GitHub Actions                                  | [削除API追加コミット70b7948で型検査・Lint・テスト・Web/native書き出しが通過](https://github.com/kazu3jp/Flocka/actions/runs/38993479233) |

今回の追加検証では、公開証言と同期が102件を取得できること、双方いずれかによるブロックで受信を除外すること、同時の通報対応が一度だけ確定すること、双方への交換通知と証言通知がトランザクションで登録されることを確認しました。規約同意のない初回登録の拒否と、明示的な同意の版・時刻の記録も対象です。

通知テストは実際のWorkers/D1上でCronハンドラーを起動し、Expoへの通信だけをテスト内で捕捉します。空のチケットを成功にしないこと、一部の送信が失敗した際に受付済み端末へ再送しないこと、配信結果を照会すること、登録無効の端末と設定解除後の再試行を除外することを確認しました。Resendの認証テストも実メール送信を行いません。

AndroidではKotlin構文エラーを修正しました。古いGATTコールバックやタイムアウトが新しい接続を解除しないよう、接続インスタンスを照合しています。iOSではCocoaPodsがNodeのパスをバイナリ文字列として返すため日本語パスで失敗していました。Expoのconfig pluginで有効なUTF-8出力を正しい文字コードとして扱い、プロジェクトを移動せず `pod install` を完了しています。生成されたnativeフォルダの手編集はしていません。

今回の変更を本番Workerへデプロイしていません。0005〜0008を本番へ適用する作業も未実施です。稼働確認は既存デプロイの `/health` に限定します。

画面のクリック操作と参照デザインとの比較画像を Chromium で検証しました。認証画面のヘッダー・入力欄・同意欄・固定フッターを元CSSの寸法に合わせ、同意チェック・選択中のタブなどの状態をWebのアクセシビリティ情報にも反映しています。参照とのピクセル差分はレポートに保存します。デッキ・カード詳細・装飾・交換・自己PRの比較では、まだ配置や表示に差が残るため、VRTの通過を完全一致の証明には使いません。

BLEの2端末通信、プッシュ通知の実際の到着、Apple/GoogleのOAuth通信、Resendメールの受信箱への到着は未検証です。Expo CLIで既存のEASプロジェクト `@kazu3jppurin/flocka` とIDを照合しました。アプリのリンクとビルドプロファイルをGitで管理し、Android/iOSのproduction設定がNode 22.22.3とHTTPSのAPI URLへ解決されることを確認しました。通知資格情報・OAuth資格情報と実機の到達確認は未検証です。規約本文の運営者による最終確認も未実施です。

カード詳細は元デザインの幅62%・高さ230px、説明文、反応パネル、証言と要約の構成へ修正しました。実際のカードと元HTMLのカードの幅・高さの差が1px以内であることを4サイズで検証します。この検査は基準画像の更新とは独立しています。同期操作は設定画面へ移し、元デザインにない24pxの共通バーを除きました。下部タブの通知バッジ、カードのスタンプ、背景の格子、未発見カードの縞模様も元CSSに合わせています。実際の交換で保存した場所はそのまま表示し、サンプル用の関係名へ置き換えません。

実行手順は [README](../README.md)、通知の開発者設定は [notifications.md](notifications.md) を参照してください。

ネイティブの追加検証コマンド（Node 22をPATHに設定した状態）:

```sh
cd apps/mobile/android
ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :flocka-nearby:compileDebugKotlin --console=plain
cd ../ios
xcodebuild -workspace Flocka.xcworkspace -scheme Flocka -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/FlockaExpoDerivedData CODE_SIGNING_ALLOWED=NO build
```

このiOSビルドはシミュレーター用です。実機署名・ストア向けビルドや、端末間BLE通信の確認を済ませたという意味ではありません。

Androidアプリ全体の追加検証:

```sh
cd apps/mobile/android
JAVA_HOME='/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home' ANDROID_HOME="$HOME/Library/Android/sdk" ./gradlew :app:assembleDebug --max-workers=2 --console=plain
```

以下のAPKは削除機能追加前のビルドです。今回の変更後はWeb・iOS・AndroidのJavaScript書き出しを検証しました。

生成物は `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`。パッケージ名は `jp.kazu3.flocka`、minSdk 24・targetSdk 36、arm64-v8a・armeabi-v7a・x86・x86_64を含みます。SHA-256は `69e6e68f572869c3ecf2670280e8839d63eb06f7b9f55967c82e4cab255a714e` です。開発クライアント用のDebug APKであり、ストア配布用の署名済みビルドとは区別します。起動時は `npm run dev:mobile -- --dev-client` でMetroを起動します。実機での操作確認は未実施です。

書き出し時にVRT用のAPI URLがMetroキャッシュから残る問題を修正しました。書き出しは毎回 `--clear` を指定し、ルートからの追加引数もExpoへ転送します。`npm run verify:export -- web` / `native` は、HTMLとmetadataが指す現在のエントリーバンドルに、指定したHTTPS API URLが埋め込まれ、VRTの接続先が混入していないことを検査します。CIでも各書き出しの直後に実行します。

アカウント作成を提供するアプリには、[Appleのアカウント削除要件](https://developer.apple.com/support/offering-account-deletion-in-your-app/)と[Google Playのアカウント削除要件](https://support.google.com/googleplay/android-developer/answer/13327111?hl=ja)が適用されます。アプリ内とWebの削除導線、確認メールによる本人確認、D1/R2の削除、全セッション・連携トークンの失効、失敗時の再試行を実装しました。隔離したWorkers/D1/R2で、501枚の写真の分割削除、外部連携失敗からの復旧、期限切れ・別アカウント・未ログインの拒否、古いバックアップによる復活防止、認証書き込みの競合を検証しました。画面からの削除と端末データ消去も4サイズで確認しています。Web画面の公開、本番のマイグレーション・デプロイ、実機のリンク起動と外部連携の実際の失効は未実施です。詳しくは [アカウント削除](account-deletion.md) を参照してください。

デッキ画面は、バナーの封筒の重なり、見出し・説明文の行高、プロフィールと自己PRバーの余白を元CSSに合わせました。640px高の画面には元CSSの720px以下の条件を反映し、通常の文字サイズでは6枚を画面内に配置します。大きな文字設定ではカード一覧をスクロールできます。デッキのヘッダー・バナー・先頭と末尾のカードは、参照HTMLとの位置・寸法を4サイズで照合しています。

GitHub Actionsの追加確認で、Wranglerの静的な名前付きimportをESLintが解析すると、CLI全体の解析によってNodeの2GBヒープを超える問題を再現しました。テスト環境の作成時に同じWrangler SQLパーサーを動的に読み込む形へ変更し、`NODE_OPTIONS=--max-old-space-size=2048 npm run validate` で26件すべての通過を確認しています。Lintの対象・ルールやCIのメモリ制限は緩和していません。
