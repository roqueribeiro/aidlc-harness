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

/*
 * Repositório que já tem AGENTS.md (o caso comum). Antes o init mantinha o arquivo do time e gerava
 * as cópias do molde: `--check` reprovava na primeira execução e as regras nunca chegavam ao AGENTS.md.
 */
describe('AGENTS.md que já existe (bloco gerenciado)', () => {
  const TIME = '# Projeto do time\n\nRegras do time: usar pnpm.\n'
  test('o init acrescenta o bloco ao fim, preserva o texto do time e já nasce em sincronia', () => {
    const d = novoDir()
    writeFileSync(join(d, 'AGENTS.md'), TIME)
    const r = aplicar(d, planejar({ ...base, agentsExistente: TIME }))
    assert.deepEqual(r.mesclados, ['AGENTS.md'])
    const txt = readFileSync(join(d, 'AGENTS.md'), 'utf8')
    assert.ok(txt.startsWith(TIME.trimEnd()), 'o texto do time continua no começo, intacto')
    assert.match(txt, /<!-- aidlc:inicio[\s\S]*Pronto exige evidência[\s\S]*<!-- aidlc:fim -->/)
    assert.deepEqual(conferirSincronia(d), [])
    assert.match(readFileSync(join(d, '.github/copilot-instructions.md'), 'utf8'), /Regras do time: usar pnpm/, 'a cópia do Copilot sai do AGENTS.md final')
    rmSync(d, { recursive: true, force: true })
  })
  test('rodar o init de novo não duplica o bloco', () => {
    const d = novoDir()
    writeFileSync(join(d, 'AGENTS.md'), TIME)
    aplicar(d, planejar({ ...base, agentsExistente: TIME }))
    const depois = readFileSync(join(d, 'AGENTS.md'), 'utf8')
    aplicar(d, planejar({ ...base, agentsExistente: depois }))
    assert.equal(readFileSync(join(d, 'AGENTS.md'), 'utf8'), depois)
    assert.equal(depois.split('<!-- aidlc:inicio').length - 1, 1)
    rmSync(d, { recursive: true, force: true })
  })
  test('AGENTS.md sem o bloco reprova no --check (mutante: tirar o bloco)', () => {
    const d = novoDir()
    aplicar(d, planejar(base))
    const txt = readFileSync(join(d, 'AGENTS.md'), 'utf8').replace(/<!-- aidlc:inicio[\s\S]*<!-- aidlc:fim -->\n?/, '')
    writeFileSync(join(d, 'AGENTS.md'), txt)
    assert.match(conferirSincronia(d).join(' '), /sem o bloco do aidlc/)
    rmSync(d, { recursive: true, force: true })
  })
  test('--sync troca só o miolo do bloco e deixa o texto do time', () => {
    const d = novoDir()
    writeFileSync(join(d, 'AGENTS.md'), TIME)
    aplicar(d, planejar({ ...base, agentsExistente: TIME }))
    const velho = readFileSync(join(d, 'AGENTS.md'), 'utf8').replace('Pronto exige evidência', 'Regra antiga do kit')
    writeFileSync(join(d, 'AGENTS.md'), velho + '\n## Depois do bloco\n')
    assert.ok(sincronizar(d).includes('AGENTS.md (bloco aidlc)'))
    const novo = readFileSync(join(d, 'AGENTS.md'), 'utf8')
    assert.match(novo, /Pronto exige evidência/)
    assert.doesNotMatch(novo, /Regra antiga do kit/)
    assert.match(novo, /Regras do time: usar pnpm[\s\S]*## Depois do bloco/)
    assert.deepEqual(conferirSincronia(d), [])
    rmSync(d, { recursive: true, force: true })
  })
  test('pela linha de comando: repo com AGENTS.md próprio sai do init com --check verde', () => {
    const d = novoDir()
    writeFileSync(join(d, 'AGENTS.md'), TIME)
    const init = spawnSync(process.execPath, [FERRAMENTA, d], { encoding: 'utf8' })
    assert.equal(init.status, 0, init.stdout + init.stderr)
    assert.match(init.stdout, /atualizado\s+AGENTS\.md/)
    const chk = spawnSync(process.execPath, [FERRAMENTA, d, '--check'], { encoding: 'utf8' })
    assert.equal(chk.status, 0, chk.stdout)
    rmSync(d, { recursive: true, force: true })
  })
})

describe('CI gerado', () => {
  test('instala o trivy fixado por commit e os passos da tecnologia detectada', () => {
    const d = novoDir()
    writeFileSync(join(d, 'go.mod'), 'module exemplo\n')
    aplicar(d, planejar({ ...base, tech: detectTech(d) }))
    const yml = readFileSync(join(d, '.github/workflows/aidlc-gate.yml'), 'utf8')
    assert.match(yml, /aquasecurity\/setup-trivy@[0-9a-f]{40}/)
    assert.match(yml, /\n      - uses: actions\/setup-go@v5\n        with:\n          go-version-file: go.mod/)
    assert.doesNotMatch(yml, /\{\{/)
    rmSync(d, { recursive: true, force: true })
  })
  test('sem tecnologia, o CI deixa o lembrete em vez de inventar passo', () => {
    const yml = planejar(base).find((p) => p.destino.endsWith('aidlc-gate.yml')).conteudo
    assert.match(yml, /Nenhuma tecnologia reconhecida/)
    assert.doesNotMatch(yml, /setup-go|setup-java|yarn install/)
  })
})
