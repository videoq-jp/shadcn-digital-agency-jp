import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"
import { DigitalAgencySurface } from "@/components/a2ui/digital-agency-surface"
import {
  createDigitalAgencySession,
  type DigitalAgencySession,
} from "@/lib/a2ui/session"
import type { ScreenAction } from "./use-codex-generation"

export type PlaygroundSurfaceHandle = {
  getDataModel: () => Record<string, unknown>
}

export const PlaygroundSurface = forwardRef<
  PlaygroundSurfaceHandle,
  {
    source: string
    busy: boolean
    live: boolean
    onAction: (event: ScreenAction) => void
  }
>(function PlaygroundSurface({ source, busy, live, onAction }, ref) {
  const sessionRef = useRef<DigitalAgencySession | null>(null)
  const actionRef = useRef(onAction)
  const liveRef = useRef(live)
  const [processor, setProcessor] = useState<DigitalAgencySession | null>(null)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  useEffect(() => {
    actionRef.current = onAction
    liveRef.current = live
  }, [onAction, live])
  useImperativeHandle(
    ref,
    () => ({
      getDataModel: () => {
        const surface = sessionRef.current?.model.surfacesMap
          .values()
          .next().value
        return structuredClone(
          surface?.dataModel.get<Record<string, unknown>>("/") || {}
        )
      },
    }),
    []
  )
  useEffect(() => {
    const session = createDigitalAgencySession((action) => {
      const surface = session.model.getSurface(action.surfaceId)
      actionRef.current({
        action,
        dataModel: structuredClone(
          surface?.dataModel.get<Record<string, unknown>>("/") || {}
        ),
      })
      if (!liveRef.current)
        setNotice(
          "入力内容を確認しました。これはサンプルです。外部への送信は行っていません。"
        )
    })
    sessionRef.current = session
    const created = session.model.onSurfaceCreated.subscribe(() =>
      setProcessor(session)
    )
    const failed = session.model.onError.subscribe((event) =>
      setError(event.message)
    )
    session.processMessagesWithErrors(JSON.parse(source))
    return () => {
      created.unsubscribe()
      failed.unsubscribe()
      session.dispose()
      if (sessionRef.current === session) sessionRef.current = null
    }
  }, [source])
  return (
    <div className="pg-surface-content">
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        processor && (
          <fieldset
            disabled={busy}
            className="pg-surface-fields"
            aria-label="生成画面の操作"
          >
            <DigitalAgencySurface processor={processor} />
          </fieldset>
        )
      )}
      {notice && (
        <p role="status" className="pg-local-notice">
          {notice}
        </p>
      )}
    </div>
  )
})
