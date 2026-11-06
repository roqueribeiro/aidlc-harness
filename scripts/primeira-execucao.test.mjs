#!/usr/bin/env node
/*
 * Primeira execução: o que a pessoa faz depois do `npx ... init`, sem instalar mais nada.
 *
 * Por que existe: na 0.2.0 o init anunciava os próximos passos e nenhum deles funcionava numa
 * máquina nova. Os hooks gerados chamavam `aidlc-hook` pelo PATH (127 em todo comando; no Copilot
 * isso nega toda ferramenta), `aidlc-gate` e `aidlc-phase` não existiam, o `aidlc-secscan` exigia
 * trivy instalado e o Claude Code não tinha o plugin que trazia o /inception. Os testes passavam
 * porque rodavam com o kit no PATH. Aqui o PATH não tem nada do kit e o HOME começa vazio.
 *
 * O trivy é baixado de verdade (rede) para um cache que sobrevive entre execuções, então só a
 * primeira vez numa máquina paga o download. No CI a máquina é nova: é o primeiro uso de fato,
 * em Linux, macOS e Windows.
 */
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const KIT = join(RAIZ, 'plugins', 'aidlc-harness')
const WIN = process.platform === 'win32'
const FERRAMENTAS = ['claude', 'cursor', 'copilot', 'codex', 'opencode', 'kiro', 'gemini']

let base, app, env

/** PATH da máquina sem nenhuma pasta que tenha executável do kit: quem nunca instalou o aidlc. */
function pathSemKit() {
  const chave = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  const dirs = (process.env[chave] ?? '').split(delimiter).filter((d) => d && !existsSync(join(d, WIN ? 'aidlc-gate.cmd' : 'aidlc-gate')))
  return { chave, valor: dirs.join(delimiter) }
}

function rodar(args, cwd = app, extra = {}) {
  const r = spawnSync(process.execPath, args, { cwd, env: { ...env, ...extra }, encoding: 'utf8', timeout: 900_000 })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}
const daCopia = (cmd, ...args) => rodar([join('.aidlc', 'kit', 'tools', cmd), ...args])

function git(args, cwd = app) {
  const r = spawnSync('git', args, { cwd, env, encoding: 'utf8' })
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`)
  return r.stdout
}

before(() => {
  base = mkdtempSync(join(tmpdir(), 'aidlc-primeira-'))
  const home = join(base, 'home')
  mkdirSync(home)
  const { chave, valor } = pathSemKit()
  // O cache fica fora do HOME de teste para o trivy (e o banco dele) não ser baixado a cada execução.
  const cache = join(tmpdir(), 'aidlc-harness-cache-de-teste')
  env = { ...process.env, HOME: home, USERPROFILE: home, XDG_CACHE_HOME: cache, LOCALAPPDATA: cache, GIT_AUTHOR_NAME: 'fulano', GIT_AUTHOR_EMAIL: 'fulano@exemplo.invalid', GIT_COMMITTER_NAME: 'fulano', GIT_COMMITTER_EMAIL: 'fulano@exemplo.invalid', [chave]: valor }
  delete env.AIDLC_TRIVY
  app = join(base, 'app-exemplo')
  mkdirSync(join(app, 'test'), { recursive: true })
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'app-exemplo', version: '1.0.0', private: true, license: 'UNLICENSED', scripts: { test: 'node --test', lint: 'node -e 0', build: 'node -e 0' } }, null, 2) + '\n')
  writeFileSync(join(app, 'package-lock.json'), JSON.stringify({ name: 'app-exemplo', version: '1.0.0', lockfileVersion: 3, requires: true, packages: { '': { name: 'app-exemplo', version: '1.0.0', license: 'UNLICENSED' } } }, null, 2) + '\n')
  writeFileSync(join(app, 'test', 'soma.test.mjs'), "import { test } from 'node:test'\nimport assert from 'node:assert/strict'\ntest('soma', () => assert.equal(1 + 1, 2))\n")
  git(['init', '-q'])
  git(['add', '-A'])
  git(['commit', '-qm', 'projeto'])
})
after(() => rmSync(base, { recursive: true, force: true }))

describe('primeira execução, sem nada do kit instalado', () => {
  test('não há aidlc no PATH desta máquina de teste', () => {
    const r = spawnSync(WIN ? 'aidlc-gate.cmd' : 'aidlc-gate', ['--help'], { env, shell: WIN, encoding: 'utf8' })
    assert.ok(r.error || r.status !== 0, 'o teste só vale sem o kit instalado')
  })

  test('init (o mesmo executável que o npx roda) e o --check logo depois, pela cópia do projeto', () => {
    const r = rodar([join(KIT, 'tools', 'aidlc-init'), '--tools', FERRAMENTAS.join(',')])
    assert.equal(r.code, 0, r.out)
    assert.match(r.out, /\.aidlc\/kit\/ .*sem instalar nada/)
    const c = daCopia('aidlc-init', '--check')
    assert.equal(c.code, 0, c.out)
  })

  test('Claude Code recebe o marketplace do kit e o plugin habilitado pelo próprio projeto', () => {
    const s = JSON.parse(readFileSync(join(app, '.claude', 'settings.json'), 'utf8'))
    assert.equal(s.enabledPlugins['aidlc-harness@aidlc'], true)
    assert.equal(s.extraKnownMarketplaces.aidlc.source.repo, 'roqueribeiro/aidlc-harness')
    const versao = JSON.parse(readFileSync(join(KIT, '.claude-plugin', 'plugin.json'), 'utf8')).version
    assert.equal(s.extraKnownMarketplaces.aidlc.source.ref, `v${versao}`)
  })

  test('todo hook gerado aponta para a cópia do projeto e roda', () => {
    for (const arq of ['.github/hooks/aidlc.json', '.cursor/hooks.json', '.codex/hooks.json']) {
      const txt = readFileSync(join(app, arq), 'utf8')
      const cmds = [...txt.matchAll(/"command": "([^"]+)"/g)].map((m) => m[1])
      assert.ok(cmds.length >= 2, arq)
      for (const c of cmds) {
        assert.match(c, /^node \.aidlc\/kit\/tools\/aidlc-hook /, `${arq}: ${c}`)
        const r = spawnSync(c, { cwd: app, env, shell: true, encoding: 'utf8', input: '{}' })
        assert.notEqual(r.status, 127, `${arq}: ${c} nao achou o executavel: ${r.stderr}`)
      }
    }
  })

  test('as fases respondem pela cópia do kit', () => {
    const r = daCopia('aidlc-phase', 'status')
    assert.equal(r.code, 0, r.out)
    assert.match(r.out, /inception/i)
  })

  test('o primeiro gate sai verde, trivy incluído, sem instalar nada', () => {
    git(['add', '-A'])
    git(['commit', '-qm', 'aidlc-init'])
    const r = daCopia('aidlc-gate')
    assert.equal(r.code, 0, r.out)
    assert.match(r.out, /PASSOU\s+Dependencia com CVE/)
    assert.doesNotMatch(r.out, /FALHOU/)
  })

  test('o colega que só clona o repositório tem tudo funcionando', () => {
    const clone = join(base, 'clone-do-colega')
    spawnSync('git', ['clone', '-q', app, clone], { env })
    for (const [args, rotulo] of [[['aidlc-init', '--check'], 'check'], [['aidlc-phase', 'status'], 'fases'], [['aidlc-gate'], 'gate']]) {
      const r = rodar([join('.aidlc', 'kit', 'tools', args[0]), ...args.slice(1)], clone)
      assert.equal(r.code, 0, `${rotulo}: ${r.out}`)
    }
  })

  test('mutante: cópia do kit afrouxada pelo agente reprova o --check do kit de verdade', () => {
    const clone = join(base, 'clone-afrouxado')
    cpSync(app, clone, { recursive: true })
    const m = join(clone, '.aidlc', 'kit', 'quality', 'node-npm.json')
    writeFileSync(m, readFileSync(m, 'utf8').replace(/"blocking": true/g, '"blocking": false'))
    const r = rodar([join(KIT, 'tools', 'aidlc-init'), '--check'], clone)
    assert.notEqual(r.code, 0, r.out)
    assert.match(r.out, /\.aidlc\/kit\/quality\/node-npm\.json: diverge/)
  })
})
