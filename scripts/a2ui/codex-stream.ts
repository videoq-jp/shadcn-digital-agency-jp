import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"

/** Local stdio only. Codex owns login/refresh; only generated text leaves this process. */
export async function runCodexStream(
  prompt: string,
  signal: AbortSignal,
  onDelta?: (delta: string) => void
): Promise<string> {
  signal.throwIfAborted()
  const directory = await mkdtemp(join(tmpdir(), "a2ui-stream-"))
  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(
        process.env.A2UI_CODEX_BIN || "codex",
        [
          "app-server",
          "--listen",
          "stdio://",
          "-c",
          "mcp_servers={}",
          "-c",
          "features.apps=false",
          "-c",
          "features.plugins=false",
          "-c",
          "features.shell_tool=false",
          "-c",
          "features.multi_agent=false",
          "-c",
          'web_search="disabled"',
        ],
        { cwd: directory, signal, stdio: ["pipe", "pipe", "pipe"] }
      )
      const lines = createInterface({ input: child.stdout })
      let done = false
      let threadId = ""
      let turnId = ""
      let text = ""
      let final = ""
      const finish = (error?: Error) => {
        if (done) return
        done = true
        lines.close()
        child.stdin.end()
        child.kill("SIGTERM")
        if (error) reject(error)
        else resolve(final || text)
      }
      const send = (method: string, params: unknown, id?: number) =>
        child.stdin.write(
          JSON.stringify({
            method,
            params,
            ...(id === undefined ? {} : { id }),
          }) + "\n"
        )
      child.stderr.resume()
      child.stdin.on("error", () => {
        /* process lifecycle handles early pipe closure */
      })
      child.on("error", () =>
        finish(
          new Error(
            signal.aborted
              ? "生成を中止しました。"
              : "Codex app-serverを起動できませんでした。"
          )
        )
      )
      child.on("close", () => {
        if (!done) finish(new Error("Codexの接続が生成完了前に閉じました。"))
      })
      lines.on("line", (line) => {
        if (done) return
        try {
          const message = JSON.parse(line)
          if (message.error)
            return finish(
              new Error(
                "Codexへの依頼に失敗しました。ログイン・利用上限・モデル設定を確認してください。"
              )
            )
          // Never approve a tool, command or interactive request from the model.
          if (message.method && message.id !== undefined) {
            sendError(message.id)
            return finish(
              new Error("画面生成で想定外のツール操作が要求されました。")
            )
          }
          if (message.id === 0) {
            send("initialized", {})
            send(
              "thread/start",
              {
                cwd: directory,
                sandbox: "read-only",
                approvalPolicy: "never",
                ephemeral: true,
                ...(process.env.A2UI_CODEX_MODEL
                  ? { model: process.env.A2UI_CODEX_MODEL }
                  : {}),
                baseInstructions:
                  "Generate only the requested A2UI JSON data. Never call tools, access files, browse or run commands.",
                config: {
                  mcp_servers: {},
                  "features.shell_tool": false,
                  "features.multi_agent": false,
                },
              },
              1
            )
          } else if (message.id === 1) {
            threadId = message.result?.thread?.id
            if (!threadId) throw new Error("thread")
            send(
              "turn/start",
              {
                threadId,
                input: [{ type: "text", text: prompt }],
                effort: "low",
                outputSchema: {
                  type: "object",
                  properties: { messagesJson: { type: "string" } },
                  required: ["messagesJson"],
                  additionalProperties: false,
                },
              },
              2
            )
          } else if (message.id === 2) {
            turnId = message.result?.turn?.id
          } else if (message.params?.threadId === threadId) {
            if (message.method === "item/agentMessage/delta") {
              const delta = message.params.delta
              if (typeof delta !== "string") throw new Error("delta")
              text += delta
              if (text.length > 100_000) throw new Error("size")
              onDelta?.(delta)
            } else if (
              message.method === "item/completed" &&
              message.params.item?.type === "agentMessage"
            ) {
              final = message.params.item.text
            } else if (message.method === "turn/completed") {
              if (
                message.params.turn?.status !== "completed" ||
                (turnId && message.params.turn.id !== turnId) ||
                !(final || text)
              )
                return finish(
                  new Error("Codexが画面生成を完了できませんでした。")
                )
              finish()
            }
          }
        } catch {
          finish(new Error("Codexから有効なストリームを受け取れませんでした。"))
        }
      })
      const sendError = (id: unknown) =>
        child.stdin.write(
          JSON.stringify({
            id,
            error: {
              code: -32601,
              message:
                "Tools and interactive requests are disabled for UI generation.",
            },
          }) + "\n"
        )
      send(
        "initialize",
        {
          clientInfo: {
            name: "a2ui_playground",
            title: "Digital Agency A2UI Playground",
            version: "0.1.0",
          },
        },
        0
      )
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
