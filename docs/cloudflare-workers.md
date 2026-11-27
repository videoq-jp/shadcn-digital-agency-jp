# Cloudflare Workersでの公開

コンポーネント集とA2UIデモを同じWorkerで公開する。静的ファイルはWorkers Static Assets、`/api/a2ui/*`はWorker、画面生成はWorkers AIの`@cf/openai/gpt-oss-120b`を使用する。ブラウザにCloudflareの認証情報は配布しない。

- コンポーネント集: https://shadcn-digital-agency-jp.yukiharada1228.workers.dev/
- A2UI: https://shadcn-digital-agency-jp.yukiharada1228.workers.dev/a2ui
- 旧PagesのプロジェクトとURLは廃止する。公開先は上記WorkersのURLのみ。

## 構成

`wrangler.jsonc`が配信設定の正本。旧Pagesと同じアカウントを使用する。旧Pagesプロジェクトは削除し、転送用の配信物やGit自動デプロイも残さない。`videoq-jp/videoq`の`apps/web/wrangler.jsonc`のように、フロントエンドとAPIをWorkerへまとめる方式を採用した。

生成UIは既存UI部品47種類すべてとA2UI基礎要素のColumn/Textを使用できる。Columnは縦配置、Textは段落で、既存のデザイントークンを使用する。独自のカードやグラフは含まない。ローカルの`npm run demo:llm`は従来どおりこのPCのCodexログインを使用し、公開版とは認証を共有しない。

## 開発・デプロイ

```sh
npm ci
npm run worker:types
npm run typecheck
npm test
npm run deploy:check
npm run deploy
```

`npm run deploy`はログイン済みのWranglerでビルドとWorkersへのデプロイを行う。`npm run worker:dev`はビルド後にローカルWorkerを起動する。AIバインディングは`remote: true`なので開発時も実際のWorkers AIを利用する。モデル利用料はCloudflareアカウント側に発生する。

ブラウザ用とWorker用でTypeScript設定を分け、Workerのバインディングとランタイム型はWranglerで生成する。設定を変更したら`npm run worker:types`を実行する。

この移行では公開デプロイをCLIで行う。Git pushだけでWorkerへ自動反映する設定は含まない。CIでは型・テスト・Workerのdry runを検査し、公開は`npm run deploy`で行う。Git連携を追加する場合はCloudflare Workers Buildsで`videoq-jp/shadcn-digital-agency-jp`を接続し、ビルドを`npm run build`、デプロイを`npx wrangler deploy`とする。既存PagesのGit設定は旧所有者を参照していたため流用しない。

## APIと制限

`GET /api/a2ui/status`は実際のプロバイダーを返す。`POST /api/a2ui/generate`はJSONまたはNDJSONで応答する。Workers AIにはA2UIメッセージ配列を通常のJSONとして直接生成させる。JSONを別の文字列へ二重に埋め込ませず、エスケープの負担を減らす。モデルが正常終了した応答に限り、jsonrepairで括弧等の構文を補正してから、通常と同じカタログ検証を行う。トークン上限・途中切断の応答は補正して成功扱いにしない。初期値や部品の仕様は自動補完せず、検証に通らない場合はモデルへ修正を依頼する。ローカルCodex版のmessagesJson形式もクライアントで引き続き扱う。モデルの回答部分だけを配信し、内部推論は配信しない。入力・ボタン操作・追加入力は現在の画面とデータモデルを含めて生成する。モデルの終了理由を確認し、トークン上限による打ち切り（`output_token_limit`）、応答途中の切断（`incomplete_stream`）、画面の検証失敗（`invalid_screen`）、タイムアウト（`generation_timeout`）を区別して返す。失敗時は追跡用のrequestIdを返し、ログには識別子・原因コード・所要時間だけを残す。

入力全体100KB、依頼文4000文字、生成180秒、モデル出力16384トークン、検証失敗時の修正は1回まで。IPごとに5回/60秒のRate Limitバインディングを適用する。この制限はCloudflare拠点ごとの概算であり、アカウント全体の厳密な課金上限ではない。

公開APIは同一オリジンから利用する。画面データはサーバーでもカタログ検証し、HTML/スクリプト・未対応部品・実際の業務操作を許可しない。会話履歴は利用者のブラウザのlocalStorageに保存する。

A2UI SDK 0.16.1のZod 3 APIとの互換性は、Zod 4.6.7の公式v3互換APIと `npm run prepare:dependencies` で維持する。互換実装の巨大配列・Setは要素の検証前に拒否する修正を適用し、ESM/CJS双方のテストと依存監査で確認する。公開APIのリクエスト読み取りサイズ制限も維持する。詳細は [Zodの互換性と依存関係検査](./a2ui.md#zodの互換性と依存関係検査) を参照。

## 公開先とロールバック

GitHubリポジトリのWebサイトURLもWorkersのURLに揃える。リリースノートの生成処理とCHANGELOGの公開デモリンクもWorkersへ統一する。

Workerのロールバックは`npx wrangler deployments list`で対象を確認してから`npx wrangler rollback <VERSION_ID>`で行う。旧Pagesは再作成せず、Workersのバージョンで復元する。

参考: [videoqのWorkers設定](https://github.com/videoq-jp/videoq/blob/main/apps/web/wrangler.jsonc)、[PagesからWorkersへの移行](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)、[Workers AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/)。
