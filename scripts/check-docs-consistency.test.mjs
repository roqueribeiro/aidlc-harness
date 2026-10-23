import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const CHECK = join(fileURLToPath(new URL('.', import.meta.url)), 'check-docs-consistency.mjs')

/** Um repositório de mentira com 2 hooks, 1 agente, 1 skill, 3 executáveis e 1 tecnologia. */
function repo(readme) {
  const raiz = mkdtempSync(join(tmpdir(), 'aidlc-docs-'))
  const kit = join(raiz, 'plugins/aidlc-harness')
  mkdirSync(join(kit, 'hooks'), { recursive: true })
  mkdirSync(join(kit, 'agents'), { recursive: true })
  mkdirSync(join(kit, 'skills/uma'), { recursive: true })
  mkdirSync(join(kit, 'tools'), { recursive: true })
  mkdirSync(join(kit, 'quality'), { recursive: true })
  writeFileSync(join(kit, 'hooks/a.mjs'), '')
  writeFileSync(join(kit, 'hooks/b.mjs'), '')
  writeFileSync(join(kit, 'hooks/b.test.mjs'), '') // teste não conta como hook
  writeFileSync(join(kit, 'agents/x.md'), '')
  writeFileSync(join(kit, 'skills/uma/SKILL.md'), '')
  for (const t of ['t1', 't2', 't3']) writeFileSync(join(kit, 'tools', t), '')
  writeFileSync(join(kit, 'quality/node.json'), JSON.stringify({ tech: 'node' }))
  writeFileSync(join(kit, 'quality/velha.json'), JSON.stringify({ tech: 'velha', status: 'archived' }))
  writeFileSync(join(kit, 'quality/_schema.json'), '{}')
  writeFileSync(join(raiz, 'README.md'), readme)
  return raiz
}

const roda = (raiz, ...extra) => spawnSync(process.execPath, [CHECK, '--root', raiz, ...extra], { encoding: 'utf8' })

describe('check-docs-consistency', () => {
  test('documento que bate com o disco passa, mesmo em --strict', () => {
    const raiz = repo('O kit tem dois hooks e três executáveis, com uma tecnologia viva.')
    const r = roda(raiz, '--strict')
    rmSync(raiz, { recursive: true, force: true })
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /2 hooks, 1 agentes, 1 skills, 3 executaveis, 1 tecnologias/)
  })

  test('mutante: número de hooks errado reprova em --strict e nomeia o documento', () => {
    const raiz = repo('O kit tem cinco hooks no plugin.')
    const r = roda(raiz, '--strict')
    rmSync(raiz, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /README\.md/)
    assert.match(r.stderr, /diz 5, o disco tem 2/)
  })

  test('mutante: número em algarismo e em inglês também é pego', () => {
    const raiz = repo('The plugin ships 9 executables.\n\nThe kit has eleven hooks.')
    const r = roda(raiz, '--strict')
    rmSync(raiz, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /diz 9, o disco tem 3/)
    assert.match(r.stderr, /diz 11, o disco tem 2/)
  })

  test('sem --strict o mesmo erro é só aviso (exit 0)', () => {
    const raiz = repo('O kit tem cinco hooks no plugin.')
    const r = roda(raiz)
    rmSync(raiz, { recursive: true, force: true })
    assert.equal(r.status, 0)
    assert.match(r.stderr, /AVISO/)
  })

  test('número em bloco de código não conta como afirmação', () => {
    const raiz = repo('O kit tem dois hooks.\n\n```\nplugin com 9 hooks (saída antiga)\n```\n')
    const r = roda(raiz, '--strict')
    rmSync(raiz, { recursive: true, force: true })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('singular genérico e frase sem relação com o kit não são inventário', () => {
    const raiz = repo('Escreva um hook para o seu caso. Em casa tenho 7 hooks de anzol de pesca.')
    const r = roda(raiz, '--strict')
    rmSync(raiz, { recursive: true, force: true })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('o repositório real passa em --strict', () => {
    const r = spawnSync(process.execPath, [CHECK, '--strict'], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })
})
