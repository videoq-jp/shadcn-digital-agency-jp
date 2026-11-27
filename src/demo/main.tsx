import { lazy, StrictMode, Suspense } from "react"
import { createRoot } from "react-dom/client"

import App from "./App"
import "../styles/globals.css"

const A2uiDemo = lazy(() => import("./A2uiDemo"))

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/^\/a2ui\/?$/.test(window.location.pathname) ? (
      <Suspense fallback={<p role="status">A2UIを読み込んでいます…</p>}>
        <A2uiDemo />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>
)
