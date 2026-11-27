import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { format } from "prettier"
import { digitalAgencyCatalog } from "../src/lib/a2ui/catalog"

const output = fileURLToPath(
  new URL("../src/lib/a2ui/catalog.json", import.meta.url)
)
const json = await format(JSON.stringify(digitalAgencyCatalog.toJson()), {
  parser: "json",
})
if (process.argv.includes("--check")) {
  if (readFileSync(output, "utf8") !== json) {
    throw new Error("A2UI catalog is stale. Run npm run a2ui:generate.")
  }
  console.log("A2UI catalog is up to date.")
} else {
  writeFileSync(output, json)
  console.log("Wrote src/lib/a2ui/catalog.json")
}
