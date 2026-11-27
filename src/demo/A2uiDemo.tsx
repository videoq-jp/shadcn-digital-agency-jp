import {
  useCallback,
  useMemo,
  useLayoutEffect,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type CSSProperties,
} from "react"
import { createPortal } from "react-dom"
import a2uiMark from "./assets/a2ui.svg"
import geistLicense from "./assets/GEIST-LICENSE.txt?url"
import copilotkitLicense from "./assets/COPILOTKIT-LICENSE.txt?url"
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  BarChart3,
  Blocks,
  Braces,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Users,
  Globe,
  LifeBuoy,
  Code2,
  Copy,
  LoaderCircle,
  MessageSquare,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Send,
  Sparkles,
  Square,
  Sun,
  Tablet,
  Smartphone,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react"
import type { ActionPayload } from "@a2ui/web_core"
import { validateCompleteScreen } from "@/lib/a2ui/validation"
import {
  PlaygroundSurface,
  type PlaygroundSurfaceHandle,
} from "./PlaygroundSurface"
import { playgroundExamples } from "./playground-examples"
import { useCodexGeneration, type ScreenAction } from "./use-codex-generation"
import { partialScreen } from "./generation-stream"
import "./playground.css"
import "./reference-theme.css"

type Tab = "preview" | "stream" | "code" | "json" | "events"
type Version = { id: number; source: string; prompt: string; live: boolean }
type ChatMessage = {
  id: number
  role: "user" | "assistant"
  text: string
  version?: Version
  elapsedMs?: number
}
type SavedSession = {
  current: Version
  source: string
  chat: ChatMessage[]
  prompt: string
  editorBase: string
}
const SESSION_KEY = "a2ui-playground-session-v1"
function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw || raw.length > 600_000) return null
    const saved = JSON.parse(raw) as SavedSession
    const checkVersion = (value: Version) => {
      if (
        !value ||
        !Number.isFinite(value.id) ||
        typeof value.prompt !== "string" ||
        typeof value.live !== "boolean" ||
        typeof value.source !== "string"
      )
        throw new Error("Invalid saved screen")
      validateCompleteScreen(JSON.parse(value.source))
    }
    checkVersion(saved.current)
    if (
      typeof saved.source !== "string" ||
      saved.source.length > 80_000 ||
      typeof saved.prompt !== "string" ||
      typeof saved.editorBase !== "string" ||
      !Array.isArray(saved.chat) ||
      saved.chat.length > 40
    )
      return null
    for (const message of saved.chat) {
      if (
        !message ||
        !Number.isFinite(message.id) ||
        !["user", "assistant"].includes(message.role) ||
        typeof message.text !== "string"
      )
        return null
      if (message.version) checkVersion(message.version)
    }
    return saved
  } catch {
    return null
  }
}

const starterIcons = [BarChart3, Users, Globe, LifeBuoy]
const referenceStarters = [
  "Q3 sales by region as a dashboard",
  "Monthly signups by plan as a dashboard",
  "Website traffic by channel as a dashboard",
  "Support tickets by priority as a dashboard",
]

function componentCount(source: string) {
  try {
    return (
      JSON.parse(source) as {
        updateComponents?: { components?: unknown[] }
        createSurface?: { components?: unknown[] }
      }[]
    ).reduce(
      (count, message) =>
        count +
        (message.updateComponents?.components?.length ||
          message.createSurface?.components?.length ||
          0),
      0
    )
  } catch {
    return 0
  }
}

function HighlightedJson({ source }: { source: string }) {
  return source
    .split(
      /("(?:[^"\\]|\\.)*"\s*:|"(?:[^"\\]|\\.)*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g
    )
    .map((token, index) => (
      <span
        key={index}
        className={
          token.startsWith('"')
            ? token.trimEnd().endsWith(":")
              ? "pg-json-key"
              : "pg-json-string"
            : /^(?:true|false|null|-?\d)/.test(token)
              ? "pg-json-value"
              : undefined
        }
      >
        {token}
      </span>
    ))
}

export default function A2uiDemo() {
  const [saved] = useState(loadSession)
  const [workspace, setWorkspace] = useState(Boolean(saved))
  const [prompt, setPrompt] = useState(saved?.prompt || "")
  const [current, setCurrent] = useState<Version | null>(saved?.current || null)
  const [source, setSource] = useState(saved?.source || "")
  const [chat, setChat] = useState<ChatMessage[]>(saved?.chat || [])
  const [events, setEvents] = useState<ActionPayload[]>([])
  const [tab, setTab] = useState<Tab>("preview")
  const [width, setWidth] = useState("desktop")
  const [editorError, setEditorError] = useState("")
  const [toast, setToast] = useState("")
  const [sidebar, setSidebar] = useState(true)
  const [help, setHelp] = useState(false)
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem("a2ui-playground-theme") === "dark"
    } catch {
      return false
    }
  })
  const [elapsed, setElapsed] = useState(0)
  const [queued, setQueued] = useState<string | null>(null)
  const [editorBase, setEditorBase] = useState(saved?.editorBase || "")
  const [editorChoice, setEditorChoice] = useState("current")
  const [editorWide, setEditorWide] = useState(true)
  const [outputOpen, setOutputOpen] = useState(true)
  const [ask, setAsk] = useState("")
  const [caret, setCaret] = useState(0)
  const [conversationWidth, setConversationWidth] = useState<number | null>(
    null
  )
  const [menuSection, setMenuSection] = useState("home")
  const [previewHost] = useState(() => {
    const host = document.createElement("div")
    host.className = "pg-preview-mount"
    return host
  })
  useLayoutEffect(() => {
    if (!workspace) return
    const target = document.getElementById(
      tab === "json" ? "pg-editor-preview" : "pg-chat-preview"
    )
    target?.appendChild(previewHost)
    return () => {
      previewHost.remove()
    }
  }, [workspace, tab, previewHost])
  const serial = useRef(
    Math.max(
      0,
      saved?.current.id || 0,
      ...(saved?.chat.flatMap((message) => [
        message.id,
        message.version?.id || 0,
      ]) || [])
    )
  )
  const surface = useRef<PlaygroundSurfaceHandle>(null)
  const conversationEnd = useRef<HTMLDivElement>(null)
  const helpDialog = useRef<HTMLDialogElement>(null)
  const jsonLines = useRef<HTMLPreElement>(null)
  const jsonHighlight = useRef<HTMLPreElement>(null)
  const editorEscape = useRef(false)
  const streamEnd = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const pending = useRef({ prompt: "", label: "" })

  const codex = useCodexGeneration((result, requestPrompt) => {
    const next = JSON.stringify(result.messages, null, 2)
    const version = {
      id: ++serial.current,
      source: next,
      prompt: requestPrompt,
      live: true,
    }
    setCurrent(version)
    setSource(next)
    setEditorBase(next)
    setEditorChoice("current")
    setEditorError("")
    setChat((previous) =>
      [
        ...previous,
        {
          id: ++serial.current,
          role: "assistant" as const,
          text: pending.current.label
            ? "操作内容を反映して、画面を更新しました。"
            : "ご依頼に合わせて画面を作成しました。プレビューから操作できます。",
          version,
          elapsedMs: result.elapsedMs,
        },
      ].slice(-40)
    )
  })
  const { busy: generating, generate } = codex
  const streamingSource = useMemo(
    () => (generating ? partialScreen(codex.stream) : null),
    [generating, codex.stream]
  )
  const connected = Boolean(codex.status?.enabled && codex.status.authenticated)
  const publicAi = codex.status?.runtime === "workers-ai"
  const providerLabel = publicAi ? "Workers AI" : "Codex"
  const providerDescription = publicAi
    ? "Cloudflare Workers AI（GPT-OSS 120B）を使用します。"
    : "このPCのChatGPTログインを使用。モデルはCodex設定に従います。"

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return
      document
        .querySelectorAll<HTMLDetailsElement>(".a2ui-playground details[open]")
        .forEach((details) => {
          if (!details.contains(event.target as Node)) details.open = false
        })
    }
    document.addEventListener("pointerdown", close)
    return () => document.removeEventListener("pointerdown", close)
  }, [])
  useEffect(() => {
    const previousTitle = document.title
    document.title = "A2UI Playground · Digital Agency Design"
    return () => {
      document.title = previousTitle
    }
  }, [])
  useEffect(() => {
    try {
      if (!workspace || !current) {
        localStorage.removeItem(SESSION_KEY)
        return
      }
      const text = JSON.stringify({
        current,
        source,
        chat: chat.slice(-12),
        prompt,
        editorBase,
      })
      if (text.length <= 600_000) localStorage.setItem(SESSION_KEY, text)
    } catch {
      /* Storage may be disabled or full; the active session still works. */
    }
  }, [workspace, current, source, chat, prompt, editorBase])
  useEffect(() => {
    try {
      localStorage.setItem("a2ui-playground-theme", dark ? "dark" : "light")
    } catch {
      /* Preference storage is optional. */
    }
  }, [dark])
  useEffect(() => {
    if (!codex.busy) return
    const start = Date.now()
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000
    )
    return () => clearInterval(timer)
  }, [codex.busy])
  useEffect(() => {
    conversationEnd.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "end",
    })
  }, [chat, codex.busy])
  useEffect(() => {
    streamEnd.current?.scrollIntoView?.({ block: "end" })
  }, [codex.stream])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(""), 2800)
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => {
    if (help) helpDialog.current?.showModal()
    else if (helpDialog.current?.open) helpDialog.current.close()
  }, [help])

  const loadSample = (index = 0, edit = false) => {
    codex.reset()
    setQueued(null)
    setOutputOpen(true)
    const example = playgroundExamples[index]
    const next = JSON.stringify(example.messages, null, 2)
    const version = {
      id: ++serial.current,
      source: next,
      prompt: example.prompt,
      live: false,
    }
    setWorkspace(true)
    setCurrent(version)
    setSource(next)
    setEditorBase(next)
    setEditorChoice(String(index))
    setEditorError("")
    setEvents([])
    setTab(edit ? "json" : "preview")
    setChat(
      edit
        ? []
        : [
            {
              id: ++serial.current,
              role: "assistant" as const,
              text: `「${example.title}」のサンプルを開きました。入力やJSON編集を試せます。追加の依頼を送ると、${providerLabel}がこの画面を作り変えます。`,
              version,
            },
          ]
    )
    setPrompt("")
  }

  const sendPrompt = useCallback(
    (text: string) => {
      const message = text.trim()
      if (!message || !connected) return
      if (generating) {
        setQueued(message)
        setPrompt("")
        return
      }
      // Ask always sends the latest edit, even before the debounce has elapsed.
      let previous: unknown[] | undefined
      try {
        previous = current
          ? validateCompleteScreen(
              JSON.parse(tab === "json" ? source : current.source)
            )
          : undefined
      } catch (error) {
        setEditorError(error instanceof Error ? error.message : String(error))
        return
      }
      pending.current = { prompt: message, label: "" }
      setElapsed(0)
      setWorkspace(true)
      setOutputOpen(true)
      setPrompt("")
      setTab("preview")
      setChat((previous) =>
        [
          ...previous,
          { id: ++serial.current, role: "user" as const, text: message },
        ].slice(-40)
      )
      void generate(
        message,
        previous,
        undefined,
        surface.current?.getDataModel()
      )
    },
    [connected, generating, generate, current, source, tab]
  )

  useEffect(() => {
    if (generating || !queued) return
    const timer = setTimeout(() => {
      setQueued(null)
      sendPrompt(queued)
    }, 0)
    return () => clearTimeout(timer)
  }, [generating, queued, sendPrompt])

  // Match the reference editor: broken input keeps the last good preview;
  // whitespace changes do not recreate the surface or erase entered values.
  useEffect(() => {
    if (tab !== "json" || codex.busy || !source) return
    const timer = setTimeout(() => {
      try {
        const messages = validateCompleteScreen(JSON.parse(source))
        const fingerprint = JSON.stringify(messages)
        setCurrent((previous) => {
          if (
            previous &&
            JSON.stringify(JSON.parse(previous.source)) === fingerprint
          )
            return previous
          return {
            id: ++serial.current,
            source: JSON.stringify(messages, null, 2),
            prompt: previous?.prompt || "",
            live: false,
          }
        })
        setEditorError("")
      } catch (error) {
        setEditorError(error instanceof Error ? error.message : String(error))
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [source, tab, codex.busy])

  const onSurfaceAction = (event: ScreenAction) => {
    setEvents((previous) => [...previous, event.action].slice(-50))
    if (!current?.live || !connected || codex.busy) return
    const label = `「${event.action.name}」を操作しました`
    pending.current = { prompt: current.prompt, label }
    setElapsed(0)
    setChat((previous) =>
      [
        ...previous,
        { id: ++serial.current, role: "user" as const, text: label },
      ].slice(-40)
    )
    void codex.generate(
      current.prompt,
      JSON.parse(current.source) as unknown[],
      event
    )
  }

  const newChat = () => {
    codex.reset()
    setQueued(null)
    setOutputOpen(true)
    setWorkspace(false)
    setCurrent(null)
    setSource("")
    setChat([])
    setEvents([])
    setEditorError("")
    setPrompt("")
    setTab("preview")
    setSidebar(true)
  }

  const applyJson = () => {
    try {
      const messages = validateCompleteScreen(JSON.parse(source))
      const next = JSON.stringify(messages, null, 2)
      const version = {
        id: ++serial.current,
        source: next,
        prompt: current?.prompt || "",
        live: false,
      }
      setCurrent(version)
      setSource(next)
      setEditorError("")
      setChat((previous) =>
        [
          ...previous,
          {
            id: ++serial.current,
            role: "assistant" as const,
            text: "JSONの変更を反映しました。",
            version,
          },
        ].slice(-40)
      )
      setToast("JSONを反映しました")
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error))
    }
  }

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(source)
      setToast("JSONをコピーしました")
    } catch {
      setToast(
        "コピーできませんでした。JSONタブから選択してコピーしてください。"
      )
    }
  }
  const exportJson = () => {
    const url = URL.createObjectURL(
      new Blob([source], { type: "application/json" })
    )
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "a2ui-screen.json"
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setToast("JSONを書き出しました")
  }
  const restoreVersion = (version: Version) => {
    if (codex.busy) return
    setCurrent(version)
    setSource(version.source)
    setEditorBase(version.source)
    setEditorChoice("current")
    setEditorError("")
    setTab("preview")
  }
  const onComposerKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      event.keyCode !== 229
    ) {
      event.preventDefault()
      sendPrompt(prompt)
    }
  }

  const onStarterMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const text = event.currentTarget.dataset.prompt ?? ""
    event.currentTarget.closest("details")?.removeAttribute("open")
    if (connected) sendPrompt(text)
    else {
      setPrompt(text)
      composer.current?.focus()
    }
  }

  const composerView = (
    <form
      className="pg-composer"
      aria-label="画面を依頼"
      onSubmit={(event: FormEvent) => {
        event.preventDefault()
        sendPrompt(prompt)
      }}
    >
      <label className="pg-sr-only" htmlFor="a2ui-prompt">
        つくりたい画面や、変更したいこと
      </label>
      <textarea
        ref={composer}
        id="a2ui-prompt"
        placeholder={"Ask for a UI, like a map of ramen spots in Osaka"}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={onComposerKey}
        maxLength={4000}
        rows={workspace ? 3 : 2}
      />
      {queued && (
        <div className="pg-queued" role="status">
          <span>
            次の依頼：{queued}
            <small>この回答が終わると送信します。</small>
          </span>
          <button
            type="button"
            onClick={() => {
              setPrompt(queued)
              setQueued(null)
              composer.current?.focus()
            }}
          >
            予約を取り消す
          </button>
        </div>
      )}
      <div className="pg-composer-toolbar">
        <details
          className="pg-design-menu"
          onToggle={(event) => {
            if (event.currentTarget.open) setMenuSection("home")
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.removeAttribute("open")
              event.currentTarget.querySelector("summary")?.focus()
            }
            if (
              ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
              event.currentTarget.open
            ) {
              event.preventDefault()
              const buttons = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  'button[role="menuitem"]'
                ),
              ]
              const current = buttons.indexOf(
                document.activeElement as HTMLButtonElement
              )
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : (current +
                        (event.key === "ArrowUp" ? -1 : 1) +
                        buttons.length) %
                      buttons.length
              buttons[next]?.focus()
            }
          }}
        >
          <summary
            aria-label="Design: components, format, starters and more"
            aria-haspopup="menu"
          >
            <Blocks size={14} />
            <span>
              Design <span className="pg-muted">·</span> デジタル庁
            </span>
            <ChevronDown size={12} />
          </summary>
          <div
            className="pg-popover pg-design-popover"
            role="menu"
            aria-label="Design"
          >
            {menuSection === "home" ? (
              <>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setMenuSection("design")}
                >
                  <Blocks size={14} />
                  <span>Design system</span>
                  <small>デジタル庁</small>
                  <ChevronRight size={13} />
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setMenuSection("format")}
                >
                  <Braces size={14} />
                  <span>Format</span>
                  <small>JSON</small>
                  <ChevronRight size={13} />
                </button>
                <hr />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setMenuSection("starters")}
                >
                  <Sparkles size={14} />
                  <span>Try a prompt</span>
                  <ChevronRight size={13} />
                </button>
              </>
            ) : (
              <>
                <button
                  className="pg-menu-back"
                  type="button"
                  role="menuitem"
                  onClick={() => setMenuSection("home")}
                >
                  <ChevronLeft size={14} />
                  <span>
                    {menuSection === "design"
                      ? "Design system"
                      : menuSection === "format"
                        ? "Format"
                        : "Try a prompt"}
                  </span>
                </button>
                <hr />
                {menuSection === "design" && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                      composer.current?.focus()
                    }}
                  >
                    <Blocks size={14} />
                    <span>
                      デジタル庁<small>Digital Agency · 非公式</small>
                    </span>
                    <Check size={14} />
                  </button>
                )}
                {menuSection === "format" && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={(event) => {
                      event.currentTarget
                        .closest("details")
                        ?.removeAttribute("open")
                      composer.current?.focus()
                    }}
                  >
                    <Braces size={14} />
                    <span>
                      A2UI JSON<small>Open protocol · v1.0</small>
                    </span>
                    <Check size={14} />
                  </button>
                )}
                {menuSection === "starters" &&
                  [
                    ...referenceStarters,
                    ...playgroundExamples
                      .slice(1)
                      .map((example) => example.prompt),
                  ].map((text) => (
                    <button
                      type="button"
                      role="menuitem"
                      key={text}
                      data-prompt={text}
                      onClick={onStarterMenuClick}
                    >
                      <span>{text}</span>
                    </button>
                  ))}
              </>
            )}
          </div>
        </details>
        <div className="pg-composer-actions">
          <details className="pg-model-menu">
            <summary className="pg-model" title={providerDescription}>
              <Sparkles size={13} />
              {providerLabel}
              <span className={`pg-dot ${connected ? "is-connected" : ""}`} />
              <ChevronDown size={12} />
            </summary>
            <div className="pg-popover">
              <strong>
                <Check size={12} /> {providerLabel}
              </strong>
              <p>{providerDescription}</p>
            </div>
          </details>
          {codex.busy ? (
            <button
              className="pg-send is-stopping"
              type="button"
              onClick={codex.cancel}
              aria-label="生成を中止"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              className="pg-send"
              type="submit"
              disabled={!connected || !prompt.trim()}
              aria-label="画面を生成"
            >
              <ArrowUp size={19} />
            </button>
          )}
        </div>
      </div>
    </form>
  )

  return (
    <div
      className={`a2ui-playground ${dark ? "pg-dark" : ""} ${workspace ? "has-workspace" : ""}`}
    >
      <a className="pg-skip-link" href="#playground-main">
        本文へスキップ
      </a>
      <header className="pg-header">
        <div className="pg-header-inner">
          <button
            className="pg-brand"
            onClick={newChat}
            aria-label="A2UI Playground ホーム"
          >
            <span className="pg-brand-mark">
              <img src={a2uiMark} alt="" width="36" height="36" />
            </span>
            <span>
              <strong>A2UI Playground</strong>
              <small>
                by {providerLabel}{" "}
                <span>{publicAi ? "Cloudflare" : "local"}</span>
              </small>
            </span>
          </button>
          <nav className="pg-nav" aria-label="メインナビゲーション">
            <button className="is-active" onClick={newChat}>
              Playground
            </button>
            <button onClick={() => setHelp(true)}>Get started</button>
            <a href="/">Components</a>
          </nav>
          <div className="pg-header-actions">
            <a
              className="pg-icon-button pg-github"
              href="https://github.com/videoq-jp/shadcn-digital-agency-jp"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHubでソースを見る"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.49c-2.23.49-2.7-.95-2.7-.95-.36-.92-.89-1.17-.89-1.17-.73-.5.06-.49.06-.49.8.06 1.22.82 1.22.82.71 1.22 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.96 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 018 3.84c.68 0 1.36.09 2 .27 1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.08-1.87 3.75-3.65 3.95.29.25.55.74.55 1.49v2.21c0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
            <button
              className="pg-icon-button"
              onClick={() => setDark((value) => !value)}
              aria-label={
                dark ? "ライトテーマに切り替え" : "ダークテーマに切り替え"
              }
            >
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </div>
      </header>

      {!workspace ? (
        <main id="playground-main" className="pg-landing">
          <div className="pg-hero">
            <span className="pg-eyebrow">
              <span className="pg-tiny-mark" /> YOUR DESIGN SYSTEM. YOUR AI.
            </span>
            <h1>{"Watch an\u00a0agent write\u00a0UI."}</h1>
            <p>
              Ask for a UI. The model writes A2UI, Google's open protocol, and
              your design system draws it.
            </p>
          </div>
          <div className="pg-start-area">
            <h2 className="pg-sr-only">こんな画面から試してみる</h2>
            <div className="pg-starters">
              {playgroundExamples.map((example, index) => {
                const Icon = starterIcons[index] ?? Blocks
                return (
                  <button
                    key={example.id}
                    onClick={() => {
                      if (example.id === "all-components") loadSample(index)
                      else if (connected) sendPrompt(referenceStarters[index])
                      else loadSample(0)
                    }}
                  >
                    <span className="pg-starter-icon">
                      <Icon size={18} strokeWidth={1.6} />
                    </span>
                    <span>
                      <strong>
                        {referenceStarters[index] ?? example.title}
                      </strong>
                    </span>
                    <ArrowRight size={14} className="pg-starter-arrow" />
                  </button>
                )
              })}
            </div>
            {composerView}
            <div className="pg-start-footer">
              <span>Or</span>
              <button
                aria-label="AIを使わずに試す"
                onClick={() => loadSample(0, true)}
              >
                start without AI
              </button>
              <span>: write A2UI JSON by hand.</span>
            </div>
            <p className="pg-connection" role="status">
              <span className={`pg-dot ${connected ? "is-connected" : ""}`} />
              {!codex.status
                ? "AIへの接続を確認中"
                : connected
                  ? publicAi
                    ? "Cloudflare Workers AIで接続済み"
                    : "このPCのCodexログインで接続済み"
                  : "サンプルはすぐに試せます。AI生成は npm run demo:llm で起動"}
            </p>
          </div>
          <footer className="pg-landing-footer">
            <span>A2UI v1.0</span>
            <span>JSONでつながる、AIとUI。</span>
            <a href="https://a2ui.org/" target="_blank" rel="noreferrer">
              A2UIについて <ArrowRight size={11} />
            </a>
          </footer>
        </main>
      ) : (
        <main
          id="playground-main"
          className={`pg-workspace ${sidebar ? "" : "is-sidebar-collapsed"} ${outputOpen ? "" : "is-output-collapsed"} ${editorWide && tab === "json" ? "is-editor-wide" : ""}`}
          style={
            {
              ...(conversationWidth === null
                ? {}
                : { "--conversation-width": `${conversationWidth}px` }),
            } as CSSProperties
          }
        >
          <h1 className="pg-sr-only">A2UI Playground ワークスペース</h1>
          <aside className="pg-conversation" aria-label="会話">
            <div className="pg-conversation-heading">
              <span>
                <MessageSquare size={15} /> 会話
              </span>
              <button
                className="pg-icon-button"
                onClick={() => setSidebar(false)}
                aria-label="会話パネルを閉じる"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
            <div
              className="pg-messages"
              role="log"
              aria-label="生成履歴"
              aria-live="polite"
            >
              {chat.map((message) => (
                <div
                  key={message.id}
                  className={`pg-message is-${message.role}`}
                >
                  <div className="pg-message-author">
                    {message.role === "assistant" ? (
                      <>
                        <span className="pg-assistant-icon">
                          <Sparkles size={12} />
                        </span>{" "}
                        A2UI Assistant
                      </>
                    ) : (
                      "あなた"
                    )}
                  </div>
                  <p>{message.text}</p>
                  {message.version && (
                    <button
                      className={`pg-version ${current?.id === message.version.id ? "is-selected" : ""}`}
                      disabled={codex.busy}
                      onClick={() => restoreVersion(message.version!)}
                    >
                      <span className="pg-version-icon">
                        <Blocks size={17} />
                      </span>
                      <span>
                        <strong>
                          {componentCount(message.version.source)}
                          個のコンポーネント
                        </strong>
                        <small>
                          {message.elapsedMs
                            ? `${(message.elapsedMs / 1000).toFixed(1)}秒で生成`
                            : "サンプル / JSON"}
                        </small>
                      </span>
                      {current?.id === message.version.id ? (
                        <Check size={15} />
                      ) : (
                        <ArrowRight size={15} />
                      )}
                    </button>
                  )}
                </div>
              ))}
              {codex.busy && (
                <div className="pg-thinking" role="status">
                  <LoaderCircle size={14} className="pg-spin" />
                  <span>UIを組み立てています</span>
                  <span>{elapsed}秒</span>
                </div>
              )}
              {codex.error && (
                <div className="pg-chat-error" role="alert">
                  <p>{codex.error}</p>
                  <span>表示中の画面は保持しています。</span>
                  <button
                    disabled={!connected}
                    onClick={() => sendPrompt(pending.current.prompt)}
                  >
                    もう一度試す <RotateCcw size={12} />
                  </button>
                </div>
              )}
              <div id="pg-chat-preview" hidden={tab === "json"} />
              <div ref={conversationEnd} />
            </div>
            <div className="pg-conversation-bottom">
              {!chat.length && (
                <p className="pg-hint pg-sr-only">
                  つくりたい画面を教えてください。
                </p>
              )}
              {!chat.length && (
                <div className="pg-workspace-starters">
                  {[
                    referenceStarters[0],
                    "Compare three noise-cancelling headphones",
                  ].map((text) => (
                    <button
                      key={text}
                      onClick={() => {
                        setPrompt(text)
                        composer.current?.focus()
                      }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
              {composerView}
              {chat.length > 0 && (
                <button
                  className="pg-new-chat-line"
                  aria-label="新しい会話"
                  onClick={newChat}
                >
                  New chat
                </button>
              )}
              <p className="pg-composer-note">
                {codex.busy ? "Enterで次の依頼を予約" : "Enterで送信"} · Shift +
                Enterで改行
              </p>
              <p className="pg-privacy-note">
                依頼文と、操作時の入力値を{providerLabel}へ送信します。
              </p>
            </div>
          </aside>
          {sidebar && outputOpen && (
            <div
              className="pg-resizer"
              role="separator"
              tabIndex={0}
              aria-label="会話パネルの幅"
              aria-orientation="vertical"
              aria-valuemin={280}
              aria-valuemax={Math.max(280, window.innerWidth - 300)}
              aria-valuenow={
                conversationWidth ?? Math.max(280, window.innerWidth - 461)
              }
              onKeyDown={(event) => {
                const key = event.key
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(key))
                  return
                event.preventDefault()
                const measured =
                  event.currentTarget.previousElementSibling?.getBoundingClientRect()
                    .width || Math.max(280, window.innerWidth - 461)
                const maximum = Math.max(280, window.innerWidth - 300)
                setConversationWidth((value) =>
                  key === "Home"
                    ? 280
                    : key === "End"
                      ? maximum
                      : Math.max(
                          280,
                          Math.min(
                            maximum,
                            (value ?? measured) +
                              (key === "ArrowRight" ? 20 : -20)
                          )
                        )
                )
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  setConversationWidth(
                    Math.max(
                      280,
                      Math.min(window.innerWidth - 300, event.clientX)
                    )
                  )
              }}
              onPointerUp={(event) =>
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
            />
          )}
          {!outputOpen && (
            <button
              className="pg-reopen-output"
              onClick={() => setOutputOpen(true)}
            >
              <Code2 size={16} /> 結果パネルを開く
            </button>
          )}
          <section
            className={`pg-output ${tab === "json" ? "is-hand-editing" : ""}`}
            aria-label="生成結果"
            hidden={!outputOpen}
          >
            <div className="pg-pane-heading">
              <strong>
                {tab === "json"
                  ? "Editing by hand"
                  : `${providerLabel} ${generating ? "writes" : "wrote"}`}
              </strong>
              <span>A2UI JSON</span>
              {tab === "json" && (
                <button onClick={() => setTab("preview")}>Done</button>
              )}
              <button
                className="pg-icon-button"
                aria-label="結果パネルを閉じる"
                onClick={() => setOutputOpen(false)}
              >
                <PanelLeftClose size={15} />
              </button>
            </div>
            <div className="pg-output-toolbar">
              <div className="pg-output-left">
                {!sidebar && (
                  <button
                    className="pg-icon-button"
                    onClick={() => setSidebar(true)}
                    aria-label="会話パネルを開く"
                  >
                    <PanelLeftOpen size={16} />
                  </button>
                )}
                <div className="pg-tabs" role="tablist" aria-label="表示内容">
                  {(
                    [
                      { id: "preview", label: "JSON stream", icon: Braces },
                      { id: "code", label: "JSON", icon: Code2 },
                      { id: "events", label: "Run", icon: Braces },
                    ] as const
                  ).map((item) => (
                    <button
                      role="tab"
                      id={`tab-${item.id}`}
                      aria-controls={
                        tab === item.id ? `panel-${item.id}` : undefined
                      }
                      aria-selected={tab === item.id}
                      key={item.id}
                      onKeyDown={(event) => {
                        const order: Tab[] = ["preview", "code", "events"]
                        const offset =
                          event.key === "ArrowRight"
                            ? 1
                            : event.key === "ArrowLeft"
                              ? -1
                              : 0
                        if (
                          !offset &&
                          event.key !== "Home" &&
                          event.key !== "End"
                        )
                          return
                        event.preventDefault()
                        const next =
                          event.key === "Home"
                            ? "preview"
                            : event.key === "End"
                              ? "events"
                              : order[
                                  (order.indexOf(item.id) +
                                    offset +
                                    order.length) %
                                    order.length
                                ]
                        setTab(next)
                        document.getElementById(`tab-${next}`)?.focus()
                      }}
                      onClick={() => setTab(item.id)}
                    >
                      <item.icon size={14} />
                      <span>{item.label}</span>
                      {item.id === "events" && events.length > 0 && (
                        <span className="pg-tab-count">{events.length}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pg-output-actions">
                {tab === "json" && (
                  <>
                    <button
                      className="pg-text-button"
                      onClick={() => setTab("preview")}
                    >
                      編集を完了
                    </button>
                    <button
                      className="pg-icon-button"
                      aria-label={
                        editorWide
                          ? "エディターを狭くする"
                          : "エディターを広くする"
                      }
                      onClick={() => setEditorWide((value) => !value)}
                    >
                      {editorWide ? (
                        <Minimize2 size={15} />
                      ) : (
                        <Maximize2 size={15} />
                      )}
                    </button>
                  </>
                )}

                {tab === "preview" && (
                  <div
                    className="pg-devices"
                    role="group"
                    aria-label="プレビューの画面幅"
                  >
                    {[
                      { id: "desktop", label: "デスクトップ", icon: Monitor },
                      { id: "tablet", label: "タブレット", icon: Tablet },
                      {
                        id: "mobile",
                        label: "スマートフォン",
                        icon: Smartphone,
                      },
                    ].map((device) => (
                      <button
                        key={device.id}
                        aria-label={device.label}
                        aria-pressed={width === device.id}
                        onClick={() => setWidth(device.id)}
                      >
                        <device.icon size={15} />
                      </button>
                    ))}
                  </div>
                )}
                <button
                  className="pg-icon-button"
                  disabled={!current}
                  onClick={() => void copyJson()}
                  aria-label="JSONをコピー"
                >
                  <Copy size={15} />
                </button>
                <button
                  className="pg-icon-button"
                  disabled={!current}
                  onClick={exportJson}
                  aria-label="JSONを書き出す"
                >
                  <ArrowDownToLine size={16} />
                </button>
              </div>
            </div>
            {tab === "code" && (
              <div className="pg-read-actions">
                <button
                  className="pg-editor-action"
                  disabled={!current || generating}
                  onClick={() => setTab("json")}
                >
                  <Code2 size={12} /> Edit
                </button>
                <span> A2UI operations</span>
                <button
                  className="pg-editor-action"
                  onClick={() => void copyJson()}
                >
                  <Copy size={12} /> Copy
                </button>
                <button className="pg-editor-action" onClick={exportJson}>
                  Export
                </button>
              </div>
            )}
            <div className="pg-output-info">
              <span>
                <span
                  className={`pg-dot ${codex.busy ? "is-working" : current ? "is-connected" : ""}`}
                />
                {codex.busy
                  ? "生成中"
                  : current?.live
                    ? `Live · ${providerLabel}`
                    : tab === "json"
                      ? "Editing by hand · Live, no model"
                      : "Live · サンプル"}
              </span>
              <span>
                A2UI v1.0 <span className="pg-info-separator">/</span>{" "}
                {current
                  ? `${componentCount(current.source)} components`
                  : "Waiting for your UI"}
              </span>
            </div>
            {tab === "events" && (
              <div
                id="panel-events"
                role="tabpanel"
                aria-labelledby="tab-events"
                className="pg-events-panel"
              >
                <div className="pg-run-summary">
                  <h2>Run</h2>
                  <dl>
                    <div>
                      <dt>Model</dt>
                      <dd>{providerLabel}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        {generating
                          ? "Running"
                          : codex.error
                            ? "Stopped / failed"
                            : current?.live
                              ? "Completed"
                              : "No model"}
                      </dd>
                    </div>
                    {codex.result && (
                      <>
                        <div>
                          <dt>Duration</dt>
                          <dd>{(codex.result.elapsedMs / 1000).toFixed(1)}s</dd>
                        </div>
                        <div>
                          <dt>Attempts</dt>
                          <dd>{codex.result.attempts}</dd>
                        </div>
                      </>
                    )}
                  </dl>
                </div>
                {events.length ? (
                  <>
                    <div className="pg-event-heading">
                      <h2>画面からの操作イベント</h2>
                      <button
                        className="pg-text-button"
                        onClick={() => setEvents([])}
                      >
                        履歴をクリア
                      </button>
                    </div>
                    {events.map((event, index) => (
                      <details
                        key={index}
                        className="pg-event"
                        open={index === events.length - 1}
                      >
                        <summary>
                          <Send size={13} />
                          <strong>{event.name}</strong>
                          <span>
                            {new Date(event.timestamp).toLocaleTimeString(
                              "ja-JP"
                            )}
                          </span>
                        </summary>
                        <pre>{JSON.stringify(event, null, 2)}</pre>
                      </details>
                    ))}
                  </>
                ) : (
                  <div className="pg-empty-state">
                    <Braces size={30} strokeWidth={1.3} />
                    <h2>操作が、ここに届きます。</h2>
                    <p>
                      プレビューのボタンを押すと、
                      <br />
                      現在の入力値を含むイベントを確認できます。
                    </p>
                  </div>
                )}
              </div>
            )}
            <div
              hidden={tab === "events"}
              id={`panel-${tab === "events" ? "preview" : tab}`}
              role="tabpanel"
              aria-labelledby={`tab-${tab === "events" ? "preview" : tab}`}
              className={`pg-canvas-panel ${tab !== "events" ? "has-editor" : ""}`}
            >
              {(tab === "stream" || tab === "preview" || tab === "code") && (
                <section
                  className="pg-editor pg-stream-editor"
                  aria-label={`${providerLabel}の生成ストリーム`}
                >
                  <div className="pg-editor-heading">
                    <span>
                      <Braces size={13} /> {providerLabel}{" "}
                      {generating ? "writes" : "wrote"} · A2UI JSON
                    </span>
                    <span>
                      {generating && codex.attempt > 1
                        ? `修正 ${codex.attempt}回目`
                        : ""}
                    </span>
                  </div>
                  <div className="pg-stream-code">
                    <pre>
                      <HighlightedJson
                        source={
                          generating
                            ? codex.stream ||
                              `${providerLabel}の出力を待っています…`
                            : current?.source || ""
                        }
                      />
                    </pre>
                    <div ref={streamEnd} />
                  </div>
                  <div className="pg-editor-footer">
                    <span role="status">
                      {generating
                        ? `${codex.stream.length.toLocaleString()}文字を受信 · ${elapsed}秒`
                        : codex.error
                          ? "生成に失敗しました"
                          : current
                            ? "生成完了 · 検証済み"
                            : "生成を待っています"}
                    </span>
                    <button
                      className="pg-text-button"
                      disabled={generating || !current}
                      onClick={() => setTab("json")}
                    >
                      JSONを編集 <ArrowRight size={12} />
                    </button>
                  </div>
                </section>
              )}
              {tab === "json" && (
                <section className="pg-editor" aria-label="JSONエディター">
                  <div className="pg-editor-heading">
                    <select
                      aria-label="編集する画面"
                      value={editorChoice}
                      onChange={(event) => {
                        const value = event.target.value
                        setEditorChoice(value)
                        const text =
                          value === "current"
                            ? current?.source || ""
                            : JSON.stringify(
                                playgroundExamples[Number(value)].messages,
                                null,
                                2
                              )
                        setEditorBase(text)
                        setSource(text)
                        setEditorError("")
                        setCaret(0)
                      }}
                    >
                      <option value="current">現在の画面</option>
                      <optgroup label="サンプル">
                        {playgroundExamples.map((example, index) => (
                          <option key={example.id} value={index}>
                            {example.title}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <button
                      className="pg-text-button"
                      disabled={codex.busy || !current || source === editorBase}
                      onClick={() => {
                        setSource(editorBase)
                        setEditorError("")
                      }}
                    >
                      <RotateCcw size={12} />
                      <span aria-hidden="true">Reset</span>
                      <span className="pg-sr-only">リセット</span>
                    </button>
                    <button
                      className="pg-editor-action"
                      onClick={() => void copyJson()}
                    >
                      <Copy size={12} /> Copy
                    </button>
                    <button className="pg-editor-action" onClick={exportJson}>
                      Export
                    </button>
                    <button
                      className="pg-editor-action"
                      aria-label={
                        editorWide
                          ? "エディターを狭くする"
                          : "エディターを広くする"
                      }
                      onClick={() => setEditorWide((value) => !value)}
                    >
                      {editorWide ? (
                        <Minimize2 size={12} />
                      ) : (
                        <Maximize2 size={12} />
                      )}
                    </button>
                  </div>
                  <div className="pg-editor-body">
                    <pre
                      ref={jsonLines}
                      aria-hidden="true"
                      className="pg-line-numbers"
                    >
                      {source
                        .split("\n")
                        .map((_, index) => index + 1)
                        .join("\n")}
                    </pre>
                    <div className="pg-code-input">
                      <pre
                        ref={jsonHighlight}
                        className="pg-code-highlight"
                        aria-hidden="true"
                      >
                        <HighlightedJson source={source} />
                      </pre>
                      <label htmlFor="a2ui-json" className="pg-sr-only">
                        画面のJSON
                      </label>
                      <textarea
                        id="a2ui-json"
                        value={source}
                        onChange={(event) => {
                          setSource(event.target.value)
                          setEditorError("")
                        }}
                        onSelect={(event) =>
                          setCaret(event.currentTarget.selectionStart)
                        }
                        onScroll={(event) => {
                          if (jsonHighlight.current) {
                            jsonHighlight.current.scrollTop =
                              event.currentTarget.scrollTop
                            jsonHighlight.current.scrollLeft =
                              event.currentTarget.scrollLeft
                          }
                          if (jsonLines.current)
                            jsonLines.current.scrollTop =
                              event.currentTarget.scrollTop
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Escape")
                            editorEscape.current = true
                          if (event.key === "Tab" && editorEscape.current) {
                            editorEscape.current = false
                            return
                          }
                          if (event.key === "Tab" && !event.shiftKey) {
                            event.preventDefault()
                            const input = event.currentTarget
                            const start = input.selectionStart
                            const next =
                              source.slice(0, start) +
                              "  " +
                              source.slice(input.selectionEnd)
                            setSource(next)
                            requestAnimationFrame(() =>
                              input.setSelectionRange(start + 2, start + 2)
                            )
                          }
                          if (
                            (event.metaKey || event.ctrlKey) &&
                            event.key === "Enter"
                          ) {
                            event.preventDefault()
                            applyJson()
                          }
                        }}
                        spellCheck={false}
                        wrap="off"
                        aria-invalid={Boolean(editorError)}
                        aria-describedby={
                          editorError
                            ? "pg-json-error pg-editor-keyboard-help"
                            : "pg-editor-keyboard-help"
                        }
                        disabled={codex.busy}
                      />
                    </div>
                  </div>
                  <span id="pg-editor-keyboard-help" className="pg-sr-only">
                    Tabで2文字分インデントします。Escの後にTabでエディターから移動できます。
                  </span>
                  {editorError && (
                    <pre
                      id="pg-json-error"
                      className="pg-editor-error"
                      role="alert"
                    >
                      {editorError}
                    </pre>
                  )}
                  <div className="pg-editor-footer">
                    <span>
                      Ln {source.slice(0, caret).split("\n").length}, Col{" "}
                      {caret - source.lastIndexOf("\n", caret - 1)} ·{" "}
                      {componentCount(current?.source || "")} components
                    </span>
                    <span role="status">
                      {editorError ? (
                        "エラーがあります"
                      ) : current?.source === source ? (
                        <>
                          <CheckCircle2 size={12} />
                          有効 · ライブプレビュー
                        </>
                      ) : (
                        "検証中…"
                      )}
                    </span>
                    <button
                      className="pg-small-primary"
                      disabled={
                        codex.busy || !source || source === current?.source
                      }
                      onClick={applyJson}
                    >
                      変更を反映
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </section>
              )}
              <div
                id="pg-editor-preview"
                className="pg-editor-preview"
                hidden={tab !== "json"}
              />
            </div>
            {tab === "json" && (
              <form
                className="pg-ask-model"
                aria-label="編集した画面をAIで修正"
                onSubmit={(event) => {
                  event.preventDefault()
                  sendPrompt(ask)
                  setAsk("")
                }}
              >
                <div>
                  <input
                    aria-label="この画面の変更をAIに依頼"
                    placeholder="この画面の変更をAIに依頼（例：見出しを変更して）"
                    value={ask}
                    onChange={(event) => setAsk(event.target.value)}
                    maxLength={4000}
                  />
                  <button
                    type="submit"
                    disabled={!connected || !ask.trim() || Boolean(editorError)}
                  >
                    <Sparkles size={14} /> 依頼する
                  </button>
                </div>
                <p>
                  編集中の画面を会話に引き継ぎ、{providerLabel}
                  が変更を反映します。
                </p>
              </form>
            )}
          </section>
          {createPortal(
            <div className={`pg-canvas pg-width-${width}`}>
              <div className="pg-preview-label">
                <span>
                  Preview{" "}
                  <small>
                    {editorChoice === "current"
                      ? "generated"
                      : "starter-dashboard"}
                  </small>
                </span>
                <span>
                  <span className="pg-dot is-connected" />{" "}
                  {current?.live ? `Live · ${providerLabel}` : "Live, no model"}
                </span>
              </div>
              <div className="pg-document">
                {streamingSource || current ? (
                  <PlaygroundSurface
                    key={
                      streamingSource ? `stream-${codex.attempt}` : current!.id
                    }
                    ref={surface}
                    source={streamingSource || current!.source}
                    busy={codex.busy}
                    live={streamingSource ? false : current!.live}
                    onAction={onSurfaceAction}
                  />
                ) : (
                  <div className="pg-generating">
                    <span className="pg-generating-icon">
                      <Blocks size={27} strokeWidth={1.4} />
                    </span>
                    <h2>あなたのUIを、組み立てています。</h2>
                    <p>
                      {providerLabel}が依頼に合うコンポーネントを選んでいます。
                    </p>
                    <div className="pg-skeleton" aria-hidden="true">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </div>
              <div className="pg-preview-bottom">
                <span>
                  <CheckCircle2 size={12} /> Native React components
                </span>
                <span>Powered by A2UI</span>
              </div>
            </div>,
            previewHost
          )}
        </main>
      )}
      {toast && (
        <div role="status" className="pg-toast">
          <CheckCircle2 size={15} />
          {toast}
        </div>
      )}
      <dialog
        ref={helpDialog}
        className="pg-help"
        onCancel={() => setHelp(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setHelp(false)
        }}
        aria-labelledby="pg-help-title"
      >
        <div>
          <button
            className="pg-icon-button pg-help-close"
            onClick={() => setHelp(false)}
            aria-label="使い方を閉じる"
          >
            <X size={18} />
          </button>
          <span className="pg-eyebrow">QUICK START</span>
          <h2 id="pg-help-title">アイデアを、画面に。</h2>
          <p className="pg-attribution">
            Based on{" "}
            <a href="https://a2ui.open.bot/" target="_blank" rel="noreferrer">
              A2UI Playground by CopilotKit
            </a>{" "}
            · <a href={copilotkitLicense}>MIT license</a> ·{" "}
            <a href={geistLicense}>Geist font license</a>
          </p>
          <ol>
            <li>
              <strong>つくりたい画面を伝える</strong>
              <p>サンプル候補を選ぶか、自由に依頼文を入力します。</p>
            </li>
            <li>
              <strong>プレビューで操作する</strong>
              <p>
                入力欄やボタンは実際に動きます。AIで生成した画面のボタン操作には、
                {providerLabel}が応答します。
              </p>
            </li>
            <li>
              <strong>会話で、さらによくする</strong>
              <p>
                「入力欄を追加して」など、追加の依頼で画面を更新できます。JSONの編集・コピー・書き出しも可能です。
              </p>
            </li>
          </ol>
          <p className="pg-help-note">
            {publicAi ? (
              "公開版はCloudflare Workers AIで生成します。依頼文と画面の入力内容がCloudflareへ送信されます。"
            ) : (
              <>
                AI生成には、このPCのCodexログインと{" "}
                <code>npm run demo:llm</code> が必要です。
              </>
            )}{" "}
            実際の申請・予約は行いません。
          </p>
          <a href="https://a2ui.org/" target="_blank" rel="noreferrer">
            A2UI公式ドキュメント
            <ArrowRight size={13} />
          </a>
        </div>
      </dialog>
    </div>
  )
}
