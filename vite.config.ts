import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import { codexA2uiPlugin } from "./scripts/a2ui/plugin"

export default defineConfig({
  plugins: [react(), tailwindcss(), codexA2uiPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
})
