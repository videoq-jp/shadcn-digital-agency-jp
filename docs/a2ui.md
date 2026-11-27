# A2UI integration（非公式）

既存のデジタル庁デザインを参考にしたReact部品を、A2UIから組み立てるためのカタログとアダプターです。デジタル庁公式の製品ではありません。

## デモ

```bash
npm install
npm run demo
```

`http://127.0.0.1:5173/a2ui` を開いてください。トップページの「A2UIデモ」からも移動できます。

[A2UI Playground](https://a2ui.open.bot/)の、依頼文から始めて会話・プレビュー・JSONを行き来する体験を参考にした日本語デモです。外側の配置・書体・余白は本家に合わせ、生成される部品はこのリポジトリの非公式デジタル庁デザインを使います。LLMはこのPCのCodexログインを利用します。

- 本家と同じ4種類のダッシュボード候補を表示
- 「AIを使わずに試す」でダッシュボードのJSONとプレビューを開く。エディターの選択欄からイベント申込、窓口予約、アンケートのサンプルも開けます
- 既存Table・DescriptionListの表示と入力・選択・ボタン操作を試せます。サンプルモードでは外部へ送信しません
- 生成後は会話パネルから追加の変更を依頼。生成履歴のカードで以前の画面も表示可能
- 左側の会話内に生成画面、右側に「JSON stream」「JSON」「Run」を表示。「JSON」→「Edit」で編集モードへ移り、「Done」で戻ります。移動では入力中の値を保持
- JSON編集は200msの待機後に自動反映。「変更を反映」（またはCtrl/Cmd + Enter）でも即時に検証可能。構文色分け、行・列表示、サンプルの切替、リセットに対応。検証エラー時は最後の有効な画面を保持
- 生成中も入力でき、Enterで次の依頼を1件予約。予約の取り消しでは依頼文を入力欄へ戻す
- 編集画面下の「この画面の変更をAIに依頼」で最新の編集内容をCodexへ送信
- パネルの開閉、編集幅の切替、会話パネルの境界のドラッグ・左右矢印キーによる幅調整
- JSONのコピー・ファイル書き出し、デスクトップ/タブレット/スマートフォン幅のプレビュー、ライト/ダークテーマ
- 会話（直近12件）、生成済み画面、JSON編集内容、依頼文とテーマをこのブラウザのlocalStorageへ保存し、再読み込み時に復元。「新しい会話」で生成を中断して保存済みの会話も消去。プレビュー内で入力した値だけの変更は再読み込みで初期値へ戻る

## このPCのCodexログインでLLMを試す

Codex CLIをインストールし、ChatGPTでログインしたPCで実行します。

```bash
codex login                 # 既にログイン済みなら不要
codex login status
npm run demo:llm
```

`http://127.0.0.1:5173/a2ui` を開き、依頼欄に文章を入力して送信ボタン（↑）を押すか、Enterで送信してください。Shift + Enterでは改行できます。候補を選んでも生成を開始できます。既存のデモが5173番ポートを使っている場合は、先にそのサーバーを停止してください。

例: 「地域の清掃イベントの参加申込フォーム。氏名、参加人数、連絡事項、同意チェックと確認ボタン」。生成された画面のボタンを押すと、現在の入力値と操作イベントをLLMに送り、応答の画面へ更新します。直前の操作と生成されたJSONも確認できます。実際の申請・予約・保存などの業務処理は接続していません。

最初の生成時に依頼文を、追加依頼時に現在の画面と入力値を、生成画面のボタン操作時に画面のJSON・入力データ・操作内容をCodexへ送信します。ChatGPTのCodex利用枠を使用し、利用上限に達すると生成できません。認証情報はインストール済みCLIが管理し、アプリはキーやトークンを読み取ったりブラウザに渡したりしません。

ローカル開発専用のVite APIから、公式CLIの `codex app-server --listen stdio://` を起動します。[公式App Serverプロトコル](https://developers.openai.com/codex/app-server)の `thread/start`（ephemeral、read-only、approvalPolicy: never）、`turn/start`（outputSchema）、`item/agentMessage/delta` を使用します。検索・シェル・サブエージェント・Apps・Plugins・設定済みMCPを無効にする構成と、ツール承認要求を拒否するクライアントで、一時ディレクトリ内で画面データを生成します。既存のCodexログインはCLI自身が管理します。

ブラウザは `Accept: application/x-ndjson` で生成差分を受け取り、「JSON stream」に表示します。完結した部品だけを抽出して途中の画面を描画し、最終応答は完全なカタログ検証を通して確定します。不完全な文字列や部品を補完して描画することはありません。エラー・中断時は直前の確定画面へ戻ります。

モデルはCodexの設定に従い、必要なら起動前に `A2UI_CODEX_MODEL` で指定できます。`A2UI_CODEX_BIN` でCLI実行ファイルを指定できます。`Accept`を省略するAPIクライアントには従来の `codex exec --ignore-user-config --ephemeral --output-schema ...` による一括JSON応答も提供します。対応するCLIが必要です。

- `GET /api/a2ui/status`: LLM起動モードとChatGPTログイン状態
- `POST /api/a2ui/generate`: 依頼から画面生成、または操作に対する画面応答
- 生成結果をサーバーとクライアントの両側で検証。不適合時は1回だけLLMに修正を要求
- 同時生成は1件。120秒でタイムアウト。停止ボタン（■）で呼び出しを中断
- エラー時は現在の画面を保持。固定サンプルやJSON編集へ戻すことも可能

通常の `npm run demo` ではLLM実行を有効にしません。APIはlocalhost/127.0.0.1/::1かつ同じオリジンに限定し、Viteの開発サーバーでのみ提供します。`npm run demo:build`の静的成果物やshadcnの配布項目には、Codexサーバーは含まれません。公開サービス用の認証・セッション管理は別途必要です。

## shadcnで追加

```bash
npx shadcn@latest add videoq-jp/shadcn-digital-agency-jp/a2ui
```

この項目がリポジトリに公開された後に利用できます。A2UIの依存パッケージ、アダプター、カタログJSON、サンプルメッセージと必要な既存UI部品を追加します。テーマの読み込みはREADMEの手順に従ってください。`all-components`とは独立した任意追加の項目です。

## アプリへの接続

```tsx
import { useEffect, useState } from "react"
import { DigitalAgencySurface } from "@/components/a2ui/digital-agency-surface"
import {
  createDigitalAgencySession,
  type DigitalAgencySession,
} from "@/lib/a2ui/session"
import { applicationMessages } from "@/lib/a2ui/sample"

export function Example() {
  const [processor, setProcessor] = useState<DigitalAgencySession | null>(null)

  useEffect(() => {
    const session = createDigitalAgencySession((action) => {
      console.log({ version: "1.0", action })
      // 実運用では、認証された接続を使ってエージェントに転送する。
    })
    session.processMessages(applicationMessages)
    setProcessor(session)
    return () => session.dispose()
  }, [])

  return processor ? <DigitalAgencySurface processor={processor} /> : null
}
```

SSEやWebSocketから受け取った**パース済みメッセージ**を `session.processMessages(message)` に渡すと、部品・データ・surfaceの差分が反映されます。通信チャンクをそのまま渡すことはできません。JSON/JSONLのフレーミングは通信層で処理してください。会話ごとにセッションを作り、終了時に`dispose()`してください。

入力によるローカル変更だけでは送信しません（Playgroundでは追加依頼やボタン操作時に現在値を送ります）。`Button.action.event.context` の `{"@path":"/name"}` などは、ボタン操作時の現在値に解決されて `onAction` に渡ります。受信エラーの処理には `processMessagesWithErrors` または `processor.model.onError.subscribe(...)` が利用できます。

## カタログ

- プロトコル: **A2UI v1.0**
- 確認したSDK: `@a2ui/react` / `@a2ui/web_core` **0.16.1**（SDK番号とプロトコル番号は別）
- カタログID: `https://github.com/videoq-jp/shadcn-digital-agency-jp/catalogs/a2ui/v1`
- エージェント向けスキーマ: `src/lib/a2ui/catalog.json`
- 実装とスキーマの原本: `src/lib/a2ui/catalog.tsx`

カタログIDは識別子です。実行時にそのURLからコードやJSONを取得するものではありません。バックエンドには配布した `catalog.json` を読み込ませ、同じID・部品スキーマを使用してください。

既存の47種類すべてを利用できます。`Column`・`Text`を加えたカタログは49種類です。

| 部品名                | プロパティ（`?`は省略可）                             |
| --------------------- | ----------------------------------------------------- |
| `Column`              | `children`                                            |
| `Text`                | `text`                                                |
| `Heading`             | `text`, `level?`                                      |
| `Input`               | `label`, `value`, `required?`, `disabled?`            |
| `Textarea`            | `label`, `value`, `required?`, `disabled?`            |
| `Checkbox`            | `label`, `value`, `disabled?`                         |
| `Button`              | `label`, `variant?`, `disabled?`, `action`            |
| `Divider`             |                                                       |
| `Table`               | `caption`, `columns`, `rows`                          |
| `DescriptionList`     | `items`                                               |
| `Select`              | `label`, `value`, `disabled?`, `options`              |
| `Blockquote`          | `text`                                                |
| `ErrorText`           | `text`                                                |
| `SupportText`         | `text`                                                |
| `StatusBadge`         | `text`                                                |
| `ChipLabel`           | `text`                                                |
| `RequirementBadge`    | `text`, `optional?`                                   |
| `Label`               | `text`                                                |
| `Legend`              | `text`, `children?`                                   |
| `FormControlLabel`    | `label`, `children?`                                  |
| `Link`                | `text`, `href`, `newTab?`                             |
| `UtilityLink`         | `text`, `href`, `newTab?`                             |
| `List`                | `items`, `numbered?`                                  |
| `Image`               | `src`, `alt`, `caption?`                              |
| `EmergencyBanner`     | `title`, `text`, `children?`                          |
| `NotificationBanner`  | `title`, `text`, `type?`, `visible`, `children?`      |
| `ProgressIndicator`   | `label`, `value?`                                     |
| `Calendar`            | `label`, `value`, `disabled?`, `min?`, `max?`         |
| `DatePicker`          | `label`, `value`, `disabled?`, `min?`, `max?`         |
| `SeparatedDatePicker` | `label`, `value`, `disabled?`, `min?`, `max?`         |
| `RadioGroup`          | `label`, `value`, `disabled?`, `options`              |
| `Switch`              | `label`, `value`, `disabled?`                         |
| `SearchBox`           | `label`, `value`, `action`, `disabled?`               |
| `HamburgerMenuButton` | `label`, `value`, `disabled?`, `children?`            |
| `FileUpload`          | `label`, `value`, `disabled?`, `accept?`, `multiple?` |
| `Accordion`           | `title`, `value`, `children?`                         |
| `Disclosure`          | `title`, `value`, `children?`                         |
| `Dialog`              | `title`, `value`, `children?`                         |
| `Drawer`              | `title`, `value`, `children?`, `side?`                |
| `Tabs`                | `label`, `value`, `tabs`                              |
| `Breadcrumbs`         | `label`, `items`                                      |
| `HorizontalMenu`      | `label`, `value`, `options`                           |
| `MenuList`            | `label`, `value`, `options`                           |
| `MenuListBox`         | `label`, `value`, `options`                           |
| `LanguageSelector`    | `label`, `value`, `options`                           |
| `PageNavigation`      | `label`, `value`, `total`                             |
| `ResourceList`        | `items`, `variant?`                                   |
| `StepNavigation`      | `label`, `value`, `steps`, `orientation?`             |
| `Carousel`            | `label`, `value`, `slides`                            |

`text`、`label`、`title`、`value`、`visible`、`disabled`には対応する型のリテラルや `@path` バインディングを利用できます。`required`と`variant`は静的です。編集する値は`@path`でデータモデルに結び付けてください。Inputはこのプロジェクトの規約に合わせ、placeholderを公開しません。ラベルと入力欄はアダプターが関連付けます。

カタログの変更時は次を実行してください。

```bash
npm run a2ui:generate
npm run a2ui:check
npm run registry:generate
```

JSONはSDKの`Catalog.toJson()`から生成し、テストでReact側定義との一致と`Catalog.fromJson()`での読み込みを検証します。互換性を壊す変更ではカタログIDのバージョンを更新してください。

## 現在の範囲と実運用

現在11種類（既存UI部品9種類とA2UI補助要素2種類）の部品を提供します。既存の全47種類の自動変換や公開サービス向けの認証サーバーは含みません。ローカルでは上記のCodex CLI連携を利用できます。独自のAIバックエンドを接続する場合は、公式Agent SDKに同じカタログを読み込ませ、その出力をこのRendererへ送る構成も可能です。

`required`は入力欄の属性です。確認ボタンはHTML formのsubmitではなくA2UIイベントなので、業務上の必須チェック・認可・保存は受信先で実装してください。サンプルモードでは操作を確認するだけで、LLMモードでは入力内容に応じた画面を返します。任意HTML/JavaScript、外部URL、リモート関数はこのカタログに登録していません。

公式資料: [Client integration](https://a2ui.org/guides/client-integration/) / [Catalog definition](https://a2ui.org/guides/defining-a-catalog/)

本家の調査方法と対応範囲は [REAによる動作調査](./a2ui-reference-parity.md) を参照してください。

`Table` は既存のTable一式（caption・columns・rows）、`DescriptionList` は既存のDl/Dt/Dd（items: term・description）を使用します。`Column`と`Text`はA2UIのレイアウト・本文用補助要素です。独自のCard・グラフ・統計カード・拡張テーブルは含みません。

## 公開版

[公開Playground](https://shadcn-digital-agency-jp.yukiharada1228.workers.dev/a2ui) はCloudflare Workers AIを使用します。ローカルCodex版と同じカタログ・検証・ストリーミングAPIを使い、実行環境に合わせてプロバイダー名を表示します。[設定・デプロイ手順](./cloudflare-workers.md)。

## 全部品の操作とデータ

公開デモの「全47部品のショーケース」は全UI部品を含むA2UIメッセージを描画します。`src/lib/a2ui/showcase.ts` がそのデータです。テストではレジストリの `registry:ui` 全件をカタログと照合し、実際の既存部品のDOMが出ることを検査します。

- Calendarは年月移動・日付選択、DatePicker / SeparatedDatePickerは年月日入力と開閉可能なCalendarを提供します。`value`は`YYYY-MM-DD`または空文字列で初期化します。
- 入力、日付、ラジオ、選択メニュー、言語、Tabsの`value`は文字列。Checkbox、Switch、Accordion、Disclosure、Dialog、Drawer、HamburgerMenuButtonの`value`は真偽値。PageNavigationは1から、StepNavigationとCarouselは0から始まる数値です。全て初期値付き`@path`で結び付けます。
- NotificationBannerの`visible`も真偽値の`@path`です。閉じる操作をデータモデルに反映します。
- コンテナの`children`、Tabsの`tabs[].children`は部品IDの配列です。子は同じ`updateComponents.components`配列に独立して定義します。Tabsは矢印キー・Home・End、メニューは既存hookのキーボード操作を使います。
- FileUploadは選択・削除が可能です。`value`は`"[]"`で初期化し、選択したファイルの`name`・`size`・`type`だけをJSON文字列として保存します。ファイル内容のアップロード先はありません。
- SearchBoxとButtonはeventアクションを実行します。他の操作はローカルで値を更新し、次回のボタン操作や追加依頼時に現在値をLLMへ送ります。実際の予約・申込・決済は行いません。
- Link / UtilityLinkと画像・リソースのURLは実行可能なスキームを描画しません。HTML・JavaScript・任意のReactコードは生成・実行しません。
