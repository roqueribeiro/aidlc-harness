#!/usr/bin/env node
/*
 * Os comandos de fase do Claude Code usam a janela de perguntas, não a lista numerada.
 *
 * Em 06/11/2026 o /inception da v0.1 mandava "opções numeradas" em até 4 rodadas de 5 perguntas,
 * e era isso que fazia o fluxo parecer uma URA. Agora o método mora nas skills aidlc-inception e
 * aidlc-construction; os comandos só fixam a ferramenta de pergunta. Este teste trava o retrocesso.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = join(dirname(fileURLToPath(import.meta.url)), '..')
const ler = (rel) => readFileSync(join(KIT, rel), 'utf8')
const frente = (t) => /^---\n([\s\S]*?)\n---/.exec(t)?.[1] ?? ''

for (const fase of ['inception', 'construction']) {
  test(`/${fase}: libera e exige AskUserQuestion, aponta a skill e não pede lista numerada`, () => {
    const t = ler(`commands/${fase}.md`)
    assert.match(frente(t), /allowed-tools:.*\bAskUserQuestion\b/)
    assert.match(frente(t), /allowed-tools:.*\bSkill\b/)
    assert.match(t, new RegExp(`aidlc-harness:aidlc-${fase}`))
    assert.match(t.split('---').slice(2).join('---'), /AskUserQuestion/)
    assert.doesNotMatch(t, /op[çc][õo]es numeradas/i)
  })

  test(`skill aidlc-${fase}: nome igual à pasta e descrição que diz quando usar`, () => {
    const f = frente(ler(`skills/aidlc-${fase}/SKILL.md`))
    assert.match(f, new RegExp(`^name: aidlc-${fase}$`, 'm'))
    assert.match(f, /^description: '.*Use quando/m)
  })
}

test('a skill de Inception limita a 5 perguntas, recomenda primeiro e nomeia a ferramenta de cada ferramenta', () => {
  const t = ler('skills/aidlc-inception/SKILL.md')
  assert.match(t, /no máximo 5 perguntas/)
  assert.match(t, /\(Recomendado\)/)
  for (const nome of ['AskUserQuestion', 'question', 'askQuestions', 'ask_user', 'ask_user_question', 'request_user_input', 'ask_question', 'AskQuestion']) {
    assert.ok(t.includes('`' + nome + '`'), nome)
  }
  assert.match(t, /"ok" aceita todas as recomendações/)
})
