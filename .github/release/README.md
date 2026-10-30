# 手動リリースPR

GitHubの **Actions → Prepare release PR → Run workflow** を開き、ブランチは `release`、`version` は `1.0.1` のように指定します。push・マージ・定期実行では動きません。

実行時点の `dev` のコミットを固定し、devの全体検証、Web・iOS・Android書き出しを行ってから、そのコミットの実行ファイルだけをrelease構成へ同期します。`design/`、`tests/`、`e2e/`、`docs/`、AIツール設定、lint用設定・依存は移しません。コピー対象は `prepare.mjs` の `directories` と `files` に明記しています。対象内でdevから削除されたファイルはrelease候補からも削除します。既存のrelease固有 `.gitignore` は保持します。

ルートと4つのworkspaceの `package.json`、Expoの `version`、`package-lock.json` を揃えます。releaseより新しく、devの各バージョン以上の安定版のみ受け付けます。AndroidのversionCodeとiOSのbuildNumberは、既存のEAS設定（remote/autoIncrement）で管理します。バージョンをこのActions以外で手編集した場合も、次回はそれより大きい値を指定してください。

候補のlockfileはdevの固定バージョンを起点に再計算し、`npm ci`、型検査、API dry-run、iOS・Android・Web書き出しが通ってから `automation/release-v<version>` をpushしてrelease向けPRを作ります。差分を確認して手動でマージしてください。releaseへの直接push、タグ付け、GitHub Release作成、本番デプロイは行いません。既に同名のブランチがある場合は上書きせず失敗します。既存PRを確認し、作り直す場合はそのPRと作業ブランチを整理してから再実行してください。

初回はこのワークフローと `.github/release/` を既定ブランチ `release` にマージする必要があります（GitHubのworkflow_dispatchの仕様）。AI変更などの機能PRは先にdevへマージしてから実行してください。

標準の `GITHUB_TOKEN` を使い、ジョブに `contents: write` と `pull-requests: write` を指定します。リポジトリの **Settings → Actions → General → Workflow permissions → Allow GitHub Actions to create and approve pull requests** を有効にしてください。独自トークンやCloudflareの認証情報は不要です。このワークフローはPRの作成だけを行い、レビューの承認は行いません。

GitHub Actionsが標準トークンで作ったPRでは、通常のpush/pull_requestワークフローが起動しません。このため、このActions自身がdevとrelease候補の検証・書き出しを完了させます。実行ログとPRに記録された元コミットを確認できます。

ローカルで同じ候補を作る場合（別のcheckoutが必要）:

```sh
node .github/release/prepare.mjs /path/to/dev-checkout /path/to/release-checkout 1.0.1
cd /path/to/release-checkout
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci
EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net npm run validate
EXPO_PUBLIC_API_URL=https://api.flocka.zofax.net npm run export:web
```

仕様の参照: [手動トリガー](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch)、[GITHUB_TOKENで起動されるワークフローの制限](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow#triggering-a-workflow-from-a-workflow)。
