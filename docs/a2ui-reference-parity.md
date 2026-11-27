# A2UI Playgroundの動作調査

参照サイト: <https://a2ui.open.bot/>。公開ソースは [CopilotKit A2UI Playground](https://github.com/CopilotKit/CopilotKit/tree/dd27eb85e1e6af881595e74871bb342d40cad3e0/examples/showcases/a2ui-playground)（調査時のコミット `dd27eb85e1e6af881595e74871bb342d40cad3e0`）。

## REAでの調査

ユーザー指定の [morluto/rea](https://github.com/morluto/rea) のCLI `rea-agents@6.10.1` を実行。PCのNode 26.12.0はREAの最低要件26.12.1に届かなかったため、システムを変更せず一時的な `node@26.13.0` で実行した。グローバルなMCP設定やCodex設定は変更していない。

```sh
# 参照ソースを /tmp/a2ui-reference-source に取得した状態で /tmp から実行
npx -y -p node@26.13.0 -p rea-agents@6.10.1 rea \
  analyze-javascript-application \
  /tmp/a2ui-reference-source/examples/showcases/a2ui-playground \
  --max-semantic-nodes 12000 --max-semantic-nodes-per-file 1000 \
  --detail summary --evidence_output /tmp/a2ui-rea-evidence.json --json \
  > /tmp/a2ui-rea-summary.json
```

280ファイルを調査し、JavaScript/TypeScript 264ファイルをパース（失敗0）。証拠ID・ハッシュ・機械的集計は [REAの集計](./a2ui-rea-summary.json) に保存。完全なEvidenceは実行PCの `/tmp/a2ui-rea-evidence.json` にある。意味グラフにはノード数の上限を設けたため、解析は部分的であり、実行時の完全一致を証明するものではない。

静的解析後に `composer.tsx`、`json-editor.tsx`、`workbench.tsx`、`ask-model.tsx`、`json-starters.ts`、`run-store.ts` を読んで状態遷移を確認し、ego-browserで公開サイトの操作と照合した。公開サイトとGitHubのmainが同一ビルドであることまでは確認していない。コードの一括移植はせず、このリポジトリのカタログとCodex接続に合わせて実装している。外側のデザイントークン・フォント・A2UIマークは出典のライセンスを添えて取り入れ、生成領域のデジタル庁コンポーネントには上書きのスキンを適用しない。

## 対応した操作

| 本家で確認した操作             | このデモの実装                                                     |
| ------------------------------ | ------------------------------------------------------------------ |
| 依頼文と候補から開始           | 本家と同じ候補4種類と自由入力                                      |
| Enterで送信、Shift+Enterで改行 | IME変換中のEnterも考慮                                             |
| 生成中に次の依頼を予約         | 1件予約、後の依頼で置換、取消時に入力欄へ戻す                      |
| モデルが書いている内容を表示   | Codex App Serverの実際のdeltaをJSON streamへ表示                   |
| 生成途中の画面                 | 完結した部品を順次描画し、最終応答を完全検証                       |
| AIなしで編集開始               | JSONエディターとプレビューを同時表示                               |
| 編集後200msで検証              | 有効な変更を自動反映、不正な間は最後の有効な画面を保持             |
| 空白変更では画面を維持         | 意味が同じJSONでは再マウントせず入力値を保持                       |
| 編集対象・Reset・Copy・Export  | 現在の画面とサンプルの切替、選択時点へのリセット、コピー、JSON出力 |
| コードの色分け・行列位置       | 構文色分け、行番号、カーソルの行・列、Tabの2空白入力               |
| 編集画面からモデルへ依頼       | デバウンス前の最新JSONも送信対象にする                             |
| パネルの開閉・幅変更           | 会話・結果の開閉、編集幅の切替、ドラッグ/キーボードで境界調整      |
| 履歴から以前の画面を選択       | 生成バージョンを復元                                               |
| 会話を再読込後に復元           | localStorageへ直近12件、画面、編集内容、依頼文を保存               |
| 新しい会話                     | 進行中の生成、予約、会話、保存データをリセット                     |
| デザイン設定・候補メニュー     | デジタル庁カタログ、対応Format、候補の入力欄への挿入               |
| ダッシュボードの操作           | 既存DescriptionListによる指標表示と既存Tableによる一覧表示         |

## 同一ではない範囲

この実装は既存UI部品47種類すべてとA2UI補助要素2種類を使う。公開版はWorkers AI、ローカル版はこのPCのCodexログインで動作する。CopilotKit・Material等へのデザインシステム切替、Gemini等のプロバイダー、Express/Blueprint形式、本家の全カタログ・地図・外部データ検索・録画再生は実装していない。メニューには実際に使えるデザインとA2UI JSONのみを表示している。外側の開始画面、会話とコードの配置、書体、余白、背景色は本家へ合わせている。生成されるA2UIの部品はデジタル庁デザインを維持する。ブランドの副表示とモデル名はローカルCodex接続を示す。

## 検証

自動テストではキューの順序と取り消し、最新編集内容の送信、不正JSONでの画面保持、空白変更による入力値維持、履歴復元、既存Tableへの行追加、パネル操作、UTF-8分割ストリーム、Codexのstdioハンドシェイクを確認。実LLMではフォーム生成中に見出し変更を予約し、2つの応答が順番に完了して画面と履歴が更新されることを確認した。390px幅と再読み込みによる復元もego-browserで確認。

## 表示の比較

前の実装では操作の再現を優先し、外側のデザイン差を残したまま再現度を高く説明していた。今回、同じ画面幅で比較して外側の配置を修正した。参照: [表示比較と実測](./a2ui-visual-comparison.md)。

## 部品の出典

生成UIはこのリポジトリの既存UI部品47種類すべてを使用できる。Calendar、DatePicker、Tabs、Dialog等もA2UIカタログから利用可能。ColumnとTextはレイアウト・本文用のA2UI補助要素。独自のGrid、Card、StatGroup、BarChart、AreaChart、DataTableは含まず、グラフのデータは既存Table等で表示する。対応範囲とプロパティは[A2UIカタログ](./a2ui.md#カタログ)を参照。
