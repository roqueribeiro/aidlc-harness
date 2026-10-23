import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { achar, trocar, valido, foraDoEscopo, MARCADORES } from './definir-dono.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'definir-dono.mjs')

describe('achar', () => {
  test('acha os dois marcadores com a linha', () => {
    const r = achar(`a\n* @${MARCADORES.owner}\nmail ${MARCADORES.email}\n`)
    assert.deepEqual(r, [
      { marcador: MARCADORES.owner, linha: 2 },
      { marcador: MARCADORES.email, linha: 3 },
    ])
  })
  test('texto limpo não acha nada', () => assert.deepEqual(achar('nada aqui'), []))
})

describe('trocar', () => {
  test('troca todas as ocorrências', () => {
    assert.equal(trocar(`${MARCADORES.owner}/x e ${MARCADORES.owner}/y`, { owner: 'ana' }), 'ana/x e ana/y')
  })
  test('só troca o que foi informado', () => {
    const t = `${MARCADORES.owner} ${MARCADORES.email}`
    assert.equal(trocar(t, { owner: 'ana' }), `ana ${MARCADORES.email}`)
  })
})

describe('valido', () => {
  test('aceita usuário e e-mail normais', () => assert.deepEqual(valido({ owner: 'ana-souza', email: 'ana@org.com' }), []))
  test('recusa usuário com barra, espaço ou hífen nas pontas', () => {
    for (const o of ['a/b', 'a b', '-ana', 'ana-']) assert.equal(valido({ owner: o }).length, 1, o)
  })
  test('recusa e-mail sem arroba', () => assert.equal(valido({ email: 'ana.org.com' }).length, 1))
})

describe('foraDoEscopo', () => {
  test('modelos de outro repositório, testes e o próprio script ficam de fora', () => {
    assert.ok(foraDoEscopo('plugins/aidlc-harness/templates/aberto/.github/CODEOWNERS'))
    assert.ok(foraDoEscopo('scripts/x.test.mjs'))
    assert.ok(foraDoEscopo('scripts/definir-dono.mjs'))
    assert.ok(!foraDoEscopo('README.md'))
    assert.ok(!foraDoEscopo('.github/CODEOWNERS'))
  })
})

describe('linha de comando', () => {
  test('sem argumentos válidos sai com 2', () => assert.equal(spawnSync('node', [SCRIPT], { encoding: 'utf8' }).status, 2))
  test('owner inválido sai com 2 e não toca em nada', () => {
    const r = spawnSync('node', [SCRIPT, '--owner', 'a/b', '--dry-run'], { encoding: 'utf8' })
    assert.equal(r.status, 2)
  })
  test('--check nunca escreve: roda e sai 0 ou 1', () => {
    const r = spawnSync('node', [SCRIPT, '--check'], { encoding: 'utf8' })
    assert.ok([0, 1].includes(r.status))
    assert.match(r.stdout, /definir-dono:/)
  })
})

describe('troca de verdade num repositório temporário', () => {
  const montar = () => {
    const d = mkdtempSync(join(tmpdir(), 'aidlc-dono-'))
    spawnSync('git', ['init', '-q'], { cwd: d })
    writeFileSync(join(d, 'README.md'), `clone ${MARCADORES.owner}/kit\ncontato ${MARCADORES.email}\n`)
    mkdirSync(join(d, 'plugins/aidlc-harness/templates/aberto'), { recursive: true })
    writeFileSync(join(d, 'plugins/aidlc-harness/templates/aberto/CODEOWNERS'), `* @${MARCADORES.owner}\n`)
    spawnSync('git', ['add', '-A'], { cwd: d })
    return d
  }
  const rodar = (d, ...a) => spawnSync('node', [SCRIPT, '--root', d, ...a], { encoding: 'utf8' })

  test('--check reprova com marcador e aprova depois da troca', () => {
    const d = montar()
    assert.equal(rodar(d, '--check').status, 1)
    const r = rodar(d, '--owner', 'ana', '--email', 'ana@org.com')
    assert.equal(r.status, 0, r.stderr)
    assert.equal(readFileSync(join(d, 'README.md'), 'utf8'), 'clone ana/kit\ncontato ana@org.com\n')
    assert.equal(rodar(d, '--check').status, 0)
  })

  test('não toca nos modelos de outro repositório', () => {
    const d = montar()
    rodar(d, '--owner', 'ana')
    assert.match(readFileSync(join(d, 'plugins/aidlc-harness/templates/aberto/CODEOWNERS'), 'utf8'), new RegExp(MARCADORES.owner))
  })

  test('--dry-run não escreve', () => {
    const d = montar()
    rodar(d, '--owner', 'ana', '--dry-run')
    assert.match(readFileSync(join(d, 'README.md'), 'utf8'), new RegExp(MARCADORES.owner))
  })
})
