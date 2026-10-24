#!/usr/bin/env node
/**
 * check-docs-consistency.mjs, os documentos precisam concordar com o disco.
 *
 * Por que existe: documento e codigo divergem calados. Um README que diz "nove hooks" com oito
 * no disco, ou duas docs que discordam do numero de agentes, ninguem percebe ate alguem agir em
 * cima do numero errado.
 *
 * Numero escrito a mao envelhece em silencio, e envelhece justo quando o harness cresce.
 * Este check conta no disco e cobra o documento.
 *
 * AVISO por padrao, reprova so com --strict, e o motivo e o mesmo do check-actions: um check
 * de prosa nao consegue distinguir "o kit tem 4 agentes" de "dois dos quatro agentes do
 * plugin estavam quebrados", que e relato historico e verdadeiro. Mandar corrigir a segunda
 * frase e mandar falsificar registro. Vermelho falso ensina a ignorar o gate, entao ele
 * aponta e deixa a decisao com quem escreveu.
 *
 * Uso: node scripts/check-docs-consistency.mjs [--json] [--strict] [--root <pasta>]
 *
 * `--root` existe para o teste apontar um repositorio de mentira; o padrao e este repositorio.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootArg = process.argv.indexOf('--root')
const ROOT = rootArg > 0 ? resolve(process.argv[rootArg + 1]) : join(fileURLToPath(new URL('.', import.meta.url)), '..')
const KIT = join(ROOT, 'plugins/aidlc-harness')
const JSON_OUT = process.argv.includes('--json')
const STRICT = process.argv.includes('--strict')

const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : '')
const count = (dir, filtro) => (existsSync(join(KIT, dir)) ? readdirSync(join(KIT, dir)).filter(filtro).length : 0)

/* Os numeros medidos no disco, que sao a verdade. */
const medido = {
  hooks: count('hooks', (f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')),
  agentes: count('agents', (f) => f.endsWith('.md')),
  executaveis: count('tools', () => true),
  skills: existsSync(join(KIT, 'skills'))
    ? readdirSync(join(KIT, 'skills')).filter((d) => existsSync(join(KIT, 'skills', d, 'SKILL.md'))).length
    : 0,
  /* `_schema` e `_org` nao sao tecnologia viva, e `archived` tem status proprio. */
  tecnologias: existsSync(join(KIT, 'quality'))
    ? readdirSync(join(KIT, 'quality'))
        .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
        .map((f) => JSON.parse(readFileSync(join(KIT, 'quality', f), 'utf8')))
        .filter((m) => (m.status ?? 'active') !== 'archived').length
    : 0,
}

const NUM = {
  zero: 0, um: 1, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
}
const valor = (s) => (/^\d+$/.test(s) ? Number(s) : NUM[s.toLowerCase()])

/*
 * Cada regra procura "<numero> <substantivo>" nos documentos normativos e compara com o
 * disco. Numero por extenso conta ("nine hooks").
 */
const REGRAS = [
  { chave: 'hooks', rx: /\b([\w]+)\s+hooks\b/gi, label: 'hooks em hooks/' },
  { chave: 'agentes', rx: /\b([\w]+)\s+(?:agentes|agents)\b/gi, label: 'agentes em agents/' },
  { chave: 'skills', rx: /\b([\w]+)\s+skills\b/gi, label: 'skills em skills/' },
  { chave: 'executaveis', rx: /\b([\w]+)\s+(?:executaveis|execut[aá]veis|executables)\b/gi, label: 'executaveis em tools/' },
  { chave: 'tecnologias', rx: /\b([\w]+)\s+(?:tecnologias|technologies)\b/gi, label: 'manifestos vivos em quality/' },
]

/*
 * So conta como AFIRMACAO DE INVENTARIO quando o entorno fala do kit.
 *
 * A primeira versao casava qualquer "<numero> hooks" em prosa e acusou "um hook de plugin"
 * como divergencia. Vermelho falso e o que ensina alguem a ignorar o gate, entao o filtro de
 * contexto vale mais que a cobertura: e melhor deixar passar uma frase reescrita do que
 * reprovar uma que estava certa.
 */
const SINAL = /(kit|plugin|harness|hooks\.json|hooks\/|agents\/|skills\/|tools\/|quality\/|no Stop|tool layer|enforc|determinist|viva|live|reconhecid|criterio de aceite|acceptance)/i
const JANELA = 90

/*
 * Todos os documentos, nao so os do topo: a prosa errada costuma estar onde o check nao olha.
 * O CHANGELOG fica de fora de proposito, porque e registro historico: "tinha 5 hooks" ali e
 * verdade. `docs/PROMPTS.md` e gerado dos comandos e tambem nao afirma inventario.
 */
const DOCS = [
  'AGENTS.md',
  'CLAUDE.md',
  'README.md',
  'CONTRIBUTING.md',
  'OPERATING-MODEL.md',
  'plugins/aidlc-harness/README.md',
  'README.pt-BR.md',
  ...['docs', 'docs/pt-BR'].flatMap((pasta) =>
    existsSync(join(ROOT, pasta))
      ? readdirSync(join(ROOT, pasta))
          .filter((f) => f.endsWith('.md') && f !== 'PROMPTS.md')
          .sort()
          .map((f) => `${pasta}/${f}`)
      : [],
  ),
]
const problemas = []

for (const doc of DOCS) {
  const texto = read(doc)
  if (!texto) continue
  /* Bloco de codigo e saida de comando colada: numero de ontem ali e registro, nao afirmacao. */
  const prosa = texto.replace(/```[\s\S]*?```/g, ' ')
  for (const regra of REGRAS) {
    for (const m of prosa.matchAll(regra.rx)) {
      const v = valor(m[1])
      if (v === undefined || Number.isNaN(v)) continue
      /* Singular generico ("um hook", "one hook") nunca e contagem de inventario. */
      if (v < 2) continue
      const ctx = prosa.slice(Math.max(0, m.index - JANELA), m.index + m[0].length + JANELA)
      if (!SINAL.test(ctx)) continue
      if (v !== medido[regra.chave]) {
        problemas.push({ doc, trecho: m[0].trim(), declarado: v, medido: medido[regra.chave], o_que: regra.label })
      }
    }
  }
}

if (JSON_OUT) {
  console.log(JSON.stringify({ ok: problemas.length === 0, medido, problemas, strict: STRICT }))
  process.exit(problemas.length && STRICT ? 1 : 0)
}

if (!problemas.length) {
  console.log(
    `ok, documentos batem com o disco: ${medido.hooks} hooks, ${medido.agentes} agentes, ${medido.skills} skills, ${medido.executaveis} executaveis, ${medido.tecnologias} tecnologias.`,
  )
  process.exit(0)
}

console.error(`${STRICT ? 'documento contradiz o disco' : 'AVISO, documento talvez contradiga o disco'}:\n`)
for (const p of problemas) {
  console.error(`  ${p.doc}`)
  console.error(`    "${p.trecho}" diz ${p.declarado}, o disco tem ${p.medido} (${p.o_que})`)
}
console.error('\nConfira na fonte certa: o disco manda, a prosa se ajusta.')
console.error('Se a frase for relato historico e nao inventario, ela esta certa e este aviso e ruido.')
process.exit(STRICT ? 1 : 0)
