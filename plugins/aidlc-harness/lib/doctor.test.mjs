#!/usr/bin/env node
/*
 * aidlc-doctor num projeto de verdade, pela linha de comando.
 *
 * Os defeitos que estes testes travam: o doctor procurava o registro do gate em `.claude/audit/`
 * (o init cria `aidlc/audit/`), cobrava arquivos do Claude Code de quem usa só outra ferramenta e
 * mandava criar manifesto dentro da pasta interna do kit.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { planejar, aplicar } from './init.mjs'

const TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools')
const doctor = (d) => {
  const r = spawnSync(process.execPath, [join(TOOLS, 'aidlc-doctor'), d, '--json'], { encoding: 'utf8' })
  return JSON.parse(r.stdout)
}
const projeto = (ferramentas) => {
  const d = mkdtempSync(join(tmpdir(), 'aidlc-doctor-'))
  mkdirSync(join(d, '.git'))
  aplicar(d, planejar({ nome: 'app-exemplo', descricao: 'Exemplo.', ferramentas }))
  return d
}
const ids = (r) => r.checks.map((c) => c.id)

describe('aidlc-doctor', () => {
  test('projeto só com Kiro não é cobrado por arquivos do Claude Code', () => {
    const d = projeto(['kiro'])
    const r = doctor(d)
    for (const id of ['claude-md', 'claude-dir', 'plugin-enabled', 'permissions', 'loop']) assert.ok(!ids(r).includes(id), id)
    assert.ok(r.checks.find((c) => c.id === 'agents-md').ok, 'AGENTS.md recém-gerado está em sincronia')
    rmSync(d, { recursive: true, force: true })
  })

  test('projeto com Claude Code continua cobrado pelo plugin', () => {
    const d = projeto(['claude'])
    assert.ok(ids(doctor(d)).includes('plugin-enabled'))
    rmSync(d, { recursive: true, force: true })
  })

  test('o registro do gate em aidlc/audit/ conta (e o antigo .claude/audit/ também)', () => {
    for (const pasta of [['aidlc', 'audit'], ['.claude', 'audit']]) {
      const d = projeto(['kiro'])
      mkdirSync(join(d, ...pasta), { recursive: true })
      writeFileSync(join(d, ...pasta, '2026-11-06.jsonl'), JSON.stringify({ at: new Date().toISOString(), hook: 'dod-check', decision: 'released' }) + '\n')
      assert.equal(doctor(d).checks.find((c) => c.id === 'cycle-record').ok, true, pasta.join('/'))
      rmSync(d, { recursive: true, force: true })
    }
  })

  test('AGENTS.md sem o bloco do aidlc reprova o item agents-md', () => {
    const d = projeto(['kiro'])
    writeFileSync(join(d, 'AGENTS.md'), readFileSync(join(d, 'AGENTS.md'), 'utf8').replace(/<!-- aidlc:inicio[\s\S]*<!-- aidlc:fim -->\n?/, ''))
    assert.equal(doctor(d).checks.find((c) => c.id === 'agents-md').ok, false)
    rmSync(d, { recursive: true, force: true })
  })

  test('nenhum conselho aponta para dentro do kit nem cita versão de outro produto', () => {
    const d = projeto(['kiro'])
    const fixes = doctor(d).checks.map((c) => `${c.fix} ${c.note ?? ''}`).join('\n')
    assert.doesNotMatch(fixes, /plugins\/aidlc-harness\/quality|2\.1\d\.0|\.claude\/audit/)
    rmSync(d, { recursive: true, force: true })
  })
})
