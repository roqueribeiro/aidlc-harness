#!/usr/bin/env node
/*
 * Adaptadores por ferramenta. O que estes testes travam:
 * - cada ferramenta que tem janela de pergunta recebe um comando (ou a skill) que a nomeia, para a
 *   Inception não virar lista numerada respondida digitando (o defeito visto no OpenCode);
 * - os arquivos gerados ficam no caminho que a ferramenta lê e não divergem em silêncio;
 * - `--tools all` produz um projeto em sincronia, e editar um comando gerado reprova o --check.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ADAPTADORES, FERRAMENTAS, planoDosAdaptadores, resolverFerramentas, corpoDoComando, textoDaSkill } from './adaptadores.mjs'
import { planejar, aplicar, conferirSincronia, sincronizar } from './init.mjs'

const base = { nome: 'App Exemplo', descricao: 'Exemplo.' }
const novo = () => mkdtempSync(join(tmpdir(), 'aidlc-adapt-'))

describe('cada ferramenta com janela de pergunta é mandada usá-la', () => {
  for (const [id, a] of Object.entries(ADAPTADORES)) {
    if (!a.ferramentaDePergunta || a.plugin) continue
    test(`${id}: ${a.ferramentaDePergunta} aparece no que a ferramenta lê`, () => {
      const textos = planoDosAdaptadores([id]).map((p) => p.conteudo).join('\n')
      assert.ok(textos.includes(a.ferramentaDePergunta), `${id} nunca cita ${a.ferramentaDePergunta}`)
    })
  }
  test('nenhum comando pede lista numerada; todos proíbem', () => {
    for (const id of FERRAMENTAS.filter((f) => ADAPTADORES[f].comandos)) {
      for (const fase of ['inception', 'construction']) {
        const c = corpoDoComando(fase, id)
        assert.doesNotMatch(c, /op[çc][õo]es numeradas/i, `${id}/${fase}`)
        if (ADAPTADORES[id].pergunta) assert.match(c, /Nunca escreva perguntas numeradas/, `${id}/${fase}`)
        else assert.match(c, /formato em texto da seção 5/, `${id}/${fase}`)
      }
    }
  })
  test('a skill de Inception cobre as ferramentas que só leem a skill', () => {
    const skill = textoDaSkill('inception')
    for (const [id, a] of Object.entries(ADAPTADORES)) {
      if (a.soSkill && a.ferramentaDePergunta) assert.ok(skill.includes(a.ferramentaDePergunta), id)
    }
    assert.match(skill, /Antigravity/)
  })
})

describe('arquivos no formato e no caminho de cada ferramenta', () => {
  const plano = planoDosAdaptadores(FERRAMENTAS)
  const de = (destino) => plano.find((p) => p.destino === destino)?.conteudo
  test('nenhum caminho repetido e nenhum placeholder do molde', () => {
    const destinos = plano.map((p) => p.destino)
    assert.equal(new Set(destinos).size, destinos.length)
    for (const p of plano) assert.doesNotMatch(p.conteudo, /\{\{[A-Z_]+\}\}/, p.destino)
  })
  test('OpenCode roda no agente principal (subagente tem a pergunta negada)', () => {
    assert.match(de('.opencode/commands/aidlc-inception.md'), /^---\ndescription: '[^']+'\nagent: 'build'\n---/)
  })
  test('Copilot: prompt file do VS Code no modo agent, com o pedido como input', () => {
    const t = de('.github/prompts/aidlc-inception.prompt.md')
    assert.match(t, /^---\ndescription: '[^']+'\nagent: 'agent'\n---/)
    assert.match(t, /\$\{input:pedido:/)
    assert.match(t, /#tool:vscode\/askQuestions/)
  })
  test('Gemini CLI: comando TOML com prompt multilinha e {{args}}, e GEMINI.md importando o AGENTS.md', () => {
    const t = de('.gemini/commands/aidlc/inception.toml')
    assert.match(t, /^description = "[^"\n]+"\nprompt = """\n[\s\S]+"""\n$/)
    assert.match(t, /\{\{args\}\}/)
    assert.equal(de('GEMINI.md'), '@AGENTS.md\n')
  })
  test('Kiro: steering manual (vira comando) e skill na pasta do Kiro', () => {
    assert.match(de('.kiro/steering/aidlc-inception.md'), /^---\ninclusion: 'manual'\n---/)
    assert.equal(de('.kiro/skills/aidlc-inception/SKILL.md'), textoDaSkill('inception'))
  })
  test('Junie aceita o argumento; Continue marca o prompt como invocável', () => {
    assert.match(de('.junie/commands/aidlc-inception.md'), /allowPromptArgument: true/)
    assert.match(de('.junie/commands/aidlc-inception.md'), /\$prompt/)
    assert.match(de('.continue/prompts/aidlc-inception.md'), /invokable: true/)
  })
  test('as skills vão para .agents/skills, o caminho que a maioria lê', () => {
    assert.equal(de('.agents/skills/aidlc-inception/SKILL.md'), textoDaSkill('inception'))
    assert.equal(de('.agents/skills/aidlc-construction/SKILL.md'), textoDaSkill('construction'))
  })
  test('só Claude Code não gera skill copiada (o plugin traz) e o guia lista o comando', () => {
    const p = planoDosAdaptadores(['claude'])
    assert.deepEqual(p.map((x) => x.destino), ['.aidlc/COMANDOS.md'])
    assert.match(p[0].conteudo, /\| Claude Code \| `\/inception` \|/)
  })
})

describe('escolha de ferramentas', () => {
  test('apelidos e "all"', () => {
    assert.deepEqual(resolverFerramentas(['Windsurf', 'vscode', 'claude', 'claude']), ['devin', 'copilot', 'claude'])
    assert.deepEqual(resolverFerramentas(['all']), FERRAMENTAS)
    assert.throws(() => resolverFerramentas(['notepad']), /desconhecida/)
  })
})

describe('projeto com todas as ferramentas', () => {
  test('nasce em sincronia; editar um comando gerado reprova; --sync conserta', () => {
    const d = novo()
    aplicar(d, planejar({ ...base, ferramentas: ['all'] }))
    assert.deepEqual(conferirSincronia(d), [])
    assert.ok(existsSync(join(d, '.opencode/commands/aidlc-inception.md')))
    const p = join(d, '.opencode/commands/aidlc-inception.md')
    writeFileSync(p, readFileSync(p, 'utf8').replace('question', 'lista numerada'))
    assert.match(conferirSincronia(d).join(' '), /\.opencode\/commands\/aidlc-inception\.md: diverge/)
    assert.ok(sincronizar(d).includes('.opencode/commands/aidlc-inception.md'))
    assert.deepEqual(conferirSincronia(d), [])
    rmSync(d, { recursive: true, force: true })
  })
  test('apagar uma skill copiada reprova', () => {
    const d = novo()
    aplicar(d, planejar({ ...base, ferramentas: ['opencode'] }))
    rmSync(join(d, '.agents/skills/aidlc-inception/SKILL.md'))
    assert.match(conferirSincronia(d).join(' '), /\.agents\/skills\/aidlc-inception\/SKILL\.md: falta/)
    rmSync(d, { recursive: true, force: true })
  })
})
