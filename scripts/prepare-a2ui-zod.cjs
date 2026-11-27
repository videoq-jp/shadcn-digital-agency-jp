// A2UI 0.16.1 uses Zod 3 APIs. Keep the audited Zod 4 package and use its
// official /v3 compatibility export until A2UI migrates its serializer.
// Also backport fail-fast checks for oversized v3 arrays/sets: the v3 code
// bundled in Zod 4 still otherwise traverses every rejected collection item.
const fs = require("node:fs")
const path = require("node:path")
const assert = require("node:assert/strict")
const root = path.join(__dirname, "..", "node_modules")
function walk(dir, visit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file, visit)
    else visit(file)
  }
}
let imports = 0
for (const pkg of ["react", "web_core", "markdown-it"]) {
  const dir = path.join(root, "@a2ui", pkg)
  const version = JSON.parse(
    fs.readFileSync(path.join(dir, "package.json"))
  ).version
  assert.equal(
    version,
    pkg === "markdown-it" ? "0.2.4" : "0.16.1",
    `Review Zod compatibility patch for @a2ui/${pkg}@${version}`
  )
  walk(dir, (file) => {
    if (!/\.(?:[cm]?js|[cm]?ts)$/.test(file)) return
    const source = fs.readFileSync(file, "utf8")
    const patched = source.replace(
      /(from\s*|require\(\s*)(["'])zod\2/g,
      (_, prefix, quote) => `${prefix}${quote}zod/v3${quote}`
    )
    if (source !== patched) {
      fs.writeFileSync(file, patched)
      imports++
    }
  })
}
const zodDir = path.join(root, "zod")
const version = JSON.parse(
  fs.readFileSync(path.join(zodDir, "package.json"))
).version
assert.equal(
  version,
  "4.6.7",
  "Review the legacy collection backport when upgrading Zod"
)
for (const name of ["types.js", "types.cjs"]) {
  const file = path.join(zodDir, "v3", name)
  let source = fs.readFileSync(file, "utf8")
  // The maxLength/maxSize branches already append the size issue. Abort there
  // instead of allocating child issues for a collection known to be invalid.
  for (const field of ["maxLength", "maxSize"]) {
    const marker = `/* a2ui-bounded-${field} */`
    if (source.includes(marker)) continue
    const pattern = new RegExp(
      `(if \\(def\\.${field} !== null\\) \\{[\\s\\S]*?)(status\\.dirty\\(\\);)`
    )
    assert.match(source, pattern, `Missing Zod ${field} guard in ${name}`)
    source = source.replace(
      pattern,
      `$1$2 return { status: "aborted" }; ${marker}`
    )
  }
  fs.writeFileSync(file, source)
}
console.log(
  `Prepared A2UI Zod v3 compatibility and collection bounds (${imports} import files updated).`
)
