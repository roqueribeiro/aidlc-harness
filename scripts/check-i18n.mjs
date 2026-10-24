#!/usr/bin/env node
/**
 * check-i18n.mjs: os dois idiomas da documentacao andam juntos, e nenhum envelhece calado.
 *
 * O ingles e a versao principal (docs/, README.md); o portugues do Brasil e o par
 * (docs/pt-BR/, README.pt-BR.md). Par diverge de tres jeitos que ninguem ve ate um leitor agir
 * em cima:
 *
 *   1. FALTA: um documento novo entra em ingles e nao ganha o par em portugues.
 *   2. FORMA: o par existe, mas perdeu uma secao, uma tabela ou um bloco de codigo no caminho.
 *   3. DERIVA: o ingles mudou depois da traducao e o portugues continua dizendo o antigo.
 *      A fonte e um hash do original, gravado em docs/pt-BR/.i18n.json no momento em que o par
 *      foi conferido. Se o original muda, o check reprova ate o par ser revisto e o hash
 *      regravado com `--update` (so depois de revisar: o comando nao traduz nada).
 *   E mais um: portugues que sobrou na prosa do ingles (traducao esquecida pela metade).
 *
 * Uso: node scripts/check-i18n.mjs [--json] [--update] [--root <pasta>]
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const rootArg = argv.indexOf('--root')
const RAIZ = rootArg >= 0 ? resolve(argv[rootArg + 1]) : join(fileURLToPath(new URL('.', import.meta.url)), '..')
const JSON_OUT = argv.includes('--json')
const ATUALIZAR = argv.includes('--update') || argv.includes('--atualizar')

/** Cada documento em ingles (principal) e o seu par em portugues. Documento novo entra aqui. */
export const PARES = {
  'README.md': 'README.pt-BR.md',
  'OPERATING-MODEL.md': 'docs/pt-BR/OPERATING-MODEL.md',
  'CONTRIBUTING.md': 'docs/pt-BR/CONTRIBUTING.md',
  'docs/INDEX.md': 'docs/pt-BR/INDEX.md',
  'docs/AIDLC.md': 'docs/pt-BR/AIDLC.md',
  'docs/ARCHITECTURE.md': 'docs/pt-BR/ARQUITETURA.md',
  'docs/STRATEGY.md': 'docs/pt-BR/ESTRATEGIA.md',
  'docs/REFERENCE.md': 'docs/pt-BR/REFERENCIA.md',
  'docs/INTEGRATIONS.md': 'docs/pt-BR/INTEGRACOES.md',
  'docs/ROQUESHIELD.md': 'docs/pt-BR/ROQUESHIELD.md',
  'docs/ADAPTERS.md': 'docs/pt-BR/ADAPTADORES.md',
  'docs/GETTING-STARTED.md': 'docs/pt-BR/COMECAR.md',
  'docs/EXTENDING.md': 'docs/pt-BR/ESTENDER.md',
  'docs/WHEN-IT-BREAKS.md': 'docs/pt-BR/QUANDO-QUEBRA.md',
  'docs/GLOSSARY.md': 'docs/pt-BR/GLOSSARIO.md',
  'docs/REGULATED.md': 'docs/pt-BR/REGULADO.md',
}
/** Estes dois ficam na raiz (o GitHub so le la): o portugues e uma secao no fim do mesmo arquivo. */
export const SECAO_NO_FIM = ['SECURITY.md', 'CODE_OF_CONDUCT.md']
/** Gerados a partir de outra fonte, so em portugues. */
export const SO_PT = ['docs/pt-BR/PROMPTS.md']

const ARQ_HASH = 'docs/pt-BR/.i18n.json'

const le = (raiz, p) => (existsSync(join(raiz, p)) ? readFileSync(join(raiz, p), 'utf8') : null)
export const hashDe = (texto) => createHash('sha256').update(texto).digest('hex').slice(0, 16)

/** Tira os blocos de codigo. */
function semBlocos(texto) {
  let dentro = false
  const out = []
  for (const ln of texto.split('\n')) {
    if (/^\s*```/.test(ln)) {
      dentro = !dentro
      continue
    }
    if (!dentro) out.push(ln)
  }
  return out
}

export function forma(texto) {
  const linhas = texto.split('\n')
  let dentro = false
  let titulos = 0
  let blocos = 0
  let tabelas = 0
  for (const ln of linhas) {
    if (/^\s*```/.test(ln)) {
      dentro = !dentro
      if (dentro) blocos++
      continue
    }
    if (dentro) continue
    if (/^#{1,6}\s/.test(ln)) titulos++
    if (/^\|/.test(ln)) tabelas++
  }
  const aidlc = new Set(texto.match(/\baidlc-[a-z]+\b(?!-)/g) || [])
  return { titulos, blocos, tabelas, aidlc }
}

const PT = [' não ', ' para o ', ' para a ', ' com o ', ' com a ', ' uma ', ' você ', ' são ', ' está ', ' dos ', ' das ', ' pelo ', ' pela ', ' mas ', ' quando ', ' sem ']
/** Linhas da prosa em ingles com cara de portugues: 2 ou mais marcas na mesma linha. */
export function portuguesSobrando(texto) {
  const achados = []
  semBlocos(texto).forEach((ln, i) => {
    // citacao entre crases e aspas e saida literal ou termo dito de proposito
    const prosa = ` ${ln.replace(/`[^`]*`/g, ' ').replace(/"[^"]*"/g, ' ').replace(/\*[^*]*\*/g, ' ')} `.toLowerCase()
    const n = PT.filter((m) => prosa.includes(m)).length
    if (n >= 2) achados.push(ln.trim().slice(0, 90))
  })
  return achados
}

export function verificar(raiz) {
  const problemas = []
  const hashes = JSON.parse(le(raiz, ARQ_HASH) || '{}')
  for (const [en, pt] of Object.entries(PARES)) {
    const tEn = le(raiz, en)
    if (tEn === null) {
      problemas.push(`${en}: documento principal nao existe (remova do PARES ou crie)`)
      continue
    }
    const tPt = le(raiz, pt)
    if (tPt === null) {
      problemas.push(`${en}: falta o par em portugues ${pt}`)
      continue
    }
    const a = forma(tEn)
    const b = forma(tPt)
    for (const k of ['titulos', 'blocos', 'tabelas']) {
      if (a[k] !== b[k]) problemas.push(`${pt}: ${k} ${b[k]} != ${a[k]} no original (${en}); o par perdeu ou acrescentou estrutura`)
    }
    const falta = [...a.aidlc].filter((x) => !b.aidlc.has(x))
    const sobra = [...b.aidlc].filter((x) => !a.aidlc.has(x))
    if (falta.length) problemas.push(`${pt}: nao cita ${falta.join(', ')}, que o original cita`)
    if (sobra.length) problemas.push(`${pt}: cita ${sobra.join(', ')}, que o original nao cita`)
    const rel = relative(dirname(pt), en).split('\\').join('/')
    if (!tPt.includes(`](${rel})`) && !tPt.includes(`](${rel}#`)) {
      problemas.push(`${pt}: falta o link para o original em ingles (${rel})`)
    }
    for (const ln of portuguesSobrando(tEn)) problemas.push(`${en}: portugues na prosa: "${ln}"`)
    if (hashes[en] === undefined) problemas.push(`${en}: sem hash em ${ARQ_HASH} (rode --update depois de conferir o par)`)
    else if (hashes[en] !== hashDe(tEn)) problemas.push(`${en}: mudou depois da traducao; reveja ${pt} e rode --update`)
  }
  for (const f of SECAO_NO_FIM) {
    const t = le(raiz, f)
    if (t === null) continue
    if (!/^## Português\s*$/m.test(t)) problemas.push(`${f}: falta a secao "## Português" no fim`)
  }
  return problemas
}

export function atualizar(raiz) {
  const out = {}
  for (const en of Object.keys(PARES)) {
    const t = le(raiz, en)
    if (t !== null) out[en] = hashDe(t)
  }
  writeFileSync(join(raiz, ARQ_HASH), JSON.stringify(out, null, 2) + '\n')
  return out
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (ATUALIZAR) {
    const o = atualizar(RAIZ)
    console.log(`hashes gravados em ${ARQ_HASH} para ${Object.keys(o).length} documentos. Rode so depois de rever o par em portugues.`)
    process.exit(0)
  }
  const problemas = verificar(RAIZ)
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: problemas.length === 0, problemas }))
    process.exit(problemas.length ? 1 : 0)
  }
  if (problemas.length) {
    console.error('os dois idiomas da documentacao nao andam juntos:\n' + problemas.map((p) => '  ' + p).join('\n'))
    process.exit(1)
  }
  console.log(`ok, ${Object.keys(PARES).length} documentos em ingles e os pares em portugues andam juntos (forma, hash e prosa).`)
}
