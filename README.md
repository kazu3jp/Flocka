# Flocka

<div align="center">
  <img src="./assets/readme/hero.png" alt="Flocka - 自分の強み、自分だけで探さない。" width="100%">

  <br>
  <br>

  <strong>仲間の言葉で、知らなかった自分の強みに出会うアプリ。</strong>

  <br>
  <br>

  <img src="https://img.shields.io/badge/Expo-57.0.30-000020?style=flat-square&logo=expo&logoColor=white" alt="Expo 57.0.30">
  <img src="https://img.shields.io/badge/React_Native-0.86.3-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React Native 0.86.3">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflareworkers&logoColor=white" alt="Cloudflare Workers">
  <img src="https://img.shields.io/badge/Bluetooth_LE-0082FC?style=flat-square&logo=bluetooth&logoColor=white" alt="Bluetooth LE">
</div>

## Flockaとは

Flockaは、自分では気づけなかった強みを、実際に一緒に過ごした仲間の言葉から見つけるアプリです。

自己分析やAIだけで自己PRを作ると、材料になるのは自分で思いついた強みだけになりがちです。Flockaでは、仲間が実際に見た行動と、そのときの状況を「証言」として集めます。自分の思い込みではなく、周りの人が見つけた具体的なエピソードを、強みと自己PRの根拠にします。

<p align="center">
  <img src="./assets/readme/product-overview.png" alt="Flockaのプロダクト概要" width="100%">
</p>

## 体験の流れ

### 01 — 自分で思う強みを選ぶ

登録の最後に、まず自分が強みだと思うカードを選びます。

<p align="center">
  <img src="./assets/readme/step-01-choose-strengths.png" alt="自分で思う強みを選ぶ画面" width="100%">
</p>

### 02 — 会った人とカードを交換する

Bluetoothで近くの人を見つけるか、QRコードを使ってその場で交換します。

<p align="center">
  <img src="./assets/readme/step-02-exchange.png" alt="会った人とカードを交換する画面" width="100%">
</p>

### 03 — 出会いのメモを残す

どこで、なぜ出会ったのかを記録し、あとから届く言葉に文脈を残します。

<p align="center">
  <img src="./assets/readme/step-03-encounter-memo.png" alt="出会いのメモを残す画面" width="100%">
</p>

### 04 — 印象を理由つきで贈る

相手の強みを表す言葉を選び、実際に見た行動やエピソードを添えます。

<p align="center">
  <img src="./assets/readme/step-04-give-impression.png" alt="印象を理由つきで贈る画面" width="100%">
</p>

### 05 — 予想してから言葉を開ける

届いた言葉は封筒で届きます。どの強みを見つけてもらえたか予想してから開く、ゲームのような体験です。

<p align="center">
  <img src="./assets/readme/step-05-open-message.png" alt="予想してから届いた言葉を開ける画面" width="100%">
</p>

### 06 — 知らなかった強みを発見する

別々の2人以上が同じ強みを挙げると「確認済み」になり、自分だけでは選ばなかった強みが新発見として残ります。

<p align="center">
  <img src="./assets/readme/step-06-discover-strength.png" alt="知らなかった強みを発見する画面" width="100%">
</p>

### 07 — 仲間の言葉から自己PRを作る

証言に含まれる具体的な言葉を根拠に、自己PRの下書きを組み立てます。

<p align="center">
  <img src="./assets/readme/step-07-create-pr.png" alt="仲間の言葉から自己PRを作る画面" width="100%">
</p>

## AIに、作り話はさせない

FlockaのAIは、強みや経験をゼロから考える役ではありません。材料は、本人へ実際に届いた仲間の証言だけです。

- サーバーが、本人に届いた証言と確認済みの強みをD1から読み込む
- Workers AIが、各文に根拠となる証言番号と原文引用を付けた自己PRをJSONで返す
- ZodでJSONの形式を検証し、全体で別々の証言を2件以上使っているかを確認する
- サーバーが各文の引用・数字・内容語を、指定された証言の原文と照合する
- Clefが各文について、指定された証言で内容全体を裏づけられる確率を判定する
- 根拠を示せない文が1つでもあるAI出力は、自己PRとして返さない

文章を整えても、誰が・いつ・どこで見た強みなのかという根拠は消しません。

## 近くの人と、その場で交換

<p align="center">
  <img src="./assets/readme/nearby-exchange.png" alt="Bluetooth LEとQRコードによる近距離交換" width="100%">
</p>

近距離交換はBluetooth LEのネイティブモジュールで実装しています。Bluetoothが途中でオフになった場合は再設定を案内し、アプリへ戻ると自動で探索を再開します。Bluetoothを使えない場面では、10分間・1人だけが使えるQR交換コードを利用できます。

## 技術構成

| カテゴリ | 技術 |
| --- | --- |
| モバイル | ![Expo](https://img.shields.io/badge/Expo-57-000020?style=flat-square&logo=expo&logoColor=white) ![React Native](https://img.shields.io/badge/React_Native-0.86-20232A?style=flat-square&logo=react&logoColor=61DAFB) ![React](https://img.shields.io/badge/React-19.2-20232A?style=flat-square&logo=react&logoColor=61DAFB) ![Expo Router](https://img.shields.io/badge/Expo_Router-000020?style=flat-square&logo=expo&logoColor=white) |
| UI | ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Reanimated](https://img.shields.io/badge/Reanimated-4.5-6C5CE7?style=flat-square) ![SVG](https://img.shields.io/badge/React_Native_SVG-FFB13B?style=flat-square&logo=svg&logoColor=black) |
| 端末機能 | ![Camera](https://img.shields.io/badge/Expo_Camera-000020?style=flat-square&logo=expo&logoColor=white) ![SecureStore](https://img.shields.io/badge/Expo_SecureStore-000020?style=flat-square&logo=expo&logoColor=white) ![AsyncStorage](https://img.shields.io/badge/AsyncStorage-6B7280?style=flat-square) |
| 通知 | ![Expo Notifications](https://img.shields.io/badge/Expo_Notifications-000020?style=flat-square&logo=expo&logoColor=white) ![Expo Push](https://img.shields.io/badge/Expo_Push_Service-000020?style=flat-square&logo=expo&logoColor=white) ![Firebase Cloud Messaging](https://img.shields.io/badge/Firebase_Cloud_Messaging-FFCA28?style=flat-square&logo=firebase&logoColor=black) ![Apple Push Notification Service](https://img.shields.io/badge/Apple_APNs-000000?style=flat-square&logo=apple&logoColor=white) |
| 認証・メール | ![Better Auth](https://img.shields.io/badge/Better_Auth-111111?style=flat-square) ![Google](https://img.shields.io/badge/Google_Sign--In-4285F4?style=flat-square&logo=google&logoColor=white) ![Resend](https://img.shields.io/badge/Resend-000000?style=flat-square&logo=resend&logoColor=white) |
| 交換 | ![BLE](https://img.shields.io/badge/Bluetooth_LE-0082FC?style=flat-square&logo=bluetooth&logoColor=white) ![Kotlin](https://img.shields.io/badge/Kotlin-7F52FF?style=flat-square&logo=kotlin&logoColor=white) ![Swift](https://img.shields.io/badge/Swift-F05138?style=flat-square&logo=swift&logoColor=white) ![QR](https://img.shields.io/badge/QR_Code-000000?style=flat-square) |
| API・データ | ![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=flat-square&logo=cloudflareworkers&logoColor=white) ![Hono](https://img.shields.io/badge/Hono-E36002?style=flat-square&logo=hono&logoColor=white) ![D1](https://img.shields.io/badge/Cloudflare_D1-F38020?style=flat-square&logo=cloudflare&logoColor=white) ![R2](https://img.shields.io/badge/Cloudflare_R2-F38020?style=flat-square&logo=cloudflare&logoColor=white) ![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=000000) |
| AI | ![Workers AI](https://img.shields.io/badge/Workers_AI-F38020?style=flat-square&logo=cloudflare&logoColor=white) ![Gemma 4 26B](https://img.shields.io/badge/Gemma_4_26B-4285F4?style=flat-square&logo=google&logoColor=white) ![Clef](https://img.shields.io/badge/Clef-Grounding-7C3AED?style=flat-square&logo=cloudflare&logoColor=white) ![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat-square&logo=zod&logoColor=white) |
| ビルド | ![Node.js](https://img.shields.io/badge/Node.js-22.22.3-339933?style=flat-square&logo=nodedotjs&logoColor=white) ![npm Workspaces](https://img.shields.io/badge/npm_Workspaces-CB3837?style=flat-square&logo=npm&logoColor=white) ![Wrangler](https://img.shields.io/badge/Wrangler-4.150-F38020?style=flat-square&logo=cloudflare&logoColor=white) |
