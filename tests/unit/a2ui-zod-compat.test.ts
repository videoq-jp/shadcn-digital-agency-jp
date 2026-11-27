import { z } from "zod/v3"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"

// Both module entry points are used by SDK packages. Oversized collections
// must fail before traversing items, regardless of sync/async parsing.
const require = createRequire(import.meta.url)
const cjs = require("zod/v3").z as typeof z
for (const [name, api] of [
  ["ESM", z],
  ["CJS", cjs],
] as const) {
  describe(`bounded A2UI Zod compatibility (${name})`, () => {
    it("rejects oversized arrays before validating any elements", () => {
      let visited = 0
      const child = api.string().superRefine(() => {
        visited++
      })
      const result = api
        .array(child)
        .max(3)
        .safeParse(Array(10000).fill("item"))
      expect(result.success).toBe(false)
      expect(visited).toBe(0)
      if (!result.success) expect(result.error.issues).toHaveLength(1)
    })
    it("rejects oversized sets before validating elements asynchronously", async () => {
      let visited = 0
      const child = api.string().superRefine(async () => {
        visited++
      })
      const result = await api
        .set(child)
        .max(2)
        .safeParseAsync(new Set(["a", "b", "c"]))
      expect(result.success).toBe(false)
      expect(visited).toBe(0)
    })
    it("still validates values within the bounds", () => {
      expect(api.array(api.string()).max(3).parse(["a", "b"])).toEqual([
        "a",
        "b",
      ])
      expect(api.array(api.number()).max(3).safeParse(["a"]).success).toBe(
        false
      )
    })
  })
}
it("uses the audited Zod release while keeping the SDK's legacy API", () => {
  const pkg = JSON.parse(
    readFileSync(require.resolve("zod/package.json"), "utf8")
  )
  expect(pkg.version).toBe("4.6.7")
})
