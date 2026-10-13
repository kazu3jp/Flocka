# Flocka

代替手段禁止

- npm workspacesで `apps/mobile` (Expo), `apps/api` (Workers), `packages/domain`, `packages/api-client` を管理する。
- OpenDesignの参照デザインは `design/`。新しい見た目を推測で作らず、元のアセットを使う。
- 画面、業務ロジック、通信、DBへのアクセスを分離する。名前は具体的にし、意味のある関数・ファイルへ分割する。
- デモとサーバー上の実データを混ぜない。通信失敗を成功として扱わない。
- 変更後は `npm run validate`、影響するプラットフォームの書き出しを実行する。
- Cloudflareの本番リソース作成・デプロイは明示的な依頼がある場合に実行する。ローカル実行とdry-runは進めてよい。
