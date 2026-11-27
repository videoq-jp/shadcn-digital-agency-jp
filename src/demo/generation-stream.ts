/** Decode the completed portion of messagesJson without inventing missing JSON. */
export function messagesPrefix(envelope: string): string {
  // Workers AI emits A2UI directly; Codex uses its structured messagesJson envelope.
  if (envelope.trimStart().startsWith("[")) return envelope.trimStart()
  const match = /"messagesJson"\s*:\s*"/.exec(envelope)
  if (!match) return ""
  let output = ""
  for (
    let index = match.index + match[0].length;
    index < envelope.length;
    index++
  ) {
    const character = envelope[index]
    if (character === '"') break
    if (character !== "\\") {
      output += character
      continue
    }
    const escape = envelope[++index]
    if (escape === undefined) break
    const simple: Record<string, string> = {
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
    }
    if (escape in simple) output += simple[escape]
    else if (escape === "u") {
      const hex = envelope.slice(index + 1, index + 5)
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) break
      output += String.fromCharCode(parseInt(hex, 16))
      index += 4
    } else break
  }
  return output
}

export async function readGenerationStream<T>(
  response: Response,
  onEvent: (event: { type: string; delta?: string; attempt?: number }) => void
): Promise<T> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("生成ストリームを受信できませんでした。")
  const decoder = new TextDecoder()
  let buffer = ""
  let result: T | undefined
  let ended = false
  const consume = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line)
    if (event.type === "error")
      throw new Error(event.error || "生成に失敗しました。")
    if (event.type === "result") {
      result = event as T
      ended = true
    } else if (!ended) onEvent(event)
  }
  try {
    while (true) {
      const chunk = await reader.read()
      buffer += decoder.decode(chunk.value, { stream: !chunk.done })
      if (buffer.length > 1_000_000) throw new Error("生成結果が大きすぎます。")
      let newline: number
      while ((newline = buffer.indexOf("\n")) !== -1) {
        consume(buffer.slice(0, newline))
        buffer = buffer.slice(newline + 1)
      }
      if (chunk.done) break
    }
    consume(buffer)
    if (!ended || !result)
      throw new Error("生成が完了する前に接続が閉じました。")
    return result
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** Only consume fully closed JSON values; incomplete components are never rendered. */
function completedValues(text: string, start: number): unknown[] {
  const values: unknown[] = []
  let begin = -1
  let depth = 0
  let quoted = false
  let escaped = false
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i]
    if (begin < 0) {
      if (/\s|,/.test(c)) continue
      if (c === "]") break
      begin = i
    }
    if (quoted) {
      if (escaped) escaped = false
      else if (c === "\\") escaped = true
      else if (c === '"') quoted = false
    } else if (c === '"') quoted = true
    else if (c === "{" || c === "[") depth++
    else if (c === "}" || c === "]") {
      depth--
      if (depth === 0) {
        try {
          values.push(JSON.parse(text.slice(begin, i + 1)))
        } catch {
          break
        }
        begin = -1
      }
    }
  }
  return values
}

export function partialScreen(text: string): string | null {
  try {
    const operations = completedValues(text, text.indexOf("[")) as {
      createSurface?: { surfaceId: string }
      updateDataModel?: unknown
    }[]
    if (!operations[0]?.createSurface || !operations[1]?.updateDataModel)
      return null
    const match =
      /"updateComponents"\s*:\s*\{\s*"surfaceId"\s*:\s*"(?:[^"\\]|\\.)*"\s*,\s*"components"\s*:\s*\[/.exec(
        text
      ) || /"components"\s*:\s*\[/.exec(text)
    if (!match) return null
    const start = match.index + match[0].length - 1
    const components = completedValues(text, start) as {
      id: string
      children?: unknown[]
    }[]
    if (!components.some((node) => node.id === "root")) return null
    const ids = new Set(components.map((node) => node.id))
    const ready = components.map((node) => ({
      ...node,
      ...(Array.isArray(node.children)
        ? {
            children: node.children.filter((child) =>
              typeof child === "string"
                ? ids.has(child)
                : child &&
                  typeof child === "object" &&
                  "id" in child &&
                  ids.has(String(child.id))
            ),
          }
        : {}),
    }))
    return JSON.stringify([
      operations[0],
      operations[1],
      {
        version: "1.0",
        updateComponents: {
          surfaceId: operations[0].createSurface.surfaceId,
          components: ready,
        },
      },
    ])
  } catch {
    return null
  }
}
