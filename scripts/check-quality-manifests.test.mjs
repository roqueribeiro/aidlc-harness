import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const PLUGIN = join(RAIZ, 'plugins/aidlc-harness')
const CHECK = join(RAIZ, 'scripts/check-quality-manifests.mjs')

/** Copia quality/ e rules/ para um plugin descartável, e devolve a pasta quality/ da cópia. */
function copia() {
  const base = mkdtempSync(join(tmpdir(), 'aidlc-qm-'))
  mkdirSync(join(base, 'quality'))
  cpSync(join(PLUGIN, 'quality'), join(base, 'quality'), { recursive: true })
  cpSync(join(PLUGIN, 'rules'), join(base, 'rules'), { recursive: true })
  return { base, quality: join(base, 'quality') }
}

const roda = (quality) => spawnSync(process.execPath, [CHECK, '--dir', quality], { encoding: 'utf8' })

function mexe(quality, arquivo, fn) {
  const p = join(quality, arquivo)
  const m = JSON.parse(readFileSync(p, 'utf8'))
  fn(m)
  writeFileSync(p, JSON.stringify(m, null, 2))
}

describe('check-quality-manifests', () => {
  test('os manifestos do kit passam', () => {
    const r = spawnSync(process.execPath, [CHECK], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('uma cópia intacta passa (a base dos mutantes é válida)', () => {
    const { base, quality } = copia()
    const r = roda(quality)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('mutante: ponteiro @kit/ em strategy.paths para arquivo inexistente reprova', () => {
    const { base, quality } = copia()
    mexe(quality, 'node-yarn.json', (m) => {
      m.strategy.paths[0].read = ['@kit/rules/nao-existe.md']
    })
    const r = roda(quality)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stdout + r.stderr, /nao-existe\.md/)
  })

  test('mutante: ponteiro @kit/ em strategy.always para arquivo inexistente reprova', () => {
    const { base, quality } = copia()
    mexe(quality, 'node-yarn.json', (m) => {
      m.strategy.always = ['@kit/rules/fantasma.md']
    })
    const r = roda(quality)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stdout + r.stderr, /fantasma\.md/)
  })

  test('mutante: recorte de strategy sem when reprova', () => {
    const { base, quality } = copia()
    mexe(quality, 'node-yarn.json', (m) => {
      m.strategy.paths[0].when = []
    })
    const r = roda(quality)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stdout + r.stderr, /sem `when`/)
  })

  test('mutante: gate com cmd e agent ao mesmo tempo reprova', () => {
    const { base, quality } = copia()
    mexe(quality, 'node-yarn.json', (m) => {
      m.gates[0].agent = 'supply-chain-reviewer'
    })
    const r = roda(quality)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stdout + r.stderr, /exatamente um entre cmd e agent/)
  })

  test('mutante: regex inválida em evidence.markers reprova', () => {
    const { base, quality } = copia()
    mexe(quality, 'node-yarn.json', (m) => {
      m.evidence[0].markers = ['([']
    })
    const r = roda(quality)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stdout + r.stderr, /regex invalida/)
  })

  test('o modelo de gate de segurança (templates/security) é um manifesto válido', () => {
    const { base, quality } = copia()
    cpSync(join(PLUGIN, 'templates/security/node-yarn-com-scan.json'), join(quality, 'node-yarn.json'))
    const r = roda(quality)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 0, r.stdout + r.stderr)
    const m = JSON.parse(readFileSync(join(PLUGIN, 'templates/security/node-yarn-com-scan.json'), 'utf8'))
    assert.ok(m.gates.some((g) => g.id === 'scan' && /aidlc-scan/.test(g.cmd)))
  })
})
