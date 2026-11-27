// @vitest-environment node
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runCodexStream } from "../../scripts/a2ui/codex-stream"

it("handshakes over stdio, requests ephemeral read-only structured output, and forwards only agent text", async () => {
  const directory = await mkdtemp(join(tmpdir(), "a2ui-fake-cli-"))
  const path = join(directory, "codex")
  await writeFile(
    path,
    `#!${process.execPath}\nconst rl=require('node:readline').createInterface({input:process.stdin});const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');rl.on('line',line=>{const x=JSON.parse(line);if(x.method==='initialize')send({id:x.id,result:{}});if(x.method==='thread/start'){if(x.params.ephemeral!==true||x.params.sandbox!=='read-only'||x.params.approvalPolicy!=='never')process.exit(2);send({id:x.id,result:{thread:{id:'thread'}}})}if(x.method==='turn/start'){if(!x.params.outputSchema||x.params.input[0].text!=='screen prompt')process.exit(3);send({id:x.id,result:{turn:{id:'turn'}}});send({method:'item/reasoning/textDelta',params:{threadId:'thread',delta:'private'}});for(const delta of ['{"messagesJson":','"[]"}'])send({method:'item/agentMessage/delta',params:{threadId:'thread',turnId:'turn',delta}});send({method:'item/completed',params:{threadId:'thread',item:{type:'agentMessage',text:'{"messagesJson":"[]"}'}}});send({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}})}});`,
    { mode: 0o700 }
  )
  vi.stubEnv("A2UI_CODEX_BIN", path)
  try {
    const deltas: string[] = []
    expect(
      await runCodexStream(
        "screen prompt",
        new AbortController().signal,
        (delta) => deltas.push(delta)
      )
    ).toBe('{"messagesJson":"[]"}')
    expect(deltas.join("")).toBe('{"messagesJson":"[]"}')
  } finally {
    vi.unstubAllEnvs()
    await rm(directory, { recursive: true, force: true })
  }
})

it("rejects canceled runs before starting a subprocess", async () => {
  const controller = new AbortController()
  controller.abort(new Error("canceled"))
  await expect(runCodexStream("x", controller.signal)).rejects.toThrow(
    "canceled"
  )
})
