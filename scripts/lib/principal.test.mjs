import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, symlinkSync, rmSync, cpSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = fileURLToPath(new URL('.', import.meta.url))

describe('ehPrincipal', () => {
  test('um script chamado por um caminho com link simbolico ainda se reconhece como programa', () => {
    // Reproduz no Linux o que o macOS faz sempre (/var -> /private/var).
    const real = mkdtempSync(join(tmpdir(), 'aidlc-principal-'))
    mkdirSync(join(real, 'lib'))
    cpSync(join(AQUI, 'principal.mjs'), join(real, 'lib/principal.mjs'))
    writeFileSync(join(real, 'prog.mjs'), "import { ehPrincipal } from './lib/principal.mjs'\nif (ehPrincipal(import.meta.url)) { console.log('rodou'); process.exit(3) }\n")
    const link = real + '-link'
    symlinkSync(real, link)
    try {
      const r = spawnSync(process.execPath, [join(link, 'prog.mjs')], { encoding: 'utf8' })
      assert.equal(r.status, 3, r.stdout + r.stderr)
      const direto = spawnSync(process.execPath, [join(real, 'prog.mjs')], { encoding: 'utf8' })
      assert.equal(direto.status, 3)
    } finally {
      rmSync(link, { force: true })
      rmSync(real, { recursive: true, force: true })
    }
  })

  test('importado por outro modulo, nao e principal', async () => {
    const { ehPrincipal } = await import('./principal.mjs')
    assert.equal(ehPrincipal(new URL('./principal.mjs', import.meta.url).href), false)
  })
})
