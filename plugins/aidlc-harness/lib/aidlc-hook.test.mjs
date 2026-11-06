#!/usr/bin/env node
/*
 * aidlc-hook: os hooks do kit em GitHub Copilot, Cursor e Codex, com a entrada e a saída no formato
 * documentado de cada um (conferido em 06/11/2026). Cada teste é um jeito de passar sem evidência.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { impressaoDaArvore, registrarGate } from './audit.mjs'
import { planejar, aplicar, conferirSincronia, sincronizar } from './init.mjs'

const TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools')
const hook = (modo, formato, entrada, env = {}) => {
  const r = spawnSync(process.execPath, [join(TOOLS, 'aidlc-hook'), modo, '--formato', formato], { input: JSON.stringify(entrada), encoding: 'utf8', env: { ...process.env, AIDLC_GATE: '', ...env } })
  return { code: r.status, saida: r.stdout.trim() ? JSON.parse(r.stdout) : null, err: r.stderr }
}

/** Repo git com uma tecnologia cujo gate passa ou reprova conforme `GATE_OK`. */
function repo() {
  const d = mkdtempSync(join(tmpdir(), 'aidlc-hook-'))
  const g = (...a) => execFileSync('git', a, { cwd: d, stdio: 'ignore' })
  g('init', '-q')
  g('config', 'user.email', 't@t.t')
  g('config', 'user.name', 't')
  mkdirSync(join(d, '.aidlc', 'quality'), { recursive: true })
  writeFileSync(join(d, 'marcador.txt'), 'x\n')
  writeFileSync(
    join(d, '.aidlc', 'quality', 'exemplo.json'),
    JSON.stringify({ tech: 'exemplo', label: 'Exemplo', repos: ['a'], detect: { allFiles: ['marcador.txt'] }, gates: [{ id: 'unit', label: 'unit', cmd: 'node -e "process.exit(Number(process.env.GATE_FALHA||0))"', blocking: true }], evidence: [] }),
  )
  g('add', '.')
  g('commit', '-qm', 'base')
  return d
}

describe('aidlc-hook shell: segredo e gerenciador errado, no formato de cada ferramenta', () => {
  test('Copilot: toolArgs em texto JSON; nega com permissionDecision', () => {
    const r = hook('shell', 'copilot', { cwd: tmpdir(), toolName: 'bash', toolArgs: JSON.stringify({ command: 'gh auth token' }) })
    assert.equal(r.saida.permissionDecision, 'deny')
    assert.match(r.saida.permissionDecisionReason, /token do GitHub/)
  })
  test('Codex: tool_input.command; nega com hookSpecificOutput', () => {
    const r = hook('shell', 'codex', { cwd: tmpdir(), tool_name: 'Bash', tool_input: { command: 'gh auth token' } })
    assert.equal(r.saida.hookSpecificOutput.permissionDecision, 'deny')
    assert.equal(r.saida.hookSpecificOutput.hookEventName, 'PreToolUse')
  })
  test('Cursor: command; nega com permission e mensagem para o agente', () => {
    const r = hook('shell', 'cursor', { cwd: tmpdir(), command: 'gh auth token' })
    assert.equal(r.saida.permission, 'deny')
    assert.match(r.saida.agent_message, /token do GitHub/)
  })
  test('comando comum e ferramenta que não é shell passam sem saída', () => {
    assert.equal(hook('shell', 'copilot', { cwd: tmpdir(), toolName: 'view', toolArgs: { path: 'a.md' } }).saida, null)
    assert.equal(hook('shell', 'cursor', { cwd: tmpdir(), command: 'ls -la' }).saida, null)
  })
  test('gerenciador errado num repo yarn é negado (a regra do pkg-manager vale fora do Claude)', () => {
    const d = mkdtempSync(join(tmpdir(), 'aidlc-hook-yarn-'))
    writeFileSync(join(d, 'package.json'), '{"name":"a"}')
    writeFileSync(join(d, 'yarn.lock'), '')
    const r = hook('shell', 'cursor', { cwd: d, command: 'npm install lodash' })
    assert.equal(r.saida?.permission, 'deny')
    rmSync(d, { recursive: true, force: true })
  })
})

describe('aidlc-hook parada: mudança sem gate verde nesta árvore volta para o agente', () => {
  test('árvore limpa passa', () => {
    const d = repo()
    assert.equal(hook('parada', 'copilot', { cwd: d, stop_hook_active: false }).saida, null)
    rmSync(d, { recursive: true, force: true })
  })
  test('mudança sem gate: Copilot e Codex recebem block com o motivo; Cursor recebe followup_message', () => {
    const d = repo()
    writeFileSync(join(d, 'novo.js'), 'x\n')
    const cp = hook('parada', 'copilot', { cwd: d })
    assert.equal(cp.saida.decision, 'block')
    assert.match(cp.saida.reason, /aidlc-gate/)
    writeFileSync(join(d, 'novo.js'), 'y\n') // outra árvore, contador novo
    assert.equal(hook('parada', 'codex', { cwd: d }).saida.decision, 'block')
    writeFileSync(join(d, 'novo.js'), 'z\n')
    assert.match(hook('parada', 'cursor', { cwd: d, status: 'completed', loop_count: 0 }).saida.followup_message, /aidlc-gate/)
    rmSync(d, { recursive: true, force: true })
  })
  test('o aidlc-gate verde nesta árvore libera; mudar um byte depois volta a cobrar', () => {
    const d = repo()
    writeFileSync(join(d, 'novo.js'), 'a\n')
    const gate = spawnSync(process.execPath, [join(TOOLS, 'aidlc-gate')], { cwd: d, encoding: 'utf8' })
    assert.equal(gate.status, 0, gate.stdout)
    assert.ok(existsSync(join(d, 'aidlc', 'audit')), 'o gate gravou o registro')
    assert.equal(hook('parada', 'copilot', { cwd: d }).saida, null, 'gate verde na mesma árvore')
    writeFileSync(join(d, 'novo.js'), 'b\n')
    assert.equal(hook('parada', 'copilot', { cwd: d }).saida.decision, 'block')
    rmSync(d, { recursive: true, force: true })
  })
  test('gate vermelho na árvore não libera', () => {
    const d = repo()
    writeFileSync(join(d, 'novo.js'), 'c\n')
    const gate = spawnSync(process.execPath, [join(TOOLS, 'aidlc-gate')], { cwd: d, encoding: 'utf8', env: { ...process.env, GATE_FALHA: '1' } })
    assert.equal(gate.status, 1)
    assert.equal(hook('parada', 'codex', { cwd: d }).saida.decision, 'block')
    rmSync(d, { recursive: true, force: true })
  })
  test('três devoluções na mesma árvore e libera com aviso (trava impossível ensina a desligar)', () => {
    const d = repo()
    writeFileSync(join(d, 'novo.js'), `${Date.now()}\n`)
    for (let k = 0; k < 3; k++) assert.equal(hook('parada', 'copilot', { cwd: d }).saida.decision, 'block')
    const r = hook('parada', 'copilot', { cwd: d })
    assert.equal(r.saida, null)
    assert.match(r.err, /liberado depois de 3/)
    rmSync(d, { recursive: true, force: true })
  })
  test('AIDLC_GATE=0 desliga a parada', () => {
    const d = repo()
    writeFileSync(join(d, 'novo.js'), 'd\n')
    assert.equal(hook('parada', 'copilot', { cwd: d }, { AIDLC_GATE: '0' }).saida, null)
    rmSync(d, { recursive: true, force: true })
  })
  test('a impressão da árvore ignora a pasta de auditoria (gravar o registro não muda a árvore)', () => {
    const d = repo()
    writeFileSync(join(d, 'novo.js'), 'e\n')
    const antes = impressaoDaArvore(d)
    registrarGate(d, { ok: true, tech: 'exemplo', arvore: antes })
    assert.equal(impressaoDaArvore(d), antes)
    rmSync(d, { recursive: true, force: true })
  })
})

describe('configuração de hooks gerada pelo aidlc-init', () => {
  test('Copilot, Cursor e Codex recebem o arquivo de hooks apontando para o aidlc-hook', () => {
    const d = mkdtempSync(join(tmpdir(), 'aidlc-hookcfg-'))
    aplicar(d, planejar({ nome: 'a', descricao: 'b', ferramentas: ['copilot', 'cursor', 'codex'] }))
    assert.match(readFileSync(join(d, '.github/hooks/aidlc.json'), 'utf8'), /"agentStop"[\s\S]*aidlc-hook parada --formato copilot/)
    assert.match(readFileSync(join(d, '.cursor/hooks.json'), 'utf8'), /"stop"[\s\S]*aidlc-hook parada --formato cursor/)
    assert.match(readFileSync(join(d, '.codex/hooks.json'), 'utf8'), /"Stop"[\s\S]*aidlc-hook parada --formato codex/)
    assert.deepEqual(conferirSincronia(d), [])
    rmSync(d, { recursive: true, force: true })
  })
  test('hooks que o time já tinha ficam; os do kit entram ao lado; tirar os do kit reprova o --check', () => {
    const d = mkdtempSync(join(tmpdir(), 'aidlc-hookcfg-'))
    mkdirSync(join(d, '.cursor'))
    const doTime = { version: 1, hooks: { afterFileEdit: [{ command: '.cursor/hooks/formatar.sh' }], stop: [{ command: '.cursor/hooks/avisar.sh' }] } }
    writeFileSync(join(d, '.cursor/hooks.json'), JSON.stringify(doTime))
    const r = aplicar(d, planejar({ nome: 'a', descricao: 'b', ferramentas: ['cursor'] }))
    assert.ok(r.mesclados.includes('.cursor/hooks.json'))
    const depois = JSON.parse(readFileSync(join(d, '.cursor/hooks.json'), 'utf8'))
    assert.equal(depois.hooks.afterFileEdit[0].command, '.cursor/hooks/formatar.sh')
    assert.deepEqual(depois.hooks.stop.map((e) => e.command), ['.cursor/hooks/avisar.sh', 'aidlc-hook parada --formato cursor'])
    writeFileSync(join(d, '.cursor/hooks.json'), JSON.stringify(doTime))
    assert.match(conferirSincronia(d).join(' '), /\.cursor\/hooks\.json: sem as entradas do aidlc-hook/)
    sincronizar(d)
    assert.deepEqual(conferirSincronia(d), [])
    rmSync(d, { recursive: true, force: true })
  })
})
