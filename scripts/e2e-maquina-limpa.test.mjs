#!/usr/bin/env node
/*
 * Teste de máquina limpa: o caminho de quem acabou de chegar, pela linha de comando, com um HOME
 * vazio e os executáveis só no PATH que o `setup` instalou.
 *
 * Por que existe: em 06/11/2026 a v0.1.0 passava 383 testes e, mesmo assim, num projeto de
 * verdade o `aidlc-init --check` reprovava logo depois do `aidlc-init` (AGENTS.md do time), o
 * `aidlc-doctor` cobrava arquivo de outra ferramenta e um projeto Java saía do gate com
 * "nenhuma tecnologia reconhecida". Cada unidade estava testada; o caminho inteiro, não.
 *
 * Os gates em si não rodam aqui (o CI não tem Maven, .NET e Go instalados): o que se confere é
 * que cada projeto é reconhecido, que o init deixa tudo em sincronia e que o CI gerado prepara a
 * tecnologia certa. A execução real de cada gate foi medida à parte e está registrada no PR.
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const WIN = process.platform === 'win32'

let base, home, bin, env

before(() => {
  base = mkdtempSync(join(tmpdir(), 'aidlc-e2e-'))
  home = join(base, 'home')
  bin = join(home, 'bin')
  mkdirSync(home, { recursive: true })
  const r = spawnSync(process.execPath, [join(RAIZ, 'scripts', 'setup.mjs'), '--dir', bin], { encoding: 'utf8', env: { ...process.env, HOME: home, USERPROFILE: home } })
  assert.equal(r.status, 0, r.stdout + r.stderr)
  // No Windows a variável se chama `Path`: acrescentar `PATH` criaria uma segunda, que o cmd ignora.
  const chave = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  env = { ...process.env, HOME: home, USERPROFILE: home, [chave]: bin + delimiter + process.env[chave] }
})
after(() => rmSync(base, { recursive: true, force: true }))

/** Roda um executável do kit como o usuário rodaria: pelo nome, achado no PATH. */
function kit(nome, args, cwd) {
  const r = spawnSync(WIN ? `${nome}.cmd` : nome, args, { cwd, env, encoding: 'utf8', shell: WIN })
  return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

function projeto(nome, arquivos) {
  const d = join(base, nome)
  mkdirSync(join(d, '.git'), { recursive: true })
  for (const [f, c] of Object.entries(arquivos)) {
    mkdirSync(dirname(join(d, f)), { recursive: true })
    writeFileSync(join(d, f), c)
  }
  return d
}

const CASOS = [
  ['node-yarn', { 'package.json': '{"name":"app-exemplo","scripts":{"test":"node --test"}}', 'yarn.lock': '' }, 'yarn install --frozen-lockfile'],
  ['node-pnpm', { 'package.json': '{"name":"app-exemplo"}', 'pnpm-lock.yaml': "lockfileVersion: '9.0'\n" }, 'pnpm install --frozen-lockfile'],
  ['java-maven', { 'pom.xml': '<project/>' }, 'actions/setup-java'],
  ['java-gradle', { 'build.gradle.kts': '', 'settings.gradle.kts': '' }, 'gradle/actions/setup-gradle'],
  ['dotnet', { 'Pedidos.sln': '', 'Pedidos.Api.csproj': '<Project/>' }, 'actions/setup-dotnet'],
  ['go', { 'go.mod': 'module exemplo\n' }, 'actions/setup-go'],
  ['python-uv', { 'pyproject.toml': '[project]\nname = "app-exemplo"\n', 'uv.lock': '' }, 'astral-sh/setup-uv'],
]

describe('máquina limpa: setup, init, check, gate e doctor pelo PATH', () => {
  for (const [tech, arquivos, passoDeCi] of CASOS) {
    test(`${tech}: reconhecido, em sincronia e com o CI da stack`, () => {
      const d = projeto(tech, arquivos)
      const init = kit('aidlc-init', ['--name', 'App Exemplo', '--desc', 'Exemplo.'], d)
      assert.equal(init.code, 0, init.out)
      const chk = kit('aidlc-init', ['--check'], d)
      assert.equal(chk.code, 0, chk.out)
      const gate = kit('aidlc-gate', ['--dry-run'], d)
      assert.equal(gate.code, 0, gate.out)
      assert.match(gate.out, new RegExp(`\\(${tech}\\)`), gate.out)
      assert.ok(readFileSync(join(d, '.github/workflows/aidlc-gate.yml'), 'utf8').includes(passoDeCi), `CI sem ${passoDeCi}`)
    })
  }

  test('projeto que já tem AGENTS.md: o texto do time fica, o bloco entra e o --check passa', () => {
    const d = projeto('agents-do-time', { 'AGENTS.md': '# Projeto do time\n\nUsamos pnpm.\n', 'go.mod': 'module exemplo\n' })
    const init = kit('aidlc-init', [], d)
    assert.equal(init.code, 0, init.out)
    assert.match(readFileSync(join(d, 'AGENTS.md'), 'utf8'), /^# Projeto do time\n\nUsamos pnpm\.[\s\S]*<!-- aidlc:inicio/)
    assert.equal(kit('aidlc-init', ['--check'], d).code, 0)
  })

  test('projeto só com Kiro: o doctor não cobra arquivo do Claude Code', () => {
    const d = projeto('so-kiro', { 'go.mod': 'module exemplo\n' })
    assert.equal(kit('aidlc-init', ['--tools', 'kiro'], d).code, 0)
    const r = kit('aidlc-doctor', ['--json'], d)
    const ids = JSON.parse(r.out).checks.map((c) => c.id)
    assert.ok(!ids.includes('plugin-enabled') && !ids.includes('claude-md'), ids.join(','))
  })

  test('projeto sem tecnologia: o gate diz que não reconheceu e sai com 2, sem inventar', () => {
    const d = projeto('vazio', {})
    const r = kit('aidlc-gate', [], d)
    assert.equal(r.code, 2, r.out)
    assert.match(r.out, /nenhuma tecnologia reconhecida/)
  })
})
