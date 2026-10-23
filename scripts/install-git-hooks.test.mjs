import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decidir, CONTEUDO, MARCADOR, destinoDoGancho } from './install-git-hooks.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'install-git-hooks.mjs')

const repoTemp = () => {
  const d = mkdtempSync(join(tmpdir(), 'aidlc-hook-'))
  spawnSync('git', ['init', '-q'], { cwd: d })
  return d
}
const rodar = (...args) => spawnSync('node', [SCRIPT, ...args], { encoding: 'utf8' })

describe('decidir', () => {
  test('sem gancho: instalar', () => assert.equal(decidir(null), 'instalar'))
  test('gancho nosso e igual: já instalado', () => assert.equal(decidir(CONTEUDO), 'ja-instalado'))
  test('gancho nosso e velho: reinstalar', () => assert.equal(decidir(`#!/bin/sh\n${MARCADOR}\nvelho\n`), 'instalar'))
  test('gancho de outra pessoa: conflito, nunca sobrescreve', () => assert.equal(decidir('#!/bin/sh\nyarn test\n'), 'conflito'))
})

describe('instalação de verdade', () => {
  test('instala executável no .git/hooks e uma segunda rodada é no-op', () => {
    const d = repoTemp()
    const r = rodar(d)
    assert.equal(r.status, 0, r.stdout + r.stderr)
    const alvo = join(d, '.git', 'hooks', 'pre-push')
    assert.ok(existsSync(alvo))
    assert.ok(statSync(alvo).mode & 0o111, 'precisa ser executável')
    assert.equal(readFileSync(alvo, 'utf8'), CONTEUDO)
    assert.match(rodar(d).stdout, /^ok /)
  })

  test('--check reprova (exit 1) quando falta e não escreve nada', () => {
    const d = repoTemp()
    const r = rodar('--check', d)
    assert.equal(r.status, 1)
    assert.ok(!existsSync(join(d, '.git', 'hooks', 'pre-push')))
  })

  test('não sobrescreve um pre-push alheio', () => {
    const d = repoTemp()
    const alvo = join(d, '.git', 'hooks', 'pre-push')
    mkdirSync(join(d, '.git', 'hooks'), { recursive: true })
    writeFileSync(alvo, '#!/bin/sh\nyarn test\n')
    const r = rodar(d)
    assert.equal(r.status, 1)
    assert.equal(readFileSync(alvo, 'utf8'), '#!/bin/sh\nyarn test\n')
  })

  test('respeita core.hooksPath', () => {
    const d = repoTemp()
    spawnSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: d })
    assert.equal(destinoDoGancho(d), join(d, '.githooks', 'pre-push'))
    assert.equal(rodar(d).status, 0)
    assert.ok(existsSync(join(d, '.githooks', 'pre-push')))
  })

  test('pasta que não é repositório falha com mensagem', () => {
    const d = mkdtempSync(join(tmpdir(), 'aidlc-nogit-'))
    const r = rodar(d)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /não é repo/)
  })

  test('o gancho deixa o push passar quando aidlc-gate não está no PATH', () => {
    const d = repoTemp()
    rodar(d)
    const r = spawnSync('sh', [join(d, '.git', 'hooks', 'pre-push')], { env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8' })
    assert.equal(r.status, 0)
    assert.match(r.stderr, /aidlc-gate não está no PATH/)
  })
})
