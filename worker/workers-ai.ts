import { jsonrepair } from "jsonrepair"
import { ModelGenerationError } from "./generation-errors"
import type { CodexRunner } from "../scripts/a2ui/protocol"

export const AI_MODEL = "@cf/openai/gpt-oss-120b"
export const MAX_OUTPUT_TOKENS = 16_384
export const GENERATION_TIMEOUT_MS = 180_000
export const AI_PROVIDER = "Workers AI · GPT-OSS 120B"

/** Only public answer deltas leave the model stream; reasoning stays on the server. */
export async function readModelStream(
  stream: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onDelta?: (delta: string) => void
): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let output = ""
  let bytes = 0
  let finishReason: string | undefined
  let done = false
  const abort = () => {
    void reader.cancel(signal.reason).catch(() => {})
  }
  signal.addEventListener("abort", abort, { once: true })
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return
    const data = line.slice(5).trim()
    if (!data) return
    if (data === "[DONE]") {
      done = true
      return
    }
    if (done)
      throw new ModelGenerationError(
        "incomplete_stream",
        "AIの応答が正しく終了しませんでした。再試行してください。"
      )
    const event = JSON.parse(data)
    if (event.error)
      throw new ModelGenerationError(
        "provider_error",
        "AIサービスで生成エラーが発生しました。少し待って再試行してください。"
      )
    if (event.choices?.[0]?.finish_reason)
      finishReason = event.choices[0].finish_reason
    const delta = event.choices?.[0]?.delta?.content
    if (typeof delta === "string") {
      output += delta
      if (output.length > 100_000)
        throw new ModelGenerationError(
          "output_size_limit",
          "画面データのサイズ上限を超えました。内容を複数の画面に分けて依頼してください。"
        )
      onDelta?.(delta)
    }
  }
  try {
    signal.throwIfAborted()
    while (true) {
      const chunk = await reader.read()
      signal.throwIfAborted()
      bytes += chunk.value?.byteLength ?? 0
      if (bytes > 32_000_000)
        throw new ModelGenerationError(
          "output_size_limit",
          "画面データのサイズ上限を超えました。内容を複数の画面に分けて依頼してください。"
        )
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      let end: number
      while ((end = buffer.indexOf("\n")) !== -1) {
        consume(buffer.slice(0, end).replace(/\r$/, ""))
        buffer = buffer.slice(end + 1)
      }
      if (chunk.done) break
    }
    if (buffer.trim()) consume(buffer)
    if (finishReason === "length")
      throw new ModelGenerationError(
        "output_token_limit",
        `AIの出力トークン上限（${MAX_OUTPUT_TOKENS.toLocaleString("en-US")}）に達し、画面データが途中で切れました。内容を複数の画面に分けて依頼してください。`
      )
    if (finishReason === "content_filter")
      throw new ModelGenerationError(
        "model_refusal",
        "AIサービスがこの依頼への応答を制限しました。依頼の内容を変えてください。"
      )
    if (finishReason !== "stop")
      throw new ModelGenerationError(
        "incomplete_stream",
        "AIの応答が完了する前に接続が閉じました。もう一度試してください。"
      )
    if (!output)
      throw new ModelGenerationError(
        "provider_error",
        "AIサービスから画面データを受け取れませんでした。再試行してください。"
      )
    return output
  } catch (error) {
    if (signal.aborted || error instanceof ModelGenerationError) throw error
    throw new ModelGenerationError(
      "incomplete_stream",
      "AIの応答を最後まで受信できませんでした。もう一度試してください。"
    )
  } finally {
    signal.removeEventListener("abort", abort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export function createWorkersAiRunner(ai: Pick<Env["AI"], "run">): CodexRunner {
  return async (prompt, signal, onDelta) => {
    signal.throwIfAborted()
    const stream = await ai.run(
      AI_MODEL,
      {
        messages: [
          {
            role: "system",
            content: `Generate ONLY a JSON array containing the three complete A2UI messages. Do not wrap it in an object or encode it as a string. No markdown fences. Strictly follow the catalog and the user's protocol instructions. The root ID must be the literal string "root". Components are a FLAT list, never nested in children. Column.children is always string IDs.
Example valid structure (replace content to fulfill the requested UI):
${JSON.stringify([
  {
    version: "1.0",
    createSurface: {
      surfaceId: "generated",
      catalogId:
        "https://github.com/videoq-jp/shadcn-digital-agency-jp/catalogs/a2ui/v1",
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
          children: ["heading", "name", "agree", "submit"],
        },
        { id: "heading", component: "Heading", text: "申込フォーム" },
        {
          id: "name",
          component: "Input",
          label: "氏名",
          value: { "@path": "/name" },
        },
        {
          id: "agree",
          component: "Checkbox",
          label: "確認しました",
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
])}`,
          },
          { role: "user", content: prompt },
        ],
        stream: true,
        max_tokens: MAX_OUTPUT_TOKENS,
        reasoning_effort: "low",
        temperature: 0.2,
      },
      { signal }
    )
    const output = await readModelStream(stream, signal, onDelta)
    // Only repair syntax after a normal model finish. The shared catalog validator
    // still rejects unsupported components, missing data and broken references.
    try {
      JSON.parse(output)
      return output
    } catch {
      try {
        return jsonrepair(output)
      } catch {
        return output
      }
    }
  }
}
