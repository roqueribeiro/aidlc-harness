#!/usr/bin/env node
/**
 * check-reference.mjs: a referencia cobre tudo o que existe, e a prosa so cita o que existe.
 *
 * Dois defeitos que a documentacao grande tem, e que ninguem ve ate alguem agir em cima:
 *
 *   1. FALTA: um hook, executavel, comando, agente ou skill entra no disco e nao entra em
 *      docs/REFERENCIA.md. A referencia envelhece calada, e e justo ela que as pessoas abrem
 *      para saber o que o kit faz.
 *   2. FANTASMA: a prosa cita `aidlc-phase approve`, que nunca existiu. Aconteceu aqui: um
 *      diagrama e um documento descreveram, com todos os detalhes, um subcomando que o
 *      executavel nao tem.
 *
 * O check compara a referencia com o disco (1) e todo comando `aidlc-*` citado nos documentos
 * com os executaveis reais e seus subcomandos (2). Sai 1 em qualquer divergencia.
 *
 * Uso: node scripts/check-reference.mjs [--json] [--root <pasta>]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const rootArg = argv.indexOf('--root')
const RAIZ = rootArg >= 0 ? resolve(argv[rootArg + 1]) : join(fileURLToPath(new URL('.', import.meta.url)), '..')
const KIT = join(RAIZ, 'plugins/aidlc-harness')
const JSON_OUT = argv.includes('--json')

const lista = (dir, filtro = () => true) => (existsSync(join(KIT, dir)) ? readdirSync(join(KIT, dir)).filter(filtro).sort() : [])

export const inventario = {
  hooks: lista('hooks', (f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).map((f) => f.replace(/\.mjs$/, '')),
  tools: lista('tools'),
  comandos: lista('commands', (f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')),
  agentes: lista('agents', (f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')),
  skills: lista('skills', (d) => existsSync(join(KIT, 'skills', d, 'SKILL.md'))),
}

/**
 * Subcomandos que cada executavel aceita. A fonte e o proprio executavel; esta tabela e o que o
 * check cobra da prosa, e o teste confere que ela acompanha o uso real.
 */
export const SUBCOMANDOS = {
  'aidlc-phase': ['status', 'check'],
  'aidlc-graph': ['blast', 'diagram', 'validate', 'list'],
  'aidlc-secrets': ['status', 'set', 'template', 'import', 'exec', 'scrub', 'help'],
}

const problemas = []

// 1. FALTA ----------------------------------------------------------------------------------
// A referencia em portugues e a em ingles cobram o mesmo inventario.
for (const rel of ['docs/REFERENCIA.md', 'docs/en/REFERENCE.md']) {
  const refPath = join(RAIZ, rel)
  if (!existsSync(refPath)) {
    if (rel === 'docs/REFERENCIA.md') problemas.push('docs/REFERENCIA.md nao existe')
    else problemas.push(`${rel} nao existe (a referencia em ingles cobre o mesmo inventario)`)
    continue
  }
  const ref = readFileSync(refPath, 'utf8')
  const cobra = (rotulo, nomes, forma) => {
    for (const n of nomes) {
      if (!ref.includes(forma(n))) problemas.push(`${rel} nao documenta ${rotulo} "${n}" (esperava "${forma(n)}")`)
    }
  }
  cobra('o hook', inventario.hooks, (n) => `\`${n}\``)
  cobra('o executavel', inventario.tools, (n) => `\`${n}\``)
  cobra('o comando', inventario.comandos, (n) => `\`/${n}\``)
  cobra('o agente', inventario.agentes, (n) => `\`${n}\``)
  cobra('a skill', inventario.skills, (n) => `\`${n}\``)
}

// 2. FANTASMA -------------------------------------------------------------------------------
const nomesValidos = new Set([...inventario.tools, ...inventario.skills, 'aidlc-harness'])
const docs = [
  'README.md',
  'README.en.md',
  'CONTRIBUTING.md',
  'AGENTS.md',
  'OPERATING-MODEL.md',
  ...['docs', 'docs/en'].flatMap((pasta) =>
    existsSync(join(RAIZ, pasta))
      ? readdirSync(join(RAIZ, pasta))
          .filter((f) => f.endsWith('.md'))
          .sort()
          .map((f) => `${pasta}/${f}`)
      : [],
  ),
]
for (const doc of docs) {
  const p = join(RAIZ, doc)
  if (!existsSync(p)) continue
  let emBloco = false
  readFileSync(p, 'utf8')
    .split('\n')
    .forEach((ln, i) => {
      if (/^\s*```/.test(ln)) emBloco = !emBloco
      for (const m of ln.matchAll(/\baidlc-[a-z]+\b(?!-)/g)) {
        const nome = m[0]
        const resto = ln.slice(m.index + nome.length)
        // aidlc-gate.yml, aidlc-gate.cmd: arquivo, nao comando. aidlc-harness.git: URL.
        if (/^\.(yml|cmd|git)\b/.test(resto)) continue
        if (!nomesValidos.has(nome)) {
          problemas.push(`${doc}:${i + 1}  cita "${nome}", que nao e executavel nem skill do kit`)
          continue
        }
        // Subcomando so e cobrado em codigo (bloco ou `inline`): em prosa, "aidlc-phase reprova" e verbo.
        const antes = ln.slice(0, m.index)
        const emCodigo = emBloco || antes.split('`').length % 2 === 0
        const subs = SUBCOMANDOS[nome]
        const prox = /^\s+([a-z][a-z-]*)\b/.exec(resto)
        if (emCodigo && subs && prox && !subs.includes(prox[1])) {
          problemas.push(`${doc}:${i + 1}  "${nome} ${prox[1]}": ${nome} nao tem o subcomando "${prox[1]}" (tem: ${subs.join(', ')})`)
        }
      }
    })
}

if (JSON_OUT) {
  console.log(JSON.stringify({ ok: problemas.length === 0, problemas }))
  process.exit(problemas.length ? 1 : 0)
}
if (problemas.length) {
  console.error('referencia e documentos nao batem com o disco:\n' + problemas.map((p) => '  ' + p).join('\n'))
  process.exit(1)
}
console.log(
  `ok, REFERENCIA.md cobre ${inventario.hooks.length} hooks, ${inventario.tools.length} executaveis, ${inventario.comandos.length} comandos, ${inventario.agentes.length} agentes e ${inventario.skills.length} skills; nenhum comando fantasma na prosa.`,
)
