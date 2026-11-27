import { useCallback, useEffect, useRef, useState } from "react"
import { messagesPrefix, readGenerationStream } from "./generation-stream"
import type { ActionPayload } from "@a2ui/web_core"

export type ScreenAction = {
  action: ActionPayload
  dataModel: Record<string, unknown>
}
export type GeneratedScreen = {
  messages: unknown[]
  attempts: number
  elapsedMs: number
  provider: string
}

export function useCodexGeneration(
  onGenerated: (result: GeneratedScreen, prompt: string) => void
) {
  const [status, setStatus] = useState<{
    enabled: boolean
    authenticated: boolean
    runtime?: "workers-ai"
    provider?: string
    model?: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [stream, setStream] = useState("")
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState("")
  const [result, setResult] = useState<GeneratedScreen | null>(null)
  const [lastAction, setLastAction] = useState<ActionPayload | null>(null)
  const active = useRef<AbortController | null>(null)
  const onGeneratedRef = useRef(onGenerated)

  useEffect(() => {
    onGeneratedRef.current = onGenerated
  }, [onGenerated])
  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/a2ui/status", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("LLMの接続状態を取得できませんでした。")
        setStatus(await response.json())
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setStatus({ enabled: false, authenticated: false })
      })
    return () => {
      controller.abort()
      active.current?.abort()
    }
  }, [])

  const generate = useCallback(
    async (
      prompt: string,
      previousMessages?: unknown[],
      event?: ScreenAction,
      dataModel?: Record<string, unknown>
    ) => {
      if (active.current) return
      const controller = new AbortController()
      active.current = controller
      setBusy(true)
      setStream("")
      setAttempt(0)
      setError("")
      if (event) setLastAction(event.action)
      try {
        const response = await fetch("/api/a2ui/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/x-ndjson",
          },
          signal: controller.signal,
          body: JSON.stringify({
            prompt,
            ...(previousMessages ? { previousMessages } : {}),
            ...(dataModel ? { dataModel } : {}),
            ...(event
              ? {
                  action: {
                    name: event.action.name,
                    surfaceId: event.action.surfaceId,
                    context: event.action.context,
                  },
                  dataModel: event.dataModel,
                }
              : {}),
          }),
        })
        let envelope = ""
        const data = (
          response.ok &&
          response.headers
            ?.get("Content-Type")
            ?.includes("application/x-ndjson")
            ? await readGenerationStream<GeneratedScreen & { error?: string }>(
                response,
                (event) => {
                  if (
                    active.current !== controller ||
                    controller.signal.aborted
                  )
                    return
                  if (event.type === "attempt") {
                    envelope = ""
                    setStream("")
                    setAttempt(event.attempt || 1)
                  }
                  if (
                    event.type === "delta" &&
                    typeof event.delta === "string"
                  ) {
                    envelope += event.delta
                    setStream(messagesPrefix(envelope))
                  }
                }
              )
            : await response.json()
        ) as GeneratedScreen & { error?: string }
        if (!response.ok) throw new Error(data.error || "生成に失敗しました。")
        if (!Array.isArray(data.messages))
          throw new Error("有効な画面を受け取れませんでした。")
        if (active.current !== controller || controller.signal.aborted) return
        setStream(JSON.stringify(data.messages, null, 2))
        onGeneratedRef.current(data, prompt)
        setResult(data)
      } catch (cause) {
        if (active.current !== controller) return
        setError(
          controller.signal.aborted
            ? "生成を中止しました。"
            : cause instanceof Error
              ? cause.message
              : "生成に失敗しました。"
        )
      } finally {
        if (active.current === controller) {
          active.current = null
          setBusy(false)
        }
      }
    },
    []
  )

  return {
    status,
    busy,
    stream,
    attempt,
    error,
    result,
    lastAction,
    generate,
    cancel: () => active.current?.abort(),
    reset: () => {
      active.current?.abort()
      active.current = null
      setBusy(false)
      setStream("")
      setAttempt(0)
      setError("")
      setResult(null)
      setLastAction(null)
    },
  }
}
