#!/usr/bin/env node
/*
 * aidlc-init: cria, não sobrescreve, e a conferência de sincronia reprova de verdade quando as
 * instruções das ferramentas divergem.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { planejar, aplicar, conferirSincronia, sincronizar } from './init.mjs'
import { varrer } from './identity.mjs'
import { conferirFase } from './phase.mjs'
import { detectTech } from './detect.mjs'

const FERRAMENTA = join(dirname(fileURLToPath(import.meta.url)), '../tools/aidlc-init')
const novoDir = () => mkdtempSync(join(tmpdir(), 'aidlc-init-'))
const base = { nome: 'Projeto Exemplo', descricao: 'Cadastro de pedidos.' }

describe('criação', () => {
  test('cria o esqueleto completo, com o nome e a descrição no AGENTS.md', () => {
    const d = novoDir()
    const r = aplicar(d, planejar(base))
    for (const f of ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md', '.kiro/steering/aidlc.md', 'context/product.md', 'context/kernel.md', '.aidlc/config.json', '.aidlc/identity.json', '.github/workflows/aidlc-gate.yml', 'aidlc/README.md', 'aidlc/decisions.md', 'aidlc/inception/requirements.md', 'aidlc/construction/design.md', 'aidlc/audit/.gitkeep']) {
      assert.ok(existsSync(join(d, f)), `faltou ${f}`)
    }
    assert.equal(r.mantidos.length, 0)
    assert.match(readFileSync(join(d, 'AGENTS.md'), 'utf8'), /^# Projeto Exemplo\n\nCadastro de pedidos\./)
    assert.doesNotMatch(readFileSync(join(d, 'AGENTS.md'), 'utf8'), /\{\{/, 'nenhum placeholder sem substituir')
    rmSync(d, { recursive: true, force: true })
  })

  test('nenhum arquivo gerado deixa placeholder {{...}} para trás', () => {
    for (const p of planejar(base)) assert.doesNotMatch(p.conteudo, /\{\{[A-Z_]+\}\}/, p.destino)
  })

  test('.aidlc/config.json gerado é JSON válido e lista as ferramentas escolhidas', () => {
    const d = novoDir()
    aplicar(d, planejar({ ...base, ferramentas: ['claude', 'copilot'] }))
    assert.deepEqual(JSON.parse(readFileSync(join(d, '.aidlc/config.json'), 'utf8')).tools, ['claude', 'copilot'])
    assert.equal(existsSync(join(d, '.kiro')), false, 'Kiro não foi pedido')
    rmSync(d, { recursive: true, force: true })
  })

  test('ferramenta desconhecida é recusada', () => {
    assert.throws(() => planejar({ ...base, ferramentas: ['vscode'] }), /desconhecida/)
  })

  test('nunca sobrescreve; --force sobrescreve', () => {
    const d = novoDir()
    aplicar(d, planejar(base))
    writeFileSync(join(d, 'AGENTS.md'), 'meu texto')
    const r1 = aplicar(d, planejar(base))
    assert.ok(r1.mantidos.includes('AGENTS.md'))
    assert.equal(readFileSync(join(d, 'AGENTS.md'), 'utf8'), 'meu texto')
    const r2 = aplicar(d, planejar(base), { force: true })
    assert.ok(r2.sobrescritos.includes('AGENTS.md'))
    assert.match(readFileSync(join(d, 'AGENTS.md'), 'utf8'), /^# Projeto Exemplo/)
    rmSync(d, { recursive: true, force: true })
  })

  test('dry-run não grava nada', () => {
    const d = novoDir()
    const r = aplicar(d, planejar(base), { dryRun: true })
    assert.ok(r.criados.length > 10)
    assert.equal(existsSync(join(d, 'AGENTS.md')), false)
    rmSync(d, { recursive: true, force: true })
  })
})

describe('o que o init entrega passa nas próprias ferramentas do kit', () => {
  test('identidade: o esqueleto não contém IP, e-mail nem caminho de home', () => {
    const d = novoDir()
    aplicar(d, planejar(base))
    const r = varrer(d, { termos: [] })
    assert.deepEqual(r.achados, [])
    rmSync(d, { recursive: true, force: true })
  })
  test('fases: o esqueleto nasce INCOMPLETO, nunca aprovado', () => {
    const d = novoDir()
    aplicar(d, planejar(base))
    assert.equal(conferirFase(d, 'inception').ok, false)
    rmSync(d, { recursive: true, force: true })
  })
  test('os modelos de manifesto do kit continuam detectando o projeto Node que o init prepara', () => {
    const d = novoDir()
    aplicar(d, planejar(base))
    writeFileSync(join(d, 'package.json'), '{"name":"a"}')
    writeFileSync(join(d, 'yarn.lock'), '')
    assert.equal(detectTech(d)?.tech, 'node-yarn')
    rmSync(d, { recursive: true, force: true })
  })
})

describe('sincronia das instruções (mutantes)', () => {
  test('recém-criado está em sincronia', () => {
    const d = novoDir()
    aplicar(d, planejar(base))
    assert.deepEqual(conferirSincronia(d), [])
    rmSync(d, { recursive: true, force: true })
  })
  test('editar o AGENTS.md sem atualizar as cópias reprova, e --sync conserta', () => {
    const d = novoDir()
    aplicar(d, planejar(base))
    writeFileSync(join(d, 'AGENTS.md'), readFileSync(join(d, 'AGENTS.md'), 'utf8') + '\n- Regra nova.\n')
    const erros = conferirSincronia(d)
    assert.equal(erros.length, 2, JSON.stringify(erros))
    assert.match(erros.join(' '), /Copilot/)
    assert.match(erros.join(' '), /Kiro/)
    assert.deepEqual(sincronizar(d).sort(), ['.github/copilot-instructions.md', '.kiro/steering/aidlc.md'])
    assert.deepEqual(conferirSincronia(d), [])
    rmSync(d, { recursive: true, force: true })
  })
  test('editar só a cópia do Copilot reprova', () => {
    const d = novoDir()
    aplicar(d, planejar(base))
    writeFileSync(join(d, '.github/copilot-instructions.md'), 'regras proprias, divergentes')
    assert.equal(conferirSincronia(d).length, 1)
    rmSync(d, { recursive: true, force: true })
  })
  test('CLAUDE.md que deixa de importar o AGENTS.md reprova', () => {
    const d = novoDir()
    aplicar(d, planejar(base))
    writeFileSync(join(d, 'CLAUDE.md'), '# so Claude\n')
    assert.match(conferirSincronia(d).join(' '), /CLAUDE\.md/)
    rmSync(d, { recursive: true, force: true })
  })
})

describe('ferramenta aidlc-init', () => {
  test('cria, depois --check passa; divergência faz --check sair 1', () => {
    const d = novoDir()
    const roda = (...a) => spawnSync(process.execPath, [FERRAMENTA, d, ...a], { encoding: 'utf8' })
    const criar = roda('--name', 'Meu Projeto')
    assert.equal(criar.status, 0, criar.stderr)
    assert.equal(roda('--check').status, 0)
    writeFileSync(join(d, '.kiro/steering/aidlc.md'), '---\ninclusion: always\n---\n\noutro texto\n')
    assert.equal(roda('--check').status, 1)
    assert.equal(roda('--sync').status, 0)
    assert.equal(roda('--check').status, 0)
    rmSync(d, { recursive: true, force: true })
  })
})
