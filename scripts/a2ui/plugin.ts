import type { IncomingMessage, ServerResponse } from "node:http"
import type { Plugin } from "vite"
import { runCodexStream } from "./codex-stream"
import { codexLoginStatus, runCodex } from "./codex"
import { generateScreen, requestSchema, type CodexRunner } from "./protocol"

const json = (response: ServerResponse, status: number, body: unknown) => {
  if (response.destroyed || response.writableEnded) return
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  response.end(JSON.stringify(body))
}

export function isLocalRequest(request: IncomingMessage) {
  const address = request.socket.remoteAddress
  if (!address || !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address))
    return false
  const host = request.headers.host || ""
  try {
    const local = new URL(`http://${host}`)
    if (!["127.0.0.1", "localhost", "[::1]"].includes(local.hostname))
      return false
    if (request.headers.origin && new URL(request.headers.origin).host !== host)
      return false
    return !["cross-site", "same-site"].includes(
      request.headers["sec-fetch-site"] as string
    )
  } catch {
    return false
  }
}

async function readBody(request: IncomingMessage) {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 100_000) throw new Error("依頼が大きすぎます。")
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown
}

export function createCodexMiddleware(options: {
  enabled: boolean
  run?: CodexRunner
  loginStatus?: () => Promise<boolean>
  timeoutMs?: number
}) {
  let active: AbortController | undefined
  const handle = async (
    request: IncomingMessage,
    response: ServerResponse,
    next: () => void
  ) => {
    const path = request.url?.split("?")[0]
    if (!path?.startsWith("/api/a2ui/")) return next()
    if (!isLocalRequest(request))
      return json(response, 403, {
        error: "このAPIは同じPC・同じオリジンからのみ利用できます。",
      })
    if (path === "/api/a2ui/status" && request.method === "GET") {
      const authenticated =
        options.enabled && (await (options.loginStatus || codexLoginStatus)())
      return json(response, 200, {
        enabled: options.enabled,
        authenticated,
        provider: "Codex / ChatGPTログイン",
      })
    }
    if (path !== "/api/a2ui/generate")
      return json(response, 404, { error: "APIが見つかりません。" })
    if (request.method !== "POST")
      return json(response, 405, { error: "POSTを使用してください。" })
    if (!options.enabled)
      return json(response, 503, {
        error: "npm run demo:llm でLLM対応デモを起動してください。",
      })
    if (!request.headers["content-type"]?.startsWith("application/json"))
      return json(response, 415, {
        error: "application/jsonを指定してください。",
      })
    if (active)
      return json(response, 429, {
        error: "別の生成が進行中です。完了後に再試行してください。",
      })
    const controller = new AbortController()
    active = controller
    const disconnect = () => {
      if (!response.writableEnded)
        controller.abort(new Error("生成を中止しました。"))
    }
    response.on("close", disconnect)
    const timeout = setTimeout(
      () =>
        controller.abort(
          new Error("生成がタイムアウトしました。もう一度試してください。")
        ),
      options.timeoutMs || 120_000
    )
    let streaming = false
    const emit = (event: unknown) => {
      if (!response.destroyed && !response.writableEnded)
        response.write(JSON.stringify(event) + "\n")
    }
    try {
      let input
      try {
        input = requestSchema.parse(await readBody(request))
      } catch {
        return json(response, 400, {
          error:
            "依頼は1〜4000文字で指定してください。リクエスト形式も確認してください。",
        })
      }
      if (!(await (options.loginStatus || codexLoginStatus)())) {
        return json(response, 503, {
          error: "このPCのCodexにChatGPTでログインしてください: codex login",
        })
      }
      const start = Date.now()
      streaming = Boolean(
        request.headers.accept?.includes("application/x-ndjson")
      )
      if (streaming) {
        response.writeHead(200, {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        })
        response.flushHeaders()
      }
      const result = await generateScreen(
        input,
        options.run || (streaming ? runCodexStream : runCodex),
        controller.signal,
        streaming ? emit : undefined
      )
      const output = {
        ...result,
        elapsedMs: Date.now() - start,
        provider: "Codex / ChatGPTログイン",
      }
      if (streaming) {
        emit({ type: "result", ...output })
        response.end()
      } else json(response, 200, output)
    } catch (cause) {
      const reason = controller.signal.aborted
        ? controller.signal.reason
        : cause
      const error =
        reason instanceof Error ? reason.message : "生成に失敗しました。"
      if (streaming) {
        emit({ type: "error", error })
        response.end()
      } else json(response, controller.signal.aborted ? 504 : 502, { error })
    } finally {
      clearTimeout(timeout)
      response.off("close", disconnect)
      if (active === controller) active = undefined
    }
  }
  return {
    handle,
    dispose: () => active?.abort(new Error("サーバーを停止しました。")),
  }
}

export function codexA2uiPlugin(): Plugin {
  return {
    name: "local-codex-a2ui",
    apply: "serve",
    configureServer(server) {
      const middleware = createCodexMiddleware({
        enabled: process.env.A2UI_CODEX_ENABLED === "1",
      })
      server.middlewares.use((request, response, next) => {
        void middleware.handle(request, response, next).catch(() =>
          json(response, 500, {
            error: "ローカルAPIでエラーが発生しました。",
          })
        )
      })
      server.httpServer?.once("close", middleware.dispose)
    },
  }
}
