import { Catalog, MessageProcessor } from "@a2ui/web_core"
import catalogDocument from "./catalog.json"

export const agentCatalog = Catalog.fromJson(catalogDocument)

/** A complete, bounded screen. RPCs and arbitrary tool execution are excluded. */
export function validateCompleteScreen(value: unknown): unknown[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) {
    throw new Error("A2UIメッセージを1〜10個の配列で指定してください。")
  }
  const processor = new MessageProcessor([agentCatalog], undefined, {
    version: "1.0",
    validationConfig: {
      targetVersion: "1.0",
      allowedMessages: ["createSurface", "updateDataModel", "updateComponents"],
    },
  })
  try {
    const errors = processor.processMessagesWithErrors(value)
    if (errors.length) throw new Error(JSON.stringify(errors))
    if (processor.model.surfacesMap.size !== 1)
      throw new Error("画面は1つだけ指定してください。")
    const surface = [...processor.model.surfacesMap.values()][0]
    const components = Array.from(surface.componentsModel.values, (model) => ({
      ...model.properties,
      id: model.id,
      component: model.type,
    }))
    if (!components.length || components.length > 80)
      throw new Error("部品は1〜80個にしてください。")
    if (!surface.componentsModel.has("root"))
      throw new Error("rootコンポーネントが必要です。")
    if (JSON.stringify(value).length > 80_000)
      throw new Error("生成した画面が大きすぎます。")
    const data = surface.dataModel
    const resolve = (raw: unknown): unknown => {
      if (raw && typeof raw === "object") {
        if (
          !("@path" in raw) ||
          typeof raw["@path"] !== "string" ||
          Object.keys(raw).length !== 1
        ) {
          throw new Error("動的な値には@pathのみを使用してください。")
        }
        return data.get(raw["@path"])
      }
      return raw
    }
    for (const item of components) {
      const component = item as Record<string, unknown>
      if (component.id === "root" && component.component !== "Column")
        throw new Error("rootはColumnにしてください。")
      for (const key of ["text", "label", "title"]) {
        if (key in component && typeof resolve(component[key]) !== "string")
          throw new Error(`${key}には文字列が必要です。`)
      }
      const stringFields = [
        "Input",
        "Textarea",
        "Select",
        "Calendar",
        "DatePicker",
        "SeparatedDatePicker",
        "RadioGroup",
        "SearchBox",
        "FileUpload",
        "Tabs",
        "HorizontalMenu",
        "MenuList",
        "MenuListBox",
        "LanguageSelector",
      ]
      const booleanFields = [
        "Checkbox",
        "Switch",
        "Accordion",
        "Disclosure",
        "Dialog",
        "Drawer",
        "HamburgerMenuButton",
      ]
      const numberFields = ["PageNavigation", "StepNavigation", "Carousel"]
      const kind = String(component.component)
      const expected = stringFields.includes(kind)
        ? "string"
        : booleanFields.includes(kind)
          ? "boolean"
          : numberFields.includes(kind)
            ? "number"
            : undefined
      if (
        expected &&
        (!component.value ||
          typeof component.value !== "object" ||
          typeof resolve(component.value) !== expected)
      ) {
        throw new Error(
          `入力のvalueは初期値のある@path（${expected}）にしてください。`
        )
      }
      if (
        "visible" in component &&
        (typeof component.visible !== "object" ||
          typeof resolve(component.visible) !== "boolean")
      ) {
        throw new Error("visibleは初期値のある@path（boolean）にしてください。")
      }
      if (
        "disabled" in component &&
        typeof resolve(component.disabled) !== "boolean"
      )
        throw new Error("disabledには真偽値が必要です。")
      if ("action" in component) {
        const action = component.action as {
          event?: { name: string; context?: Record<string, unknown> }
        }
        if (!action?.event)
          throw new Error("ボタンはeventアクションにしてください。")
      }
    }
    return value
  } finally {
    processor.dispose()
  }
}
