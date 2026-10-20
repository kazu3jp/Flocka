# 完成条件の照合（2026-10-20）

目的は、元デザインと操作を維持したExpoアプリを、実データで動作する状態に仕上げることです。コードが存在すること、ローカルで検査できたこと、本番や実機で確認できたことは区別します。現時点で全体の完成は確認できていません。

## 実装と検証の対応

| 要件                               | 現在の根拠                                                                                                                                                           | 残る確認・作業                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm workspacesのモノレポ           | [package.json](../package.json)、apps/mobile・apps/api・packages/domain・packages/api-client                                                                         | 構成は維持。通信・業務ロジック・DBアクセスは分離している                                                                                                                                        |
| 元デザイン・アセット               | [参照HTML](../design/flocka-v2-blue-prototype.html)、[CSS](../design/flocka-v2-game.css)、[画面仕様](flocka-v2-screen-spec.md)                                       | 原本は変更していない。全画面・全状態の一致は未確認                                                                                                                                              |
| Welcome・認証                      | [auth.spec.ts](../e2e/visual/auth.spec.ts)、[auth-lifecycle.spec.ts](../e2e/visual/auth-lifecycle.spec.ts)、[tour-motion.spec.ts](../e2e/visual/tour-motion.spec.ts) | 4サイズの画面・実APIでの認証フロー・動きの検査あり。途中フレームの全要素比較とネイティブ操作は未完了                                                                                            |
| 初期設定6ステップ                  | auth-lifecycle.spec.tsで入力・保存・再ログインを検査                                                                                                                 | 基準画像はあるが、各ステップの原本との厳密な配置比較は不足                                                                                                                                      |
| デッキ・カード・装飾・交換・自己PR | [application.spec.ts](../e2e/visual/application.spec.ts)、decoration.spec.ts、showcase.spec.ts、pr.spec.tsで原本比較・保存・失敗・競合を検査                         | 比較していない状態と、ネイティブの描画・キーボード・セーフエリアが残る                                                                                                                          |
| 自分・設定・つながった人           | application.spec.tsで画面操作と基準画像を検査                                                                                                                        | 自分・設定の原本との配置比較は不足。つながった人の一覧・送信済み・解除・空一覧、印象を贈る画面の5状態と場面メモの7状態を原本と4サイズで照合。アイコン編集・プロフィール編集・証言一覧/詳細・近距離/QR・交換確認・予想チャレンジは全状態の見た目が未検証 |
| 未開封の証言                       | [routing.spec.ts](../e2e/visual/routing.spec.ts)で詳細URL、キャンセル、通信失敗、再試行、開封後の表示を検査                                                          | APIは本人の証言を返す設計。今回の修正は画面で予想前に答えを表示しないためのもの                                                                                                                 |
| 公開範囲・ブロック・通報・削除依頼 | APIの実装と [application.integration.test.ts](../tests/application.integration.test.ts)、Settings画面の解除・取り下げ操作                                            | 公開範囲・ブロック・削除依頼の取り消しを実APIへ接続。公開範囲の変更番号とブロックの作成操作を検査し、古い取り消しを拒否する。運営対応の実際の業務は未検証                                       |
| 本物の交換・証言・QR               | [api.integration.test.ts](../tests/api.integration.test.ts)、交換ルート、QR生成とカメラ読取、ネイティブBLEモジュール                                                 | HTTPでは双方承認・参加者制限・ブロック等を検査。印象・場面メモの送信後の同期失敗は、受付済みの送信を繰り返さず再取得する。送信画面から受信画面までの通し操作と、カメラ・2実機BLEは未検証        |
| Better Auth・Resend                | [auth.integration.test.ts](../tests/auth.integration.test.ts)、auth-lifecycle.spec.tsで登録・確認・再設定・ログインを検査                                            | 外向きメール通信はテスト内で捕捉。実受信箱への到着、Apple/Googleの外部OAuth通信は未検証                                                                                                         |
| Workers・D1・R2                    | API統合テストでローカルのWorker・D1・R2とHTTPクライアントを使用。写真・バックアップ・認証・所有権を検査                                                              | 本番への今回の変更と0005〜0009は未適用。下書きの出典に対応したAPIをアプリより先に配布する必要がある                                                                                             |
| アカウント削除                     | [account-deletion.integration.test.ts](../tests/account-deletion.integration.test.ts)、auth-lifecycle.spec.tsで削除・失敗・再試行・古いバックアップ対策を検査        | 外部プロバイダーの実資格情報での失効と本番の削除処理は未検証                                                                                                                                    |
| Expo通知                           | [push.integration.test.ts](../tests/push.integration.test.ts)でCron・部分失敗・チケット・配信結果・解除端末を検査                                                    | Expoへの通信を捕捉している。APNs/FCMと実機への到着は未検証                                                                                                                                      |
| 運営情報・文書                     | [legal.ts](../packages/domain/src/legal.ts)に運営者・連絡先・本文・版を実装。登録時の同意はAPIでも検証                                                               | 文書の運営者による最終確認と、本番の管理者ID設定・対応業務は未確認                                                                                                                              |
| 実行・配布物                       | Web/iOS/Android書き出し、iOS Simulator向けarm64 Debug、Android DebugとAPK署名・4 ABIを検査                                                                           | ストア用署名・配布ビルド・端末での起動と操作は未検証。Debugビルドと配布ビルドは区別する                                                                                                         |

詳細な実行結果と限界は [検証記録](validation.md)、ローカル実行コマンドは [README](../README.md) を参照してください。追加の本番リソース作成・デプロイは、[AGENTS.md](../AGENTS.md)に従い明示的な依頼がある場合に実行します。

APIクライアントは通信断・不正なJSON・応答の型違い・不正な画像を利用者向けのエラーとして返します。認証情報の読み込みから本文の受信完了まで15秒の制限を適用し、期限後に認証情報を取得しても送信しません。自己PRの保存失敗時には編集内容を保持して再試行できます。

## ローカルで続ける作業

1. 原本比較が不足する画面を、実データの操作と合わせて検証・修正する。
2. ネイティブUI操作環境が利用できる状態で、画面・入力・戻る操作を確認する。
3. Resend・OAuth・Expo通知を、運用対象の環境と実機で確認する。

前回のSimulator UI接続は `Sky Computer Use native pipe startup failed` で開始できませんでした。ツールの再初期化でも同じ結果で、別のUI操作手段へ切り替えていません。この問題はビルド成功によって解消したとは扱いません。

## 実機の描画品質

2026-10-20に実機で重さ・文字欠け・遷移時の配置変化が報告されました。アニメーションの実行先、レイアウト計測、ボタン文字の幅、デッキの再計算を修正しています。現時点で同じ端末上の再現・改善確認はできていません。[修正内容と実機の確認手順](native-rendering.md)を参照してください。
