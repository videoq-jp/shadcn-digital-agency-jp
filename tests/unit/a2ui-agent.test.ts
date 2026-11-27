// @vitest-environment node
import { createServer, type Server } from "node:http"
import { once } from "node:events"
import { readFileSync } from "node:fs"
import type { AddressInfo } from "node:net"
import { createCodexMiddleware } from "../../scripts/a2ui/plugin"
import {
  generateScreen,
  requestSchema,
  validateGeneratedMessages,
} from "../../scripts/a2ui/protocol"

// A real catalog payload, independent of React/browser globals.
const sample = [
  {
    version: "1.0",
    createSurface: {
      surfaceId: "generated",
      catalogId: JSON.parse(readFileSync("src/lib/a2ui/catalog.json", "utf8"))
        .catalogId,
    },
  },
  {
    version: "1.0",
    updateDataModel: {
      surfaceId: "generated",
      path: "/",
      value: { name: "", agree: false },
    },
  },
  {
    version: "1.0",
    updateComponents: {
      surfaceId: "generated",
      components: [
        {
          id: "root",
          component: "Column",
          children: ["name", "agree", "submit"],
        },
        {
          id: "name",
          component: "Input",
          label: "氏名",
          value: { "@path": "/name" },
        },
        {
          id: "agree",
          component: "Checkbox",
          label: "同意",
          value: { "@path": "/agree" },
        },
        {
          id: "submit",
          component: "Button",
          label: "確認",
          action: {
            event: { name: "confirm", context: { name: { "@path": "/name" } } },
          },
        },
      ],
    },
  },
]
it.each(["Grid", "Card", "StatGroup", "BarChart", "AreaChart", "DataTable"])(
  "rejects the removed synthetic component %s before rendering",
  (component) => {
    const messages = structuredClone(sample)
    messages[2].updateComponents!.components[1].component = component
    expect(() => validateGeneratedMessages(messages)).toThrow()
  }
)

const output = JSON.stringify({ messagesJson: JSON.stringify(sample) })
const servers: Server[] = []
const disposers: (() => void)[] = []
afterEach(async () => {
  disposers.splice(0).forEach((dispose) => dispose())
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections()
          server.close(() => resolve())
        })
    )
  )
})

async function serve(options: Parameters<typeof createCodexMiddleware>[0]) {
  const middleware = createCodexMiddleware(options)
  disposers.push(middleware.dispose)
  const server = createServer((req, res) => {
    void middleware.handle(req, res, () => {
      res.writeHead(404)
      res.end()
    })
  })
  servers.push(server)
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}
const body = JSON.stringify({ prompt: "申込フォーム" })
const headers = { "Content-Type": "application/json" }

describe("Codex A2UI generation", () => {
  it("validates complete screens and rejects missing bound values, invalid components, RPCs, and orphans", () => {
    expect(validateGeneratedMessages(sample)).toEqual(sample)
    const mutate = (change: (value: typeof sample) => void) => {
      const value = structuredClone(sample)
      change(value)
      return value
    }
    expect(() =>
      validateGeneratedMessages(
        mutate((v) => {
          v[1].updateDataModel!.value.name = 5 as unknown as string
        })
      )
    ).toThrow()
    expect(() =>
      validateGeneratedMessages(
        mutate((v) => {
          v[2].updateComponents!.components[0].component = "Script"
        })
      )
    ).toThrow()
    expect(() =>
      validateGeneratedMessages([
        ...sample,
        { version: "1.0", callRendererFunction: {} },
      ])
    ).toThrow()
    expect(() =>
      validateGeneratedMessages(
        mutate((v) => {
          v[2].updateComponents!.components[0].children = ["name"]
        })
      )
    ).toThrow()
    expect(
      requestSchema.safeParse({
        prompt: " ",
        action: { name: "x", surfaceId: "x", context: {} },
      }).success
    ).toBe(false)
  })

  it("retries invalid model output once and preserves the action context in the prompt", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce('{"messagesJson":"[]"}')
      .mockResolvedValueOnce(output)
    const request = requestSchema.parse({
      prompt: "申込フォーム",
      previousMessages: sample,
      action: {
        name: "confirm",
        surfaceId: "generated",
        context: { name: "花子" },
      },
      dataModel: { name: "花子", agree: true },
    })
    const result = await generateScreen(
      request,
      run,
      new AbortController().signal
    )
    expect(result).toEqual({ messages: sample, attempts: 2 })
    expect(run.mock.calls[0][0]).toContain("花子")
    expect(run.mock.calls[1][0]).toContain("failed validation")
    const invalid = vi.fn().mockResolvedValue('{"messagesJson":"[]"}')
    await expect(
      generateScreen(
        { prompt: "フォーム" },
        invalid,
        new AbortController().signal
      )
    ).rejects.toThrow("カタログに適合")
    expect(invalid).toHaveBeenCalledTimes(2)
  })

  it("serves validated real-format results and checks local origin, input, and opt-in", async () => {
    const run = vi.fn().mockResolvedValue(output)
    const url = await serve({
      enabled: true,
      run,
      loginStatus: async () => true,
    })
    const result = await fetch(`${url}/api/a2ui/generate`, {
      method: "POST",
      headers,
      body,
    })
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ messages: sample, attempts: 1 })
    expect(
      (
        await fetch(`${url}/api/a2ui/generate`, {
          method: "POST",
          headers: { ...headers, Origin: "https://example.com" },
          body,
        })
      ).status
    ).toBe(403)
    expect(
      (
        await fetch(`${url}/api/a2ui/generate`, {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status
    ).toBe(400)
    expect(
      (await fetch(`${url}/api/a2ui/generate`, { method: "POST", body })).status
    ).toBe(415)
    expect(run).toHaveBeenCalledTimes(1)
    const disabled = await serve({ enabled: false, run })
    expect(
      (
        await fetch(`${disabled}/api/a2ui/generate`, {
          method: "POST",
          headers,
          body,
        })
      ).status
    ).toBe(503)
    expect(
      await (await fetch(`${disabled}/api/a2ui/status`)).json()
    ).toMatchObject({ enabled: false, authenticated: false })
  })

  it("prevents overlapping calls and releases the slot on timeout", async () => {
    const run = vi.fn(
      (_prompt: string, signal: AbortSignal) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          })
        })
    )
    const url = await serve({
      enabled: true,
      run,
      loginStatus: async () => true,
      timeoutMs: 200,
    })
    const pending = fetch(`${url}/api/a2ui/generate`, {
      method: "POST",
      headers,
      body,
    })
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1))
    expect(
      (
        await fetch(`${url}/api/a2ui/generate`, {
          method: "POST",
          headers,
          body,
        })
      ).status
    ).toBe(429)
    expect((await pending).status).toBe(504)
    expect(
      (
        await fetch(`${url}/api/a2ui/generate`, {
          method: "POST",
          headers,
          body,
        })
      ).status
    ).toBe(504)
    expect(run).toHaveBeenCalledTimes(2)
  })

  it("aborts inference when the browser cancels the request", async () => {
    let inferenceSignal: AbortSignal | undefined
    const run = vi.fn(
      (_prompt: string, signal: AbortSignal) =>
        new Promise<string>((_resolve, reject) => {
          inferenceSignal = signal
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          })
        })
    )
    const url = await serve({
      enabled: true,
      run,
      loginStatus: async () => true,
    })
    const controller = new AbortController()
    const pending = fetch(`${url}/api/a2ui/generate`, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    }).catch(() => undefined)
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce())
    controller.abort()
    await pending
    await vi.waitFor(() => expect(inferenceSignal?.aborted).toBe(true))
  })
})

it("delivers real deltas before the validated result on the NDJSON transport", async () => {
  let complete: ((value: string) => void) | undefined
  const base = await serve({
    enabled: true,
    loginStatus: async () => true,
    run: async (_prompt, _signal, onDelta) => {
      onDelta?.('{"messagesJson":"[')
      return await new Promise<string>((resolve) => {
        complete = resolve
      })
    },
  })
  const request = await fetch(`${base}/api/a2ui/generate`, {
    method: "POST",
    headers: { ...headers, Accept: "application/x-ndjson" },
    body,
  })
  expect(request.headers.get("content-type")).toContain("application/x-ndjson")
  const reader = request.body!.getReader()
  const first = new TextDecoder().decode((await reader.read()).value)
  expect(first).toContain('"type":"delta"')
  expect(first).not.toContain('"type":"result"')
  complete!(output)
  let rest = ""
  while (true) {
    const next = await reader.read()
    if (next.done) break
    rest += new TextDecoder().decode(next.value)
  }
  expect(rest).toContain('"type":"result"')
  expect(JSON.parse(rest.trim()).messages).toEqual(sample)
})
