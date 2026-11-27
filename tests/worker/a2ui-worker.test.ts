// @vitest-environment node
import worker from "../../worker/index"
import {
  readModelStream,
  MAX_OUTPUT_TOKENS,
  GENERATION_TIMEOUT_MS,
} from "../../worker/workers-ai"
import catalog from "../../src/lib/a2ui/catalog.json"

const messages = [
  {
    version: "1.0",
    createSurface: { surfaceId: "generated", catalogId: catalog.catalogId },
  },
  {
    version: "1.0",
    updateDataModel: { surfaceId: "generated", path: "/", value: {} },
  },
  {
    version: "1.0",
    updateComponents: {
      surfaceId: "generated",
      components: [
        { id: "root", component: "Column", children: ["heading"] },
        { id: "heading", component: "Heading", text: "公開版のテスト" },
      ],
    },
  },
]
const answer = JSON.stringify(messages)
function modelStream(content: string, finishReason: string | null = "stop") {
  const text =
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: "private reasoning" } }] })}\n\n` +
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n` +
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: finishReason }] })}\n\ndata: [DONE]\n\n`
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
      controller.close()
    },
  })
}
function setup() {
  const run = vi.fn().mockImplementation(async () => modelStream(answer))
  const limit = vi.fn().mockResolvedValue({ success: true })
  const assets = vi.fn().mockResolvedValue(new Response("static assets"))
  const env = {
    AI: { run: run as Env["AI"]["run"] },
    AI_RATE_LIMITER: { limit },
    ASSETS: { fetch: assets as Env["ASSETS"]["fetch"] },
  }
  const fetch = (request: Request) => worker.fetch(request, env)
  return { run, limit, assets, fetch }
}
const request = (body: unknown = { prompt: "申込画面" }, headers = {}) =>
  new Request("https://example.workers.dev/api/a2ui/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "192.0.2.1",
      ...headers,
    },
    body: JSON.stringify(body),
  })

it("serves assets and reports the actual public AI provider", async () => {
  const app = setup()
  expect(
    await (await app.fetch(new Request("https://example.workers.dev/"))).text()
  ).toBe("static assets")
  expect(
    await (
      await app.fetch(
        new Request("https://example.workers.dev/api/a2ui/status")
      )
    ).json()
  ).toMatchObject({
    runtime: "workers-ai",
    enabled: true,
    model: "@cf/openai/gpt-oss-120b",
  })
  expect(app.run).not.toHaveBeenCalled()
})
it("rejects cross-origin and oversized requests before invoking AI", async () => {
  const app = setup()
  expect(
    (await app.fetch(request(undefined, { Origin: "https://other.example" })))
      .status
  ).toBe(403)
  expect(
    (await app.fetch(request({ prompt: "x".repeat(100_001) }))).status
  ).toBe(400)
  expect(app.run).not.toHaveBeenCalled()
})
it("enforces the public rate limit before invoking AI", async () => {
  const app = setup()
  app.limit.mockResolvedValue({ success: false })
  const response = await app.fetch(request())
  expect(response.status).toBe(429)
  expect(response.headers.get("Retry-After")).toBe("60")
  expect(app.limit).toHaveBeenCalledWith({ key: "192.0.2.1" })
  expect(app.run).not.toHaveBeenCalled()
})
it("validates an actual model stream, forwards answer deltas and withholds reasoning", async () => {
  const app = setup()
  const response = await app.fetch(
    request(undefined, { Accept: "application/x-ndjson" })
  )
  const body = await response.text()
  const events = body
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line))
  expect(events[0]).toMatchObject({ type: "attempt", attempt: 1 })
  expect(events.find((event) => event.type === "delta").delta).toBe(answer)
  expect(events.at(-1)).toMatchObject({ type: "result", messages, attempts: 1 })
  expect(body).not.toContain("private reasoning")
  expect(app.run.mock.calls[0][1]).toMatchObject({
    stream: true,
    max_tokens: MAX_OUTPUT_TOKENS,
  })
})
it("repairs invalid catalog output once and never returns it as a completed screen", async () => {
  const app = setup()
  app.run.mockImplementationOnce(async () =>
    modelStream('{"messagesJson":"[]"}')
  )
  const response = await app.fetch(request())
  expect(await response.json()).toMatchObject({ messages, attempts: 2 })
  expect(app.run).toHaveBeenCalledTimes(2)
})
it("cancels model reads when the client aborts", async () => {
  const cancelled = vi.fn()
  const controller = new AbortController()
  const stream = new ReadableStream<Uint8Array>({ cancel: cancelled })
  const pending = readModelStream(stream, controller.signal)
  controller.abort(new Error("client disconnected"))
  await expect(pending).rejects.toThrow("client disconnected")
  expect(cancelled).toHaveBeenCalled()
})

it.each(["application/json", "application/x-ndjson"])(
  "reports token truncation in %s without publishing or retrying an incomplete screen",
  async (accept) => {
    const app = setup()
    app.run.mockImplementation(async () => modelStream(answer, "length"))
    const response = await app.fetch(request(undefined, { Accept: accept }))
    const text = await response.text()
    const result =
      accept === "application/json"
        ? JSON.parse(text)
        : JSON.parse(text.trim().split("\n").at(-1)!)
    expect(result).toMatchObject({
      code: "output_token_limit",
      error: expect.stringContaining("16,384"),
      requestId: expect.any(String),
    })
    expect(result.messages).toBeUndefined()
    expect(text).not.toContain('"type":"result"')
    expect(app.run).toHaveBeenCalledTimes(1)
  }
)
it("rejects clean EOF without a model finish marker, even when the partial JSON looks valid", async () => {
  const app = setup()
  app.run.mockImplementation(async () => modelStream(answer, null))
  const response = await app.fetch(request())
  expect(await response.json()).toMatchObject({ code: "incomplete_stream" })
  expect(app.run).toHaveBeenCalledTimes(1)
})
it("reports screen validation separately after both repair attempts fail", async () => {
  const app = setup()
  app.run.mockImplementation(async () => modelStream('{"messagesJson":"[]"}'))
  const response = await app.fetch(request())
  expect(await response.json()).toMatchObject({ code: "invalid_screen" })
  expect(app.run).toHaveBeenCalledTimes(2)
})
it("reports provider failures without leaking model output or provider details", async () => {
  const app = setup()
  app.run.mockRejectedValue(new Error("private provider payload"))
  const response = await app.fetch(request())
  const result = await response.json()
  expect(result).toMatchObject({ code: "provider_error" })
  expect(JSON.stringify(result)).not.toContain("private provider payload")
})
it("aborts generation at the new deadline and reports a timeout", async () => {
  vi.useFakeTimers()
  try {
    const app = setup()
    app.run.mockImplementation(
      (_model, _input, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(options.signal.reason),
            { once: true }
          )
        })
    )
    const pending = app.fetch(request())
    // Flush body parsing and the rate limit before advancing the generation deadline.
    for (let i = 0; i < 20 && !app.run.mock.calls.length; i++)
      await Promise.resolve()
    expect(app.run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(GENERATION_TIMEOUT_MS)
    const response = await pending
    expect(response.status).toBe(504)
    expect(await response.json()).toMatchObject({
      code: "generation_timeout",
      error: expect.stringContaining("180秒"),
    })
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

it("repairs missing closing JSON syntax after a normal finish, then validates the screen", async () => {
  const app = setup()
  app.run.mockImplementation(async () => modelStream(answer.slice(0, -1)))
  const response = await app.fetch(request())
  expect(await response.json()).toMatchObject({ messages, attempts: 1 })
  expect(app.run).toHaveBeenCalledTimes(1)
})
it("still rejects unsupported components after JSON syntax repair", async () => {
  const app = setup()
  app.run.mockImplementation(async () =>
    modelStream(answer.replace('"Heading"', '"Card"').slice(0, -1))
  )
  const response = await app.fetch(request())
  expect(await response.json()).toMatchObject({ code: "invalid_screen" })
  expect(app.run).toHaveBeenCalledTimes(2)
})
