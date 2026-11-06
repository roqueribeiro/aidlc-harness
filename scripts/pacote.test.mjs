#!/usr/bin/env node
/*
 * O pacote instala como o README promete: `npm install -g github:...` (ou `npx github:... init`)
 * põe todos os `aidlc-*` no PATH em qualquer sistema, e `aidlc-harness <comando>` chega ao
 * executável certo sem quebrar o medidor de contexto que já tinha esse nome.
 *
 * O teste empacota a árvore atual (`npm pack`), instala o .tgz num prefixo temporário e roda os
 * executáveis instalados, não os do repositório: é o que a pessoa recebe.
 */
import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { destino, SUBCOMANDOS } from './aidlc.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const WIN = process.platform === 'win32'
const pkg = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8'))
const TOOLS = readdirSync(join(RAIZ, 'plugins', 'aidlc-harness', 'tools')).filter((n) => n.startsWith('aidlc-'))

describe('o mapa de executáveis do pacote', () => {
  test('todo executável do kit está no bin, e nada além deles', () => {
    assert.deepEqual(Object.keys(pkg.bin).sort(), [...TOOLS].sort())
    for (const t of TOOLS.filter((t) => t !== 'aidlc-harness')) assert.equal(pkg.bin[t], `plugins/aidlc-harness/tools/${t}`)
  })
  test('aidlc-harness <subcomando> vai para aidlc-<subcomando>; o resto continua sendo o medidor', () => {
    assert.deepEqual(destino(['init', '--tools', 'cursor']), { tool: 'aidlc-init', args: ['--tools', 'cursor'] })
    assert.deepEqual(destino([]), { tool: 'aidlc-harness', args: [] })
    assert.deepEqual(destino(['../outro-repo', '--json']), { tool: 'aidlc-harness', args: ['../outro-repo', '--json'] })
    assert.ok(SUBCOMANDOS.includes('hook') && !SUBCOMANDOS.includes('harness'))
  })
})

describe('instalado de um pacote de verdade', () => {
  let base, prefixo, env
  const npm = WIN ? 'npm.cmd' : 'npm'
  before(() => {
    base = mkdtempSync(join(tmpdir(), 'aidlc-pacote-'))
    prefixo = join(base, 'prefixo')
    const pack = spawnSync(npm, ['pack', '--pack-destination', base, '--silent'], { cwd: RAIZ, encoding: 'utf8', shell: WIN })
    assert.equal(pack.status, 0, pack.stderr)
    const tgz = join(base, pack.stdout.trim().split('\n').pop())
    const inst = spawnSync(npm, ['install', '-g', '--prefix', prefixo, '--no-audit', '--no-fund', tgz], { encoding: 'utf8', shell: WIN })
    assert.equal(inst.status, 0, inst.stderr)
    const bin = WIN ? prefixo : join(prefixo, 'bin')
    const chave = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
    env = { ...process.env, [chave]: bin + delimiter + process.env[chave] }
  })
  after(() => rmSync(base, { recursive: true, force: true }))

  const rodar = (cmd, args, cwd) => {
    const argv = WIN ? args.map((x) => (/\s/.test(x) ? `"${x}"` : x)) : args
    const r = spawnSync(cmd, argv, { cwd, env, encoding: 'utf8', shell: WIN })
    return { code: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
  }

  test('aidlc-harness init e aidlc-init --check, pelos executáveis instalados', () => {
    const d = join(base, 'projeto')
    mkdirSync(join(d, '.git'), { recursive: true })
    const init = rodar('aidlc-harness', ['init', '--tools', 'cursor,opencode,copilot'], d)
    assert.equal(init.code, 0, init.out)
    assert.match(init.out, /\.opencode\/commands\/aidlc-inception\.md/)
    const chk = rodar('aidlc-init', ['--check'], d)
    assert.equal(chk.code, 0, chk.out)
  })

  test('o aidlc-hook instalado responde no formato da ferramenta (os hooks gerados o chamam pelo nome)', () => {
    const r = spawnSync(WIN ? 'aidlc-hook.cmd' : 'aidlc-hook', ['shell', '--formato', 'cursor'], { env, input: JSON.stringify({ cwd: base, command: 'gh auth token' }), encoding: 'utf8', shell: WIN })
    assert.equal(r.status, 0, r.stderr)
    assert.equal(JSON.parse(r.stdout).permission, 'deny')
  })
})
