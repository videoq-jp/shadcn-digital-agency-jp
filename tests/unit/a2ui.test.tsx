import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { A2uiSurface } from "@a2ui/react"
import { Catalog } from "@a2ui/web_core"
import { axe } from "vitest-axe"
import { readFileSync } from "node:fs"

import { DigitalAgencySurface } from "@/components/a2ui/digital-agency-surface"
import { digitalAgencyCatalog } from "@/lib/a2ui/catalog"
import { applicationMessages } from "@/lib/a2ui/sample"
import { createDigitalAgencySession } from "@/lib/a2ui/session"

const sessions: ReturnType<typeof createDigitalAgencySession>[] = []
afterEach(() => {
  sessions.splice(0).forEach((session) => session.dispose())
})

function setup(onAction = vi.fn()) {
  const processor = createDigitalAgencySession(onAction)
  sessions.push(processor)
  expect(processor.processMessagesWithErrors(applicationMessages)).toEqual([])
  return { processor, onAction }
}

describe("Digital Agency A2UI integration", () => {
  it("renders existing components, binds local edits, and resolves current values into actions", async () => {
    const { processor, onAction } = setup()
    const surface = processor.model.getSurface("application")!
    const { container } = render(<A2uiSurface surface={surface} />)
    expect(container.querySelector('[data-slot="input"]')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="button"]')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("氏名（必須）"), {
      target: { value: "山田 花子" },
    })
    fireEvent.change(screen.getByLabelText("相談内容"), {
      target: { value: "転入の相談" },
    })
    fireEvent.click(screen.getByRole("checkbox"))
    expect(onAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "入力内容を確認" }))
    await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1))
    expect(onAction.mock.calls[0][0]).toMatchObject({
      name: "confirm_application",
      surfaceId: "application",
      sourceComponentId: "submit",
      context: { name: "山田 花子", details: "転入の相談", agree: true },
    })
  })

  it("applies incremental updates without losing input focus or unrelated data", () => {
    const { processor } = setup()
    render(<DigitalAgencySurface processor={processor} />)
    const input = screen.getByLabelText("氏名（必須）")
    fireEvent.change(input, { target: { value: "入力中" } })
    input.focus()
    act(() =>
      processor.processMessages({
        version: "1.0",
        updateDataModel: {
          surfaceId: "application",
          path: "/status",
          value: "確認中です",
        },
      })
    )
    expect(screen.getByText("確認中です")).toBeInTheDocument()
    expect(input).toHaveValue("入力中")
    expect(input).toHaveFocus()
    act(() =>
      processor.processMessages({
        version: "1.0",
        deleteSurface: { surfaceId: "application" },
      })
    )
    expect(screen.queryByLabelText("氏名（必須）")).not.toBeInTheDocument()
    act(() => processor.processMessages(applicationMessages))
    expect(screen.getByLabelText("氏名（必須）")).toBeInTheDocument()
  })

  it("rejects unknown catalogs, unknown components, and invalid button variants", () => {
    const { processor } = setup()
    for (const component of [
      { id: "root", component: "Script", code: "alert(1)" },
      {
        id: "submit",
        component: "Button",
        label: "送信",
        variant: "arbitrary",
        action: { event: { name: "submit" } },
      },
    ]) {
      expect(
        processor.processMessagesWithErrors({
          version: "1.0",
          updateComponents: {
            surfaceId: "application",
            components: [component],
          },
        }).length
      ).toBeGreaterThan(0)
    }
    expect(
      processor.processMessagesWithErrors({
        version: "1.0",
        createSurface: {
          surfaceId: "unknown",
          catalogId: "https://example.com/unknown",
        },
      }).length
    ).toBeGreaterThan(0)
  })

  it("renders text as text and provides accessible controls", async () => {
    const { processor } = setup()
    act(() =>
      processor.processMessages({
        version: "1.0",
        updateDataModel: {
          surfaceId: "application",
          path: "/status",
          value: '<script>alert("xss")</script>',
        },
      })
    )
    const { container } = render(<DigitalAgencySurface processor={processor} />)
    expect(
      screen.getByText('<script>alert("xss")</script>')
    ).toBeInTheDocument()
    expect(container.querySelector("script")).toBeNull()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("ships the exact agent schema generated from the renderer catalog", () => {
    const document = JSON.parse(
      readFileSync("src/lib/a2ui/catalog.json", "utf8")
    )
    expect(document).toEqual(digitalAgencyCatalog.toJson())
    const agentCatalog = Catalog.fromJson(document)
    expect(agentCatalog.id).toBe(digitalAgencyCatalog.id)
    expect([...agentCatalog.components.keys()]).toEqual([
      ...digitalAgencyCatalog.components.keys(),
    ])
  })
  it("exposes only existing repository UI components plus the two protocol primitives", () => {
    const manifest = JSON.parse(readFileSync("registry.json", "utf8"))
    const nativeSources: Record<string, string> = Object.fromEntries(
      manifest.items
        .filter((item: { type: string }) => item.type === "registry:ui")
        .map((item: { name: string }) => [
          item.name
            .split("-")
            .map((part) => part[0].toUpperCase() + part.slice(1))
            .join(""),
          item.name,
        ])
    )
    expect([...digitalAgencyCatalog.components.keys()].sort()).toEqual(
      ["Column", "Text", ...Object.keys(nativeSources)].sort()
    )
    const adapterSources =
      readFileSync("src/lib/a2ui/catalog.tsx", "utf8") +
      readFileSync("src/lib/a2ui/data-components.tsx", "utf8") +
      [
        "content-components",
        "date-components",
        "form-components",
        "container-components",
        "navigation-components",
      ]
        .map((name) => readFileSync(`src/lib/a2ui/${name}.tsx`, "utf8"))
        .join("\n")
    const registry = JSON.parse(
      readFileSync("src/registry/items/a2ui.json", "utf8")
    )
    for (const source of Object.values(nativeSources)) {
      expect(readFileSync(`src/components/ui/${source}.tsx`, "utf8")).toContain(
        "export"
      )
      expect(adapterSources).toContain(`@/components/ui/${source}`)
      expect(registry.registryDependencies).toContain(
        `videoq-jp/shadcn-digital-agency-jp/${source}`
      )
    }
  })
})
