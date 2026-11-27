import generatedAllComponents from "../fixtures/a2ui/all-components-generated.json"
import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react"
import { createDigitalAgencySession } from "@/lib/a2ui/session"
import { DigitalAgencySurface } from "@/components/a2ui/digital-agency-surface"
import { allComponentsMessages } from "@/lib/a2ui/showcase"
import { validateCompleteScreen } from "@/lib/a2ui/validation"
import { digitalAgencyCatalog } from "@/lib/a2ui/catalog"
import { readFileSync } from "node:fs"

const sessions: ReturnType<typeof createDigitalAgencySession>[] = []
afterEach(() => act(() => sessions.splice(0).forEach((p) => p.dispose())))
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "")
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open")
    this.dispatchEvent(new Event("close"))
  }
})
function setup() {
  const action = vi.fn()
  const p = createDigitalAgencySession(action)
  sessions.push(p)
  expect(p.processMessagesWithErrors(allComponentsMessages)).toEqual([])
  const view = render(<DigitalAgencySurface processor={p} />)
  return {
    p,
    action,
    ...view,
    data: p.model.getSurface("all-components")!.dataModel,
  }
}
describe("all 47 native components through A2UI", () => {
  it("validates a complete protocol screen with every registry UI component and renders native slots", () => {
    expect(() => validateCompleteScreen(allComponentsMessages)).not.toThrow()
    const { container } = setup()
    const manifest = JSON.parse(readFileSync("registry.json", "utf8"))
    const slots: Record<string, string> = {
      "description-list": "dl",
      select: "select-trigger",
      switch: "switch-on-off",
      tabs: "tab",
      dialog: "dialog",
      calendar: "calendar",
    }
    for (const item of manifest.items.filter(
      (i: { type: string }) => i.type === "registry:ui"
    )) {
      expect(
        digitalAgencyCatalog.components.has(
          item.name
            .split("-")
            .map((s: string) => s[0].toUpperCase() + s.slice(1))
            .join("")
        ),
        item.name
      ).toBe(true)
      expect(
        container.querySelector(
          `[data-slot="${slots[item.name] ?? item.name}"]`
        ),
        item.name
      ).not.toBeNull()
    }
  })
  it("validates and renders all 47 types in an actual Workers AI response", () => {
    expect(() => validateCompleteScreen(generatedAllComponents)).not.toThrow()
    const p = createDigitalAgencySession()
    sessions.push(p)
    expect(p.processMessagesWithErrors(generatedAllComponents)).toEqual([])
    const { container } = render(<DigitalAgencySurface processor={p} />)
    const surface = [...p.model.surfacesMap.values()][0]
    const actual = new Set(
      [...surface.componentsModel.values].map((c) => c.type)
    )
    expect([...actual].sort()).toEqual(
      [...digitalAgencyCatalog.components.keys()].sort()
    )
    expect(container.querySelector('[data-slot="calendar"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="carousel"]')).not.toBeNull()
    expect(container.querySelector('[data-slot="drawer"]')).not.toBeNull()
  })
  it("binds radio, switch, pagination, menus and tabs to the model", async () => {
    const { data, container } = setup()
    fireEvent.click(
      within(screen.getByRole("group", { name: "相談方法" })).getByRole(
        "radio",
        { name: "窓口" }
      )
    )
    fireEvent.click(screen.getByRole("switch", { name: "通知を受け取る" }))
    fireEvent.click(
      within(
        container.querySelector('[data-slot="page-navigation"]')!
      ).getByRole("button", { name: "次へ" })
    )
    fireEvent.click(screen.getByRole("tab", { name: "法人" }))
    expect(screen.getByRole("tabpanel", { name: "法人" })).toHaveTextContent(
      "法人向け"
    )
    fireEvent.keyDown(screen.getByRole("tab", { name: "法人" }), {
      key: "ArrowLeft",
    })
    expect(screen.getByRole("tab", { name: "個人" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    fireEvent.click(screen.getByRole("button", { name: "操作を選択" }))
    fireEvent.click(screen.getByRole("menuitem", { name: "窓口" }))
    expect(data.get("/menuBox")).toBe("counter")
    expect(data.get("/choice")).toBe("counter")
    expect(data.get("/enabled")).toBe(true)
    expect(data.get("/page")).toBe(2)
    const summary = container.querySelector('[data-slot="accordion-summary"]')!
    fireEvent.click(summary)
    expect(container.querySelector('[data-slot="accordion"]')).toHaveAttribute(
      "open"
    )
    await waitFor(() => expect(data.get("/accordionOpen")).toBe(true))
  })
  it("selects dates with real calendars and keeps date fields and action context in sync", async () => {
    const { container, data, action } = setup()
    const calendar = container.querySelector<HTMLElement>(
      '[data-slot="calendar"]'
    )!
    const cells = within(calendar).getAllByRole("button")
    const day = cells.find((c) =>
      c.getAttribute("aria-label")?.includes("16日")
    )
    expect(day).toBeDefined()
    fireEvent.click(day!)
    expect(data.get("/date")).toBe("2026-12-16")
    fireEvent.change(screen.getByLabelText("開始日 年"), {
      target: { value: "2027" },
    })
    fireEvent.change(screen.getByLabelText("開始日 月"), {
      target: { value: "01" },
    })
    fireEvent.change(screen.getByLabelText("開始日 日"), {
      target: { value: "05" },
    })
    expect(data.get("/start")).toBe("2027-01-05")
    fireEvent.click(
      screen.getByRole("button", { name: "開始日のカレンダーを開く" })
    )
    expect(container.querySelectorAll('[data-slot="calendar"]')).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "入力内容を確認" }))
    await waitFor(() => expect(action).toHaveBeenCalled())
    expect(action.mock.calls[0][0].context.date).toBe("2026-12-16")
  })
  it("opens and closes real modal/dialog drawers and preserves their contents", () => {
    const { data } = setup()
    fireEvent.click(screen.getByRole("button", { name: "確認ダイアログ" }))
    expect(screen.getByRole("dialog", { name: "確認ダイアログ" })).toBeVisible()
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "確認ダイアログ" })).getByRole(
        "button",
        { name: "閉じる" }
      )
    )
    expect(data.get("/dialogOpen")).toBe(false)
    fireEvent.click(screen.getByRole("button", { name: "ナビゲーション" }))
    expect(screen.getByRole("dialog", { name: "ナビゲーション" })).toBeVisible()
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "ナビゲーション" })).getByRole(
        "button",
        { name: "閉じる" }
      )
    )
    expect(data.get("/drawerOpen")).toBe(false)
  })
  it("holds file metadata without uploading contents and allows removing a file", () => {
    const { data, container } = setup()
    fireEvent.change(container.querySelector('input[type="file"]')!, {
      target: {
        files: [new File(["private"], "sample.txt", { type: "text/plain" })],
      },
    })
    expect(JSON.parse(data.get("/files") as string)).toEqual([
      { name: "sample.txt", size: 7, type: "text/plain" },
    ])
    expect(screen.getByText("sample.txt")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "sample.txtを削除" }))
    expect(data.get("/files")).toBe("[]")
  })
  it("updates language, steps, carousel, horizontal navigation, disclosure and banner visibility", async () => {
    const { container, data, action } = setup()
    fireEvent.click(
      within(
        container.querySelector<HTMLElement>('[data-slot="horizontal-menu"]')!
      ).getByRole("button", { name: "窓口" })
    )
    fireEvent.click(
      within(
        container.querySelector<HTMLElement>("a2ui-react-menulist")!
      ).getByRole("button", { name: "窓口" })
    )
    fireEvent.click(screen.getByRole("button", { name: /言語:/ }))
    fireEvent.click(screen.getByRole("link", { name: "English" }))
    fireEvent.click(
      within(
        container.querySelector<HTMLElement>('[data-slot="step-navigation"]')!
      ).getByRole("button", { name: /確認/ })
    )
    fireEvent.click(
      within(
        container.querySelector<HTMLElement>('[data-slot="carousel"]')!
      ).getAllByRole("button", { name: "次のスライド" })[0]
    )
    fireEvent.click(screen.getByRole("button", { name: "メニュー" }))
    const disclosure = container.querySelector<HTMLElement>(
      'a2ui-react-disclosure [data-slot="disclosure"]'
    )!
    fireEvent.click(disclosure.querySelector("summary")!)
    fireEvent.click(
      container.querySelector('[data-slot="notification-banner-close"]')!
    )
    fireEvent.change(screen.getByRole("searchbox", { name: "キーワード" }), {
      target: { value: "相談" },
    })
    fireEvent.keyDown(screen.getByRole("searchbox", { name: "キーワード" }), {
      key: "Enter",
    })
    await waitFor(() => expect(action).toHaveBeenCalled())
    expect(action.mock.calls[0][0]).toMatchObject({
      name: "search",
      context: { query: "相談" },
    })
    expect(data.get("/horizontal")).toBe("counter")
    expect(data.get("/menu")).toBe("counter")
    expect(data.get("/language")).toBe("en")
    expect(data.get("/step")).toBe(1)
    expect(data.get("/slide")).toBe(1)
    expect(data.get("/menuOpen")).toBe(true)
    expect(data.get("/notice")).toBe(false)
    await waitFor(() => expect(data.get("/disclosureOpen")).toBe(true))
  })
  it.each(["date", "choice", "enabled", "page", "notice"])(
    "rejects missing bound initial state for %s",
    (key) => {
      const messages = structuredClone(allComponentsMessages)
      const initial = messages.find((m) => m.updateDataModel)!.updateDataModel!
        .value
      delete initial[key]
      expect(() => validateCompleteScreen(messages)).toThrow()
    }
  )
  it("blocks executable model URLs while allowing ordinary navigation", () => {
    const p = createDigitalAgencySession()
    sessions.push(p)
    p.processMessagesWithErrors(allComponentsMessages)
    act(() =>
      p.processMessages({
        version: "1.0",
        updateComponents: {
          surfaceId: "all-components",
          components: [
            {
              id: "link",
              component: "Link",
              text: "不正なリンク",
              href: "javascript:alert(1)",
            },
          ],
        },
      })
    )
    render(<DigitalAgencySurface processor={p} />)
    expect(screen.getByText("不正なリンク")).not.toHaveAttribute("href")
  })
})
