import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { axe } from "vitest-axe"
import A2uiDemo from "@/demo/A2uiDemo"
import { playgroundExamples } from "@/demo/playground-examples"
import { validateGeneratedMessages } from "../../scripts/a2ui/protocol"

const response = (value: unknown, ok = true) =>
  Promise.resolve({ ok, json: async () => value } as Response)
let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  localStorage.clear()
  fetchMock = vi.fn().mockImplementation((url: string) =>
    url.endsWith("/status")
      ? response({ enabled: true, authenticated: true })
      : response({
          messages: playgroundExamples[1].messages,
          attempts: 1,
          elapsedMs: 1200,
          provider: "Codex",
        })
  )
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

it("starts with an accessible prompt-first playground and validates every offline example", async () => {
  const { container } = render(<A2uiDemo />)
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Watch an agent write UI."
  )
  expect(screen.queryByLabelText("JSONエディター")).not.toBeInTheDocument()
  await screen.findByText("このPCのCodexログインで接続済み")
  expect(await axe(container)).toHaveNoViolations()
  for (const example of playgroundExamples)
    expect(validateGeneratedMessages(example.messages)).toHaveLength(3)
})

it("opens the offline editor, renders repository table components, and preserves the preview on invalid JSON", async () => {
  const { container } = render(<A2uiDemo />)
  fireEvent.click(screen.getByRole("button", { name: /AIを使わずに試す/ }))
  const preview = document.querySelector(".pg-document") as HTMLElement
  expect(within(preview).getByText("84,210")).toBeInTheDocument()
  expect(await axe(container)).toHaveNoViolations()
  expect(
    within(preview).getByRole("table", { name: "Top accounts" })
  ).toHaveAttribute("data-slot", "table")
  expect(within(preview).getByText("Visitors")).toHaveAttribute(
    "data-slot",
    "dt"
  )
  const editor = screen.getByLabelText("画面のJSON")
  fireEvent.change(editor, { target: { value: "{" } })
  fireEvent.click(screen.getByRole("button", { name: /変更を反映/ }))
  expect(screen.getByRole("alert")).toBeInTheDocument()
  expect(within(preview).getByText("84,210")).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "リセット" }))
  const edited = JSON.stringify(playgroundExamples[0].messages).replace(
    "Q3 revenue review",
    "変更したダッシュボード"
  )
  fireEvent.change(editor, { target: { value: edited } })
  fireEvent.click(screen.getByRole("button", { name: /変更を反映/ }))
  await screen.findByText("変更したダッシュボード")
  expect(
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/generate"))
  ).toHaveLength(0)
})

it("generates, sends follow-up requests with the current screen and input data, and restores versions", async () => {
  render(<A2uiDemo />)
  await screen.findByText("このPCのCodexログインで接続済み")
  const composer = screen.getByLabelText("つくりたい画面や、変更したいこと")
  fireEvent.change(composer, { target: { value: "イベントの申込画面" } })
  fireEvent.keyDown(composer, { key: "Enter", code: "Enter" })
  await screen.findByRole("heading", { name: "まちの清掃イベント 参加申込" })
  fireEvent.change(screen.getByLabelText("氏名（必須）"), {
    target: { value: "花子" },
  })
  fireEvent.change(screen.getByLabelText("つくりたい画面や、変更したいこと"), {
    target: { value: "メールアドレスの入力欄を追加して" },
  })
  fireEvent.click(screen.getByRole("button", { name: "画面を生成" }))
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/generate"))
    ).toHaveLength(2)
  )
  const call = fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith("/generate")
  )[1]
  expect(JSON.parse(call[1].body)).toMatchObject({
    prompt: "メールアドレスの入力欄を追加して",
    previousMessages: playgroundExamples[1].messages,
    dataModel: { name: "花子" },
  })
  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: /個のコンポーネント/ })
    ).toHaveLength(2)
  )
  fireEvent.click(
    screen.getAllByRole("button", { name: /個のコンポーネント/ })[0]
  )
  expect(
    screen.getAllByRole("button", { name: /個のコンポーネント/ })[0]
  ).toHaveClass("is-selected")
})

it("preserves edited fields across tabs and records events without using the LLM in sample mode", async () => {
  fetchMock.mockImplementation(() =>
    response({ enabled: false, authenticated: false })
  )
  render(<A2uiDemo />)
  await screen.findByText(/サンプルはすぐに試せます/)
  fireEvent.click(screen.getByRole("button", { name: /AIを使わずに試す/ }))
  fireEvent.change(screen.getByLabelText("編集する画面"), {
    target: { value: "1" },
  })
  await screen.findByRole("heading", { name: "まちの清掃イベント 参加申込" })
  fireEvent.click(screen.getByRole("button", { name: "Done" }))
  fireEvent.change(screen.getByLabelText("氏名（必須）"), {
    target: { value: "太郎" },
  })
  fireEvent.click(screen.getByRole("tab", { name: "JSON" }))
  fireEvent.click(screen.getByRole("button", { name: "Edit" }))
  expect(
    document
      .getElementById("pg-editor-preview")
      ?.contains(screen.getByLabelText("氏名（必須）"))
  ).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "Done" }))
  expect(
    document
      .getElementById("pg-chat-preview")
      ?.contains(screen.getByLabelText("氏名（必須）"))
  ).toBe(true)
  fireEvent.click(screen.getByRole("tab", { name: /^Run/ }))
  fireEvent.click(screen.getByRole("tab", { name: "JSON stream" }))
  expect(screen.getByLabelText("氏名（必須）")).toHaveValue("太郎")
  fireEvent.click(screen.getByRole("button", { name: "入力内容を確認" }))
  await screen.findByText(/入力内容を確認しました。これはサンプル/)
  fireEvent.click(screen.getByRole("tab", { name: /^Run/ }))
  expect(screen.getByText("confirm_event")).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledTimes(1)
  fireEvent.keyDown(screen.getByRole("tab", { name: /^Run/ }), {
    key: "Home",
  })
  expect(screen.getByRole("tab", { name: "JSON stream" })).toHaveFocus()
})

it("clears a pending run without allowing stale results to repopulate a new conversation", async () => {
  let finish: ((value: Response) => void) | undefined
  fetchMock.mockImplementation((url: string) =>
    url.endsWith("/status")
      ? response({ enabled: true, authenticated: true })
      : new Promise<Response>((resolve) => {
          finish = resolve
        })
  )
  render(<A2uiDemo />)
  await screen.findByText("このPCのCodexログインで接続済み")
  fireEvent.change(screen.getByLabelText("つくりたい画面や、変更したいこと"), {
    target: { value: "予約画面" },
  })
  fireEvent.click(screen.getByRole("button", { name: "画面を生成" }))
  expect(screen.getByRole("button", { name: "生成を中止" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "新しい会話" }))
  await act(async () => {
    finish?.({
      ok: true,
      json: async () => ({ messages: playgroundExamples[1].messages }),
    } as Response)
  })
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Watch an agent write UI."
  )
  expect(
    screen.queryByRole("heading", { name: "まちの清掃イベント 参加申込" })
  ).not.toBeInTheDocument()
})

it("updates the editor preview automatically, retains the last valid screen and resets to the selected starter", async () => {
  render(<A2uiDemo />)
  fireEvent.click(screen.getByRole("button", { name: /AIを使わずに試す/ }))
  const editor = screen.getByLabelText("画面のJSON")
  const changed = JSON.stringify(playgroundExamples[0].messages).replace(
    "Q3 revenue review",
    "自動更新した見出し"
  )
  fireEvent.change(editor, { target: { value: changed } })
  await screen.findByRole("heading", { name: "自動更新した見出し" })
  fireEvent.change(editor, { target: { value: "{" } })
  await screen.findByRole("alert")
  expect(
    screen.getByRole("heading", { name: "自動更新した見出し" })
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "リセット" }))
  await screen.findByRole("heading", { name: "Q3 revenue review" })
  fireEvent.change(screen.getByLabelText("編集する画面"), {
    target: { value: "1" },
  })
  await screen.findByRole("heading", { name: "まちの清掃イベント 参加申込" })
  fireEvent.change(screen.getByLabelText("氏名（必須）"), {
    target: { value: "保持する名前" },
  })
  fireEvent.change(editor, {
    target: { value: `${(editor as HTMLTextAreaElement).value}\n` },
  })
  await new Promise((resolve) => setTimeout(resolve, 250))
  expect(screen.getByLabelText("氏名（必須）")).toHaveValue("保持する名前")
})

it("queues a follow-up during a run and sends it with the completed screen", async () => {
  let finish: ((value: Response) => void) | undefined
  let calls = 0
  fetchMock.mockImplementation((url: string) =>
    url.endsWith("/status")
      ? response({ enabled: true, authenticated: true })
      : ++calls === 1
        ? new Promise<Response>((resolve) => {
            finish = resolve
          })
        : response({
            messages: playgroundExamples[1].messages,
            attempts: 1,
            elapsedMs: 100,
            provider: "Codex",
          })
  )
  render(<A2uiDemo />)
  await screen.findByText("このPCのCodexログインで接続済み")
  fireEvent.change(screen.getByLabelText("つくりたい画面や、変更したいこと"), {
    target: { value: "まず申込フォームを作って" },
  })
  fireEvent.click(screen.getByRole("button", { name: "画面を生成" }))
  const composer = screen.getByLabelText("つくりたい画面や、変更したいこと")
  expect(composer).not.toBeDisabled()
  fireEvent.change(composer, { target: { value: "次に連絡先を追加して" } })
  fireEvent.keyDown(composer, { key: "Enter" })
  expect(screen.getByText(/次の依頼：次に連絡先を追加して/)).toBeInTheDocument()
  expect(calls).toBe(1)
  await act(async () =>
    finish?.({
      ok: true,
      json: async () => ({
        messages: playgroundExamples[1].messages,
        attempts: 1,
        elapsedMs: 100,
        provider: "Codex",
      }),
    } as Response)
  )
  await waitFor(() => expect(calls).toBe(2))
  const generated = fetchMock.mock.calls.filter(([url]) =>
    String(url).endsWith("/generate")
  )
  expect(JSON.parse(generated[1][1].body)).toMatchObject({
    prompt: "次に連絡先を追加して",
    previousMessages: playgroundExamples[1].messages,
  })
  expect(
    screen.queryByRole("button", { name: "予約を取り消す" })
  ).not.toBeInTheDocument()
})

it("cancels the queued prompt back into the composer and clears it on a new conversation", async () => {
  fetchMock.mockImplementation((url: string) =>
    url.endsWith("/status")
      ? response({ enabled: true, authenticated: true })
      : new Promise(() => {})
  )
  render(<A2uiDemo />)
  await screen.findByText("このPCのCodexログインで接続済み")
  const type = (value: string) => {
    const el = screen.getByLabelText("つくりたい画面や、変更したいこと")
    fireEvent.change(el, { target: { value } })
    fireEvent.keyDown(el, { key: "Enter" })
  }
  type("最初の画面")
  type("後から送る依頼")
  fireEvent.click(screen.getByRole("button", { name: "予約を取り消す" }))
  expect(screen.getByLabelText("つくりたい画面や、変更したいこと")).toHaveValue(
    "後から送る依頼"
  )
  type("消す予定の依頼")
  fireEvent.click(screen.getByRole("button", { name: "新しい会話" }))
  expect(screen.queryByText(/次の依頼/)).not.toBeInTheDocument()
})

it("sends the latest editor text to Ask without waiting for the preview debounce", async () => {
  render(<A2uiDemo />)
  await screen.findByText("このPCのCodexログインで接続済み")
  fireEvent.click(screen.getByRole("button", { name: /AIを使わずに試す/ }))
  const value = JSON.stringify(playgroundExamples[0].messages).replace(
    "Q3 revenue review",
    "編集中のタイトル"
  )
  fireEvent.change(screen.getByLabelText("画面のJSON"), { target: { value } })
  fireEvent.change(screen.getByLabelText("この画面の変更をAIに依頼"), {
    target: { value: "グラフを追加して" },
  })
  fireEvent.click(screen.getByRole("button", { name: "依頼する" }))
  await waitFor(() =>
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/generate"))
    ).toBe(true)
  )
  const call = fetchMock.mock.calls.find(([url]) =>
    String(url).endsWith("/generate")
  )!
  expect(JSON.parse(call[1].body).previousMessages).toEqual(JSON.parse(value))
})

it("restores the saved conversation after remount and clears it on New chat", async () => {
  const first = render(<A2uiDemo />)
  fireEvent.click(screen.getByRole("button", { name: /AIを使わずに試す/ }))
  const edited = JSON.stringify(playgroundExamples[0].messages).replace(
    "Q3 revenue review",
    "再読み込み後も残る見出し"
  )
  fireEvent.change(screen.getByLabelText("画面のJSON"), {
    target: { value: edited },
  })
  await screen.findByRole("heading", { name: "再読み込み後も残る見出し" })
  first.unmount()
  render(<A2uiDemo />)
  expect(
    screen.getByRole("heading", { name: "再読み込み後も残る見出し" })
  ).toBeInTheDocument()
  expect(
    screen.getByRole("log", { name: "生成履歴" })
  ).not.toBeEmptyDOMElement()
  fireEvent.click(
    screen.getByRole("button", { name: "A2UI Playground ホーム" })
  )
  expect(localStorage.getItem("a2ui-playground-session-v1")).toBeNull()
})

it("updates native table rows and controls panel layout with a keyboard", async () => {
  render(<A2uiDemo />)
  fireEvent.click(screen.getByRole("button", { name: /AIを使わずに試す/ }))
  const messages = structuredClone(playgroundExamples[0].messages)
  const table = messages[2].updateComponents!.components.find(
    (node) => node.id === "table"
  )!
  table.rows = [
    ...(table.rows as string[][]),
    ["AP-0243", "転出届", "完了", "11月24日"],
  ]
  fireEvent.change(screen.getByLabelText("画面のJSON"), {
    target: { value: JSON.stringify(messages) },
  })
  await waitFor(() =>
    expect(screen.getByLabelText("画面のJSON")).toHaveValue(
      JSON.stringify(messages)
    )
  )
  await screen.findByText("AP-0243")
  expect(screen.getByText("Northwind Labs")).toBeInTheDocument()
  const splitter = screen.getByRole("separator", { name: "会話パネルの幅" })
  const previousWidth = Number(splitter.getAttribute("aria-valuenow"))
  fireEvent.keyDown(splitter, { key: "ArrowRight" })
  expect(splitter).toHaveAttribute("aria-valuenow", String(previousWidth + 20))
  fireEvent.click(screen.getByRole("button", { name: "結果パネルを閉じる" }))
  expect(
    screen.getByRole("button", { name: "結果パネルを開く" })
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "結果パネルを開く" }))
  expect(screen.getByLabelText("画面のJSON")).toBeVisible()
})

it("keeps the Digital Agency catalog selected in the reference-style Design menu", async () => {
  render(<A2uiDemo />)
  await screen.findByText("このPCのCodexログインで接続済み")
  const trigger = screen.getByLabelText(
    "Design: components, format, starters and more"
  )
  fireEvent.click(trigger)
  fireEvent.click(screen.getByRole("menuitem", { name: /Design system/ }))
  expect(
    screen.getByRole("menuitem", { name: /デジタル庁/ })
  ).toBeInTheDocument()
  fireEvent.keyDown(trigger, { key: "Escape" })
  expect(trigger.closest("details")).not.toHaveAttribute("open")
  fireEvent.click(trigger)
  fireEvent.pointerDown(document.body)
  expect(trigger.closest("details")).not.toHaveAttribute("open")
})

it("shows the public provider and never labels failed generation as validated", async () => {
  fetchMock.mockImplementation((url: string) =>
    url.endsWith("/status")
      ? response({ enabled: true, authenticated: true, runtime: "workers-ai" })
      : response({ error: "生成サービスのテストエラー" }, false)
  )
  render(<A2uiDemo />)
  await screen.findByText("Cloudflare Workers AIで接続済み")
  fireEvent.change(screen.getByLabelText("つくりたい画面や、変更したいこと"), {
    target: { value: "申込フォーム" },
  })
  fireEvent.click(screen.getByRole("button", { name: "画面を生成" }))
  await screen.findByText("生成サービスのテストエラー")
  expect(screen.getByText("生成に失敗しました")).toBeInTheDocument()
  expect(screen.queryByText("生成完了 · 検証済み")).not.toBeInTheDocument()
})
