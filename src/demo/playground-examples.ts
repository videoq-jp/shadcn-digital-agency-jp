import { allComponentsMessages } from "@/lib/a2ui/showcase"
import { DIGITAL_AGENCY_CATALOG_ID } from "@/lib/a2ui/catalog"

function screen(
  id: string,
  data: Record<string, unknown>,
  components: Record<string, unknown>[]
) {
  return [
    {
      version: "1.0",
      createSurface: { surfaceId: id, catalogId: DIGITAL_AGENCY_CATALOG_ID },
    },
    {
      version: "1.0",
      updateDataModel: { surfaceId: id, path: "/", value: data },
    },
    { version: "1.0", updateComponents: { surfaceId: id, components } },
  ]
}

const dashboard = screen("starter-dashboard", {}, [
  {
    id: "root",
    component: "Column",
    children: ["header", "stats", "regions", "table"],
  },
  { id: "header", component: "Column", children: ["heading", "intro"] },
  { id: "heading", component: "Heading", text: "Q3 revenue review" },
  {
    id: "intro",
    component: "Text",
    text: "Billing data, refreshed hourly. Edit any value on the left and watch it re-render.",
  },
  {
    id: "stats",
    component: "DescriptionList",
    items: [
      { term: "Visitors", description: "84,210" },
      { term: "Signups", description: "2,318" },
      { term: "Conversion", description: "2.75%" },
      { term: "Avg. session", description: "4m 12s" },
    ],
  },
  {
    id: "regions",
    component: "Table",
    caption: "Revenue by plan (USD)",
    columns: ["Plan", "July", "August", "September"],
    rows: [
      ["Enterprise", "8900", "9400", "10800"],
      ["Scale", "6100", "6900", "7400"],
      ["Pro", "2500", "2700", "3000"],
    ],
  },
  {
    id: "table",
    component: "Table",
    caption: "Top accounts",
    columns: ["Account", "Plan", "Status", "MRR", "Growth", "Seats", "Renewal"],
    rows: [
      [
        "Northwind Labs",
        "Enterprise",
        "Active",
        "$12,400",
        "18.2%",
        "240",
        "Feb 14, 2027",
      ],
      [
        "Acme Studio",
        "Scale",
        "Active",
        "$4,850",
        "12.4%",
        "72",
        "Mar 2, 2027",
      ],
      [
        "Orbit Systems",
        "Enterprise",
        "Active",
        "$9,200",
        "9.6%",
        "180",
        "Jan 20, 2027",
      ],
      ["Linear Works", "Pro", "Active", "$1,620", "6.8%", "24", "Feb 8, 2027"],
      [
        "Atlas Design",
        "Scale",
        "Paused",
        "$3,480",
        "4.1%",
        "48",
        "Mar 12, 2027",
      ],
      ["Field Notes", "Pro", "Active", "$980", "8.2%", "16", "Jan 30, 2027"],
      [
        "Helix Cloud",
        "Enterprise",
        "Active",
        "$8,600",
        "15.3%",
        "160",
        "Apr 6, 2027",
      ],
      ["Cedar Labs", "Scale", "Active", "$2,740", "7.5%", "36", "Feb 24, 2027"],
    ],
  },
])

const event = screen(
  "event",
  { name: "", people: "1", notes: "", agree: false },
  [
    {
      id: "root",
      component: "Column",
      children: [
        "heading",
        "intro",
        "name",
        "people",
        "notes",
        "agree",
        "submit",
      ],
    },
    {
      id: "heading",
      component: "Heading",
      text: "まちの清掃イベント 参加申込",
    },
    {
      id: "intro",
      component: "Text",
      text: "一緒にまちをきれいにしませんか。氏名と参加人数を入力してください。実際の申込は送信されません。",
    },
    {
      id: "name",
      component: "Input",
      label: "氏名",
      required: true,
      value: { "@path": "/name" },
    },
    {
      id: "people",
      component: "Select",
      label: "参加人数",
      value: { "@path": "/people" },
      options: ["1", "2", "3", "4", "5"].map((value) => ({
        value,
        label: `${value}人`,
      })),
    },
    {
      id: "notes",
      component: "Textarea",
      label: "連絡事項",
      value: { "@path": "/notes" },
    },
    {
      id: "agree",
      component: "Checkbox",
      label: "参加案内を確認しました",
      value: { "@path": "/agree" },
    },
    {
      id: "submit",
      component: "Button",
      label: "入力内容を確認",
      action: {
        event: {
          name: "confirm_event",
          context: {
            name: { "@path": "/name" },
            people: { "@path": "/people" },
            notes: { "@path": "/notes" },
            agree: { "@path": "/agree" },
          },
        },
      },
    },
  ]
)

const consultation = screen(
  "consultation",
  { name: "", service: "moving", date: "", message: "" },
  [
    {
      id: "root",
      component: "Column",
      children: [
        "heading",
        "intro",
        "service",
        "name",
        "date",
        "message",
        "submit",
      ],
    },
    { id: "heading", component: "Heading", text: "窓口相談の予約" },
    {
      id: "intro",
      component: "Text",
      text: "ご希望の相談内容と日時を教えてください。この画面は予約操作のサンプルです。",
    },
    {
      id: "service",
      component: "Select",
      label: "相談内容",
      value: { "@path": "/service" },
      options: [
        { value: "moving", label: "引越し・住所変更" },
        { value: "parenting", label: "子育て支援" },
        { value: "other", label: "その他の手続き" },
      ],
    },
    {
      id: "name",
      component: "Input",
      label: "氏名",
      required: true,
      value: { "@path": "/name" },
    },
    {
      id: "date",
      component: "Input",
      label: "希望日時",
      value: { "@path": "/date" },
    },
    {
      id: "message",
      component: "Textarea",
      label: "相談したいこと",
      value: { "@path": "/message" },
    },
    {
      id: "submit",
      component: "Button",
      label: "予約内容を確認",
      action: {
        event: {
          name: "confirm_consultation",
          context: {
            name: { "@path": "/name" },
            service: { "@path": "/service" },
            date: { "@path": "/date" },
            message: { "@path": "/message" },
          },
        },
      },
    },
  ]
)

const survey = screen(
  "survey",
  { rating: "good", comment: "", contact: false },
  [
    {
      id: "root",
      component: "Column",
      children: ["heading", "intro", "rating", "comment", "contact", "submit"],
    },
    {
      id: "heading",
      component: "Heading",
      text: "サービスの使い心地を教えてください",
    },
    {
      id: "intro",
      component: "Text",
      text: "よりよいサービスづくりのため、ご意見をお聞かせください。回答は外部へ送信されません。",
    },
    {
      id: "rating",
      component: "Select",
      label: "満足度",
      value: { "@path": "/rating" },
      options: [
        { value: "great", label: "とても満足" },
        { value: "good", label: "満足" },
        { value: "neutral", label: "どちらでもない" },
        { value: "poor", label: "改善してほしい" },
      ],
    },
    {
      id: "comment",
      component: "Textarea",
      label: "ご意見・ご要望",
      value: { "@path": "/comment" },
    },
    {
      id: "contact",
      component: "Checkbox",
      label: "サービス改善のための連絡を希望します",
      value: { "@path": "/contact" },
    },
    {
      id: "submit",
      component: "Button",
      label: "回答を確認",
      action: {
        event: {
          name: "confirm_feedback",
          context: {
            rating: { "@path": "/rating" },
            comment: { "@path": "/comment" },
            contact: { "@path": "/contact" },
          },
        },
      },
    },
  ]
)

export const playgroundExamples = [
  {
    id: "dashboard",
    title: "Revenue dashboard",
    description: "数字を、ひと目でわかる画面に",
    icon: "chart",
    prompt:
      "行政サービスの申請状況ダッシュボードを作って。DescriptionListで申請件数・完了率・平均処理日数・オンライン利用率、Tableで最近の申請一覧を表示して。架空のサンプルデータを使い、その旨を明記して。",
    messages: dashboard,
  },
  {
    id: "event",
    title: "地域イベントの参加申込",
    description: "入力から確認まで、ひとつの流れに",
    icon: "event",
    prompt:
      "地域の清掃イベントの参加申込フォームを作って。氏名、Selectで参加人数、連絡事項、同意チェック、入力内容を確認するボタンを用意して。実際の申込は送信しないで。",
    messages: event,
  },
  {
    id: "consultation",
    title: "窓口相談の予約フォーム",
    description: "相談内容に合わせた手続きを",
    icon: "calendar",
    prompt:
      "行政窓口の相談予約フォームを作って。Selectで相談内容、氏名、希望日時、相談したいこと、予約内容の確認ボタンを用意して。実際の予約は行わないで。",
    messages: consultation,
  },
  {
    id: "survey",
    title: "サービスの満足度アンケート",
    description: "声を集める、やさしいフォーム",
    icon: "message",
    prompt:
      "行政サービスの満足度アンケートを作って。Selectで満足度、自由記述、連絡希望のチェック、回答を確認するボタンを用意して。実際の回答は送信しないで。",
    messages: survey,
  },
  {
    id: "all-components",
    title: "全47部品のショーケース",
    description: "カレンダーからタブまで、すべて操作できます",
    icon: "calendar",
    prompt:
      "カレンダーで日付を選ぶ相談予約画面を作って。Calendar、DatePicker、RadioGroup、Switch、Tabs、確認用Dialogを使って。",
    messages: allComponentsMessages,
  },
]
