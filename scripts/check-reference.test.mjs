import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const CHECK = join(RAIZ, 'scripts/check-reference.mjs')

/** Uma raiz descartável: o plugin (sem os testes pesados) e os documentos. */
function copia() {
  const base = mkdtempSync(join(tmpdir(), 'aidlc-ref-'))
  cpSync(join(RAIZ, 'plugins'), join(base, 'plugins'), { recursive: true })
  cpSync(join(RAIZ, 'docs'), join(base, 'docs'), { recursive: true })
  for (const f of ['README.md', 'CONTRIBUTING.md', 'AGENTS.md', 'OPERATING-MODEL.md']) cpSync(join(RAIZ, f), join(base, f))
  return base
}
const roda = (base) => spawnSync(process.execPath, [CHECK, '--root', base], { encoding: 'utf8' })
const edita = (base, arquivo, fn) => {
  const p = join(base, arquivo)
  writeFileSync(p, fn(readFileSync(p, 'utf8')))
}

describe('check-reference', () => {
  test('o repositório passa', () => {
    const r = spawnSync(process.execPath, [CHECK], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('uma cópia intacta passa (a base dos mutantes é válida)', () => {
    const base = copia()
    const r = roda(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('mutante: hook novo no disco sem entrada na referência reprova', () => {
    const base = copia()
    writeFileSync(join(base, 'plugins/aidlc-harness/hooks/hook-novo.mjs'), '// novo\n')
    const r = roda(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /nao documenta o hook "hook-novo"/)
  })

  test('mutante: executável novo sem entrada na referência reprova', () => {
    const base = copia()
    writeFileSync(join(base, 'plugins/aidlc-harness/tools/aidlc-novo'), '#!/usr/bin/env node\n')
    const r = roda(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /nao documenta o executavel "aidlc-novo"/)
  })

  test('mutante: comando, agente e skill novos sem entrada reprovam', () => {
    const base = copia()
    const kit = join(base, 'plugins/aidlc-harness')
    writeFileSync(join(kit, 'commands/novo.md'), '---\ndescription: x\n---\n')
    writeFileSync(join(kit, 'agents/novo.md'), '---\nname: novo\n---\n')
    mkdirSync(join(kit, 'skills/novo'))
    writeFileSync(join(kit, 'skills/novo/SKILL.md'), '---\nname: novo\n---\n')
    const r = roda(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /o comando "novo"/)
    assert.match(r.stderr, /o agente "novo"/)
    assert.match(r.stderr, /a skill "novo"/)
  })

  test('mutante: referência apagada reprova', () => {
    const base = copia()
    rmSync(join(base, 'docs/REFERENCIA.md'))
    const r = roda(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /REFERENCIA\.md nao existe/)
  })

  test('mutante: a prosa cita um executável que não existe (o caso do `aidlc-phase approve`)', () => {
    const base = copia()
    edita(base, 'README.md', (t) => t + '\nRode `aidlc-fantasma` para tudo.\n')
    const r = roda(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /README\.md:\d+\s+cita "aidlc-fantasma"/)
  })

  test('mutante: a prosa cita um subcomando que o executável não tem', () => {
    const base = copia()
    edita(base, 'docs/COMECAR.md', (t) => t + '\n```bash\naidlc-phase approve inception\n```\n')
    const r = roda(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /"aidlc-phase approve": aidlc-phase nao tem o subcomando "approve"/)
  })

  test('não dá vermelho falso: verbo em prosa, nome de arquivo e URL passam', () => {
    const base = copia()
    edita(base, 'README.md', (t) => t + '\nO aidlc-phase reprova isso. Veja aidlc-gate.yml e https://github.com/x/aidlc-harness.git.\n')
    const r = roda(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('os subcomandos da tabela existem de verdade nos executáveis', () => {
    // Cada subcomando listado precisa ser aceito: nenhum pode cair no caminho "desconhecido".
    const tools = join(RAIZ, 'plugins/aidlc-harness/tools')
    for (const [tool, subs] of Object.entries({ 'aidlc-phase': ['status', 'check'], 'aidlc-graph': ['blast', 'diagram', 'validate', 'list'], 'aidlc-secrets': ['status', 'template', 'help'] })) {
      for (const sub of subs) {
        const cwd = mkdtempSync(join(tmpdir(), 'aidlc-sub-'))
        const r = spawnSync(process.execPath, [join(tools, tool), sub], { cwd, encoding: 'utf8', input: '', timeout: 20000 })
        rmSync(cwd, { recursive: true, force: true })
        assert.doesNotMatch(r.stdout + r.stderr, /desconhecid|unknown|invalid command/i, `${tool} ${sub}`)
      }
    }
  })
})
