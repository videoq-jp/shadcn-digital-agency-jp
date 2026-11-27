/** A real protocol screen covering every registry:ui item, also used by integration tests. */
export const showcaseData: Record<string, unknown> = {}
const bind = (key: string, value: unknown) => {
  showcaseData[key] = value
  return { "@path": `/${key}` }
}
const options = [
  { label: "オンライン", value: "online" },
  { label: "窓口", value: "counter" },
]
const child = ["example_content"]
const menu = (label: string, key: string) => ({
  label,
  value: bind(key, "online"),
  options,
})
const expandable = (title: string, key: string) => ({
  title,
  value: bind(key, false),
  children: child,
})
export const showcaseComponents: Record<string, unknown>[] = [
  { id: "heading", component: "Heading", text: "全47種類のコンポーネント" },
  { id: "input", component: "Input", label: "氏名", value: bind("name", "") },
  {
    id: "textarea",
    component: "Textarea",
    label: "相談内容",
    value: bind("details", ""),
  },
  {
    id: "checkbox",
    component: "Checkbox",
    label: "同意する",
    value: bind("agree", false),
  },
  {
    id: "button",
    component: "Button",
    label: "入力内容を確認",
    action: {
      event: {
        name: "confirm",
        context: {
          date: { "@path": "/date" },
          choice: { "@path": "/choice" },
          enabled: { "@path": "/enabled" },
          files: { "@path": "/files" },
        },
      },
    },
  },
  { id: "divider", component: "Divider" },
  {
    id: "table",
    component: "Table",
    caption: "申請一覧（架空）",
    columns: ["氏名", "状況"],
    rows: [["山田花子", "受付済み"]],
  },
  {
    id: "description_list",
    component: "DescriptionList",
    items: [{ term: "対応範囲", description: "47種類すべて" }],
  },
  { id: "select", component: "Select", ...menu("申込方法", "method") },
  { id: "blockquote", component: "Blockquote", text: "利用者の声" },
  { id: "chip_label", component: "ChipLabel", text: "お知らせ" },
  {
    id: "error_text",
    component: "ErrorText",
    text: "入力内容を確認してください",
  },
  { id: "support_text", component: "SupportText", text: "入力を補助する説明" },
  { id: "status_badge", component: "StatusBadge", text: "受付中" },
  { id: "requirement_badge", component: "RequirementBadge", text: "必須" },
  { id: "label", component: "Label", text: "ラベル" },
  { id: "legend", component: "Legend", text: "入力グループ", children: child },
  {
    id: "form_control_label",
    component: "FormControlLabel",
    label: "フォームのグループ",
    children: child,
  },
  { id: "link", component: "Link", text: "デモを開く", href: "/a2ui" },
  { id: "utility_link", component: "UtilityLink", text: "関連情報", href: "/" },
  { id: "list", component: "List", items: ["本人確認書類", "申請書"] },
  {
    id: "image",
    component: "Image",
    src: "https://placehold.co/600x300/png",
    alt: "サンプル画像",
    caption: "画像の説明",
  },
  {
    id: "emergency_banner",
    component: "EmergencyBanner",
    title: "訓練のお知らせ",
    text: "これはサンプルです",
    children: [],
  },
  {
    id: "notification_banner",
    component: "NotificationBanner",
    title: "受付のお知らせ",
    text: "サンプルのお知らせです",
    visible: bind("notice", true),
    children: [],
  },
  {
    id: "progress_indicator",
    component: "ProgressIndicator",
    label: "進捗",
    value: 50,
  },
  {
    id: "calendar",
    component: "Calendar",
    label: "相談日",
    value: bind("date", "2026-12-15"),
  },
  {
    id: "date_picker",
    component: "DatePicker",
    label: "開始日",
    value: bind("start", "2026-12-15"),
  },
  {
    id: "separated_date_picker",
    component: "SeparatedDatePicker",
    label: "終了日",
    value: bind("end", "2026-12-20"),
  },
  { id: "radio_group", component: "RadioGroup", ...menu("相談方法", "choice") },
  {
    id: "switch",
    component: "Switch",
    label: "通知を受け取る",
    value: bind("enabled", false),
  },
  {
    id: "search_box",
    component: "SearchBox",
    label: "キーワード",
    value: bind("query", ""),
    action: {
      event: { name: "search", context: { query: { "@path": "/query" } } },
    },
  },
  {
    id: "hamburger_menu_button",
    component: "HamburgerMenuButton",
    label: "メニュー",
    value: bind("menuOpen", false),
    children: child,
  },
  {
    id: "file_upload",
    component: "FileUpload",
    label: "添付資料",
    value: bind("files", "[]"),
    multiple: true,
  },
  {
    id: "accordion",
    component: "Accordion",
    ...expandable("よくある質問", "accordionOpen"),
  },
  {
    id: "disclosure",
    component: "Disclosure",
    ...expandable("詳細を見る", "disclosureOpen"),
  },
  {
    id: "dialog",
    component: "Dialog",
    ...expandable("確認ダイアログ", "dialogOpen"),
  },
  {
    id: "drawer",
    component: "Drawer",
    ...expandable("ナビゲーション", "drawerOpen"),
  },
  {
    id: "tabs",
    component: "Tabs",
    label: "申請の種類",
    value: bind("tab", "first"),
    tabs: [
      { label: "個人", value: "first", children: child },
      { label: "法人", value: "second", children: ["second_content"] },
    ],
  },
  {
    id: "breadcrumbs",
    component: "Breadcrumbs",
    label: "現在位置",
    items: [
      { label: "ホーム", href: "/" },
      { label: "申請", href: "/a2ui" },
    ],
  },
  {
    id: "horizontal_menu",
    component: "HorizontalMenu",
    ...menu("サービス", "horizontal"),
  },
  { id: "menu_list", component: "MenuList", ...menu("手続き一覧", "menu") },
  {
    id: "menu_list_box",
    component: "MenuListBox",
    ...menu("操作を選択", "menuBox"),
  },
  {
    id: "language_selector",
    component: "LanguageSelector",
    label: "言語",
    value: bind("language", "ja"),
    options: [
      { label: "日本語", value: "ja" },
      { label: "English", value: "en" },
    ],
  },
  {
    id: "page_navigation",
    component: "PageNavigation",
    label: "ページ",
    value: bind("page", 1),
    total: 3,
  },
  {
    id: "resource_list",
    component: "ResourceList",
    items: [
      { title: "転入手続き", description: "必要書類のご案内", href: "/a2ui" },
    ],
  },
  {
    id: "step_navigation",
    component: "StepNavigation",
    label: "申請手順",
    value: bind("step", 0),
    steps: [
      { title: "入力", description: "内容を入力" },
      { title: "確認", description: "内容を確認" },
    ],
  },
  {
    id: "carousel",
    component: "Carousel",
    label: "ご案内",
    value: bind("slide", 0),
    slides: [
      {
        label: "手続きの案内",
        src: "https://placehold.co/800x450/png",
        alt: "案内1",
      },
      {
        label: "相談の案内",
        src: "https://placehold.co/800x450/png",
        alt: "案内2",
      },
    ],
  },
]
export const allComponentsMessages = [
  {
    version: "1.0",
    createSurface: {
      surfaceId: "all-components",
      catalogId:
        "https://github.com/videoq-jp/shadcn-digital-agency-jp/catalogs/a2ui/v1",
    },
  },
  {
    version: "1.0",
    updateDataModel: {
      surfaceId: "all-components",
      path: "/",
      value: showcaseData,
    },
  },
  {
    version: "1.0",
    updateComponents: {
      surfaceId: "all-components",
      components: [
        {
          id: "root",
          component: "Column",
          children: showcaseComponents.map((c) => c.id),
        },
        ...showcaseComponents,
        {
          id: "example_content",
          component: "Text",
          text: "この内容はA2UIの子コンポーネントです。",
        },
        {
          id: "second_content",
          component: "Text",
          text: "法人向けの申請内容です。",
        },
      ],
    },
  },
]
