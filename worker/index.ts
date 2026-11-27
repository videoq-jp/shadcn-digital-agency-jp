import { generateScreen, requestSchema } from "../scripts/a2ui/protocol"
import {
  AI_MODEL,
  AI_PROVIDER,
  GENERATION_TIMEOUT_MS,
  MAX_OUTPUT_TOKENS,
  createWorkersAiRunner,
} from "./workers-ai"
import { publicGenerationError } from "./generation-errors"

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
}
const json = (body: unknown, status = 200, extra?: Record<string, string>) =>
  Response.json(body, { status, headers: { ...headers, ...extra } })

async function readJson(request: Request): Promise<unknown> {
  if (Number(request.headers.get("Content-Length")) > 100_000)
    throw new Error("body limit")
  const reader = request.body?.getReader()
  if (!reader) throw new Error("empty body")
  let size = 0
  let text = ""
  const decoder = new TextDecoder()
  try {
    while (true) {
      const chunk = await reader.read()
      size += chunk.value?.byteLength ?? 0
      if (size > 100_000) throw new Error("body limit")
      text += decoder.decode(chunk.value, { stream: !chunk.done })
      if (chunk.done) return JSON.parse(text)
    }
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export default {
  async fetch(
    request: Request,
    env: {
      AI: Pick<Env["AI"], "run">
      AI_RATE_LIMITER: Env["AI_RATE_LIMITER"]
      ASSETS: Pick<Env["ASSETS"], "fetch">
    }
  ): Promise<Response> {
    const url = new URL(request.url)
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request)
    if (url.pathname === "/api/a2ui/status" && request.method === "GET")
      return json({
        enabled: true,
        authenticated: true,
        provider: AI_PROVIDER,
        model: AI_MODEL,
        runtime: "workers-ai",
        limits: {
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          timeoutMs: GENERATION_TIMEOUT_MS,
        },
      })
    if (url.pathname !== "/api/a2ui/generate")
      return json({ error: "APIが見つかりません。" }, 404)
    if (request.method !== "POST")
      return json({ error: "POSTを使用してください。" }, 405, { Allow: "POST" })
    if (
      (request.headers.has("Origin") &&
        request.headers.get("Origin") !== url.origin) ||
      request.headers.get("Sec-Fetch-Site") === "cross-site"
    )
      return json({ error: "同じサイトから利用してください。" }, 403)
    if (!request.headers.get("Content-Type")?.startsWith("application/json"))
      return json({ error: "application/jsonを指定してください。" }, 415)
    let input
    try {
      input = requestSchema.parse(await readJson(request))
    } catch {
      return json(
        {
          error:
            "依頼は1〜4000文字、リクエスト全体は100KB以内で指定してください。",
        },
        400
      )
    }
    const rate = await env.AI_RATE_LIMITER.limit({
      key: request.headers.get("CF-Connecting-IP") ?? "unknown",
    })
    if (!rate.success)
      return json(
        { error: "生成は1分に5回までです。少し待って再試行してください。" },
        429,
        { "Retry-After": "60" }
      )
    const started = Date.now()
    const requestId = crypto.randomUUID()
    const controller = new AbortController()
    const abort = () => controller.abort(request.signal.reason)
    request.signal.addEventListener("abort", abort, { once: true })
    if (request.signal.aborted) abort()
    const timeout = setTimeout(
      () =>
        controller.abort(
          new Error("生成がタイムアウトしました。再試行してください。")
        ),
      GENERATION_TIMEOUT_MS
    )
    const cleanup = () => {
      clearTimeout(timeout)
      request.signal.removeEventListener("abort", abort)
    }
    const failure = (error: unknown) => {
      const result = publicGenerationError(
        error,
        controller.signal.aborted && !request.signal.aborted
      )
      console.error({
        event: "a2ui_generation_failed",
        requestId,
        code: result.code,
        elapsedMs: Date.now() - started,
      })
      return { ...result, requestId }
    }
    const run = createWorkersAiRunner(env.AI)
    if (!request.headers.get("Accept")?.includes("application/x-ndjson")) {
      try {
        const result = await generateScreen(
          input,
          run,
          controller.signal,
          undefined,
          "array"
        )
        return json({
          ...result,
          elapsedMs: Date.now() - started,
          provider: AI_PROVIDER,
        })
      } catch (error) {
        return json(failure(error), controller.signal.aborted ? 504 : 502)
      } finally {
        cleanup()
      }
    }
    const encoder = new TextEncoder()
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      async start(stream) {
        const emit = (event: unknown) => {
          if (!cancelled && !controller.signal.aborted)
            stream.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
        }
        try {
          const result = await generateScreen(
            input,
            run,
            controller.signal,
            emit,
            "array"
          )
          emit({
            type: "result",
            ...result,
            elapsedMs: Date.now() - started,
            provider: AI_PROVIDER,
          })
        } catch (error) {
          if (!cancelled && !request.signal.aborted)
            stream.enqueue(
              encoder.encode(
                JSON.stringify({ type: "error", ...failure(error) }) + "\n"
              )
            )
        } finally {
          cleanup()
          if (!cancelled) stream.close()
        }
      },
      cancel() {
        cancelled = true
        controller.abort(new Error("生成を中止しました。"))
        cleanup()
      },
    })
    return new Response(body, {
      headers: {
        ...headers,
        "Content-Type": "application/x-ndjson; charset=utf-8",
      },
    })
  },
} satisfies ExportedHandler<Env>
