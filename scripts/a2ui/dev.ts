import { createServer } from "vite"

process.env.A2UI_CODEX_ENABLED = "1"
const server = await createServer({
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
})
await server.listen()
server.printUrls()
console.log("Codexログインを使うA2UIデモ: http://127.0.0.1:5173/a2ui")
