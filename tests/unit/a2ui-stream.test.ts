import {
  messagesPrefix,
  partialScreen,
  readGenerationStream,
} from "@/demo/generation-stream"
import { playgroundExamples } from "@/demo/playground-examples"

it("decodes every possible split of escaped JSON without inventing missing values", () => {
  const value = JSON.stringify([{ text: '日本語\n改行と引用"' }])
  const envelope = JSON.stringify({ messagesJson: value })
  for (let i = 0; i <= envelope.length; i++)
    expect(value.startsWith(messagesPrefix(envelope.slice(0, i)))).toBe(true)
  expect(messagesPrefix(envelope)).toBe(value)
  expect(messagesPrefix('{"messagesJson":"\\u65')).toBe("")
  expect(messagesPrefix('{"messagesJson":"\\u65e5')).toBe("日")
})

it("passes raw Workers AI array prefixes through without double escaping", () => {
  const raw = JSON.stringify([{ text: '日本語と引用"と改行\n' }])
  for (let i = 0; i <= raw.length; i++)
    expect(messagesPrefix(" \n" + raw.slice(0, i))).toBe(raw.slice(0, i))
})

it("streams only complete components and keeps child references within the received graph", () => {
  const full = JSON.stringify(playgroundExamples[1].messages)
  let screens = 0
  for (let i = 1; i <= full.length; i++) {
    const partial = partialScreen(full.slice(0, i))
    if (!partial) continue
    const messages = JSON.parse(partial)
    const components = messages[2].updateComponents.components
    const ids = new Set(components.map((node: { id: string }) => node.id))
    expect(ids.has("root")).toBe(true)
    for (const component of components)
      for (const child of component.children || [])
        expect(ids.has(child)).toBe(true)
    screens++
  }
  expect(screens).toBeGreaterThan(5)
  expect(JSON.parse(partialScreen(full)!)).toEqual(
    playgroundExamples[1].messages
  )
  expect(partialScreen('[{"version":"1.0"')).toBeNull()
})

it("reads fragmented UTF-8 and reports interrupted/error streams", async () => {
  const data = new TextEncoder().encode(
    '{"type":"attempt","attempt":1}\n{"type":"delta","delta":"日本語"}\n{"type":"result","messages":[]}\n'
  )
  const response = () =>
    new Response(
      new ReadableStream({
        start(controller) {
          for (const byte of data) controller.enqueue(Uint8Array.of(byte))
          controller.close()
        },
      })
    )
  const events = vi.fn()
  expect(await readGenerationStream(response(), events)).toMatchObject({
    messages: [],
  })
  expect(events).toHaveBeenCalledWith({ type: "delta", delta: "日本語" })
  await expect(
    readGenerationStream(
      new Response('{"type":"delta","delta":"x"}\n'),
      vi.fn()
    )
  ).rejects.toThrow("接続が閉じました")
  await expect(
    readGenerationStream(
      new Response('{"type":"error","error":"上限に達しました"}\n'),
      vi.fn()
    )
  ).rejects.toThrow("上限に達しました")
})
