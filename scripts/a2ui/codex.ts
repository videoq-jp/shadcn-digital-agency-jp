import { spawn, execFile } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const executable = () => process.env.A2UI_CODEX_BIN || "codex"

export async function codexLoginStatus() {
  try {
    const { stdout, stderr } = await execFileAsync(
      executable(),
      ["login", "status"],
      { timeout: 10_000 }
    )
    return /Logged in using ChatGPT/i.test(stdout + stderr)
  } catch {
    return false
  }
}

export async function runCodex(
  prompt: string,
  signal: AbortSignal
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "a2ui-codex-"))
  try {
    const schemaPath = join(directory, "output-schema.json")
    await writeFile(
      schemaPath,
      JSON.stringify({
        type: "object",
        properties: { messagesJson: { type: "string" } },
        required: ["messagesJson"],
        additionalProperties: false,
      })
    )
    const args = [
      "exec",
      "--ignore-user-config",
      "--ephemeral",
      "--skip-git-repo-check",
      "--sandbox",
      "read-only",
      "--json",
      "--color",
      "never",
      "--output-schema",
      schemaPath,
      "-c",
      'approval_policy="never"',
      "-c",
      'web_search="disabled"',
      "-c",
      "features.shell_tool=false",
      "-c",
      "features.multi_agent=false",
      "-c",
      'model_reasoning_effort="low"',
    ]
    if (process.env.A2UI_CODEX_MODEL)
      args.push("--model", process.env.A2UI_CODEX_MODEL)
    args.push("-")
    return await new Promise<string>((resolve, reject) => {
      // No shell: user prompts are sent only through stdin. Authentication stays
      // with the installed CLI; no credential file is read or copied by this app.
      const child = spawn(executable(), args, {
        cwd: directory,
        signal,
        stdio: ["pipe", "pipe", "pipe"],
      })
      let stdout = ""
      let stderr = ""
      child.stdout.setEncoding("utf8")
      child.stderr.setEncoding("utf8")
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk
        if (stdout.length > 1_000_000) child.kill("SIGTERM")
      })
      child.stderr.on("data", (chunk: string) => {
        stderr = (stderr + chunk).slice(-8000)
      })
      child.stdin.on("error", () => {
        /* exit/error handles a closed CLI */
      })
      child.on("error", (error) => {
        if (signal.aborted) reject(signal.reason)
        else
          reject(
            new Error(
              error.message.includes("ENOENT")
                ? "codexコマンドが見つかりません。Codex CLIをインストールしてください。"
                : "Codexを起動できませんでした。"
            )
          )
      })
      child.on("close", (code) => {
        if (signal.aborted) return reject(signal.reason)
        if (code !== 0 || stdout.length > 1_000_000) {
          const loginError = /unauthorized|not logged|401|authentication/i.test(
            stderr
          )
          return reject(
            new Error(
              loginError
                ? "Codexにログインしてください: codex login"
                : "Codexの実行に失敗しました。ログイン・利用上限・モデル設定を確認してください。"
            )
          )
        }
        try {
          const events = stdout
            .split("\n")
            .filter(Boolean)
            .map(
              (line) =>
                JSON.parse(line) as {
                  type: string
                  item?: { type: string; text?: string }
                  error?: { message: string }
                }
            )
          const final = events
            .filter(
              (event) =>
                event.type === "item.completed" &&
                event.item?.type === "agent_message"
            )
            .slice(-1)[0]?.item?.text
          if (!final || events.some((event) => event.type === "turn.failed"))
            throw new Error("Codexが画面の生成を完了できませんでした。")
          resolve(final)
        } catch {
          reject(new Error("Codexから有効な生成結果を受け取れませんでした。"))
        }
      })
      child.stdin.end(prompt)
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
