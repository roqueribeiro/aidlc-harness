#!/usr/bin/env node
/*
 * As fases do AI-DLC. Mutantes: cada jeito de fingir que uma fase terminou tem de reprovar.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { conferirFase, conferirArquivo } from './phase.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const MOLDE = join(AQUI, '../templates/project/aidlc')
const FERRAMENTA = join(AQUI, '../tools/aidlc-phase')

const novo = () => {
  const d = mkdtempSync(join(tmpdir(), 'aidlc-phase-'))
  cpSync(MOLDE, join(d, 'aidlc'), { recursive: true })
  return d
}
const preenche = (d, rel, por = 'Maria Souza', data = '2026-10-23') => {
  const p = join(d, rel)
  let t = readFileSync(p, 'utf8')
  t = t.replace(/<!--[\s\S]*?PREENCHER[\s\S]*?-->/g, (m) => (/Aprovado por|nome de quem|AAAA-MM-DD/.test(m) ? m : 'conteudo real'))
  t = t.replace(/Aprovado por:.*/, `Aprovado por: ${por}`).replace(/Data:.*/, `Data: ${data}`)
  writeFileSync(p, t)
}
const TODOS = ['aidlc/inception/requirements.md', 'aidlc/inception/user-stories.md', 'aidlc/inception/units-of-work.md', 'aidlc/construction/design.md', 'aidlc/construction/test-plan.md']

describe('o molde recém-criado', () => {
  test('nenhuma fase está completa: o molde não pode nascer aprovado', () => {
    const d = novo()
    assert.equal(conferirFase(d, 'inception').ok, false)
    assert.equal(conferirFase(d, 'construction').ok, false)
    rmSync(d, { recursive: true, force: true })
  })
})

describe('fase completa quando, e só quando, tudo está preenchido e aprovado', () => {
  test('inception preenchida e aprovada passa; construction fica bloqueada até ter os seus', () => {
    const d = novo()
    for (const f of TODOS.slice(0, 3)) preenche(d, f)
    assert.equal(conferirFase(d, 'inception').ok, true, JSON.stringify(conferirFase(d, 'inception').problemas))
    assert.equal(conferirFase(d, 'construction').ok, false)
    for (const f of TODOS.slice(3)) preenche(d, f)
    assert.equal(conferirFase(d, 'construction').ok, true)
    rmSync(d, { recursive: true, force: true })
  })

  test('construction não passa com a inception incompleta, mesmo com os próprios arquivos prontos', () => {
    const d = novo()
    for (const f of TODOS.slice(3)) preenche(d, f)
    const e = conferirFase(d, 'construction')
    assert.equal(e.ok, false)
    assert.deepEqual(e.bloqueadaPor, ['inception'])
    rmSync(d, { recursive: true, force: true })
  })
})

describe('mutantes: cada jeito de fingir reprova', () => {
  const comUm = () => {
    const d = novo()
    for (const f of TODOS.slice(0, 3)) preenche(d, f)
    return d
  }
  const reprova = (d, trecho) => {
    const e = conferirFase(d, 'inception')
    assert.equal(e.ok, false)
    assert.ok(e.problemas.some((p) => p.includes(trecho)), `esperava "${trecho}" em ${JSON.stringify(e.problemas)}`)
    rmSync(d, { recursive: true, force: true })
  }

  test('um campo esquecido', () => {
    const d = comUm()
    const p = join(d, TODOS[0])
    writeFileSync(p, readFileSync(p, 'utf8') + '\n<!-- PREENCHER: esqueci este -->\n')
    reprova(d, 'por preencher')
  })
  test('aprovação em branco', () => {
    const d = comUm()
    const p = join(d, TODOS[1])
    writeFileSync(p, readFileSync(p, 'utf8').replace(/Aprovado por:.*/, 'Aprovado por:'))
    reprova(d, '"Aprovado por:" em branco')
  })
  test('a IA aprovando o próprio trabalho', () => {
    for (const nome of ['Claude', 'GitHub Copilot', 'Kiro', 'assistente de IA']) {
      const d = comUm()
      const p = join(d, TODOS[2])
      writeFileSync(p, readFileSync(p, 'utf8').replace(/Aprovado por:.*/, `Aprovado por: ${nome}`))
      reprova(d, 'aprovacao e de uma pessoa')
    }
  })
  test('data inválida ou ausente', () => {
    for (const data of ['ontem', '23/10/2026', '2026-13-45', '']) {
      const d = comUm()
      const p = join(d, TODOS[0])
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^Data:.*$/m, `Data: ${data}`))
      reprova(d, 'Data')
    }
  })
  test('arquivo apagado', () => {
    const d = comUm()
    rmSync(join(d, TODOS[1]))
    reprova(d, 'nao existe')
  })
  test('conferirArquivo aponta o arquivo certo', () => {
    const d = novo()
    assert.ok(conferirArquivo(d, 'aidlc/inception', 'requirements.md').every((p) => p.startsWith('aidlc/inception/requirements.md')))
    rmSync(d, { recursive: true, force: true })
  })
})

describe('ferramenta aidlc-phase', () => {
  test('check sai 1 no molde, 0 depois de preenchido; status sempre 0', () => {
    const d = novo()
    const roda = (...a) => spawnSync(process.execPath, [FERRAMENTA, ...a], { cwd: d, encoding: 'utf8' })
    assert.equal(roda('check', 'inception').status, 1)
    assert.equal(roda('status').status, 0)
    for (const f of TODOS.slice(0, 3)) preenche(d, f)
    assert.equal(roda('check', 'inception').status, 0)
    assert.equal(roda('check', 'construction').status, 1)
    rmSync(d, { recursive: true, force: true })
  })
  test('sem pasta aidlc/: status avisa, check reprova', () => {
    const d = mkdtempSync(join(tmpdir(), 'aidlc-phase-vazio-'))
    const roda = (...a) => spawnSync(process.execPath, [FERRAMENTA, ...a], { cwd: d, encoding: 'utf8' })
    assert.equal(roda('status').status, 0)
    assert.equal(roda('check', 'inception').status, 1)
    rmSync(d, { recursive: true, force: true })
  })
})
