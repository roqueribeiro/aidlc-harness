#!/usr/bin/env node
/**
 * check-i18n.mjs: a documentacao em ingles acompanha a em portugues, e nao envelhece calada.
 *
 * O portugues e a versao principal. O ingles e traducao, e traducao diverge de tres jeitos que
 * ninguem ve ate um leitor agir em cima:
 *
 *   1. FALTA: um documento novo entra em portugues e nao ganha o par em ingles.
 *   2. FORMA: o par existe, mas perdeu uma secao, uma tabela ou um bloco de codigo no caminho.
 *   3. DERIVA: o portugues mudou depois da traducao e o ingles continua dizendo o antigo.
 *      A fonte e um hash do original, gravado em docs/en/.i18n.json no momento em que o ingles
 *      foi conferido. Se o original muda, o check reprova ate o ingles ser revisto e o hash
 *      regravado com `--atualizar` (so depois de revisar: o comando nao traduz nada).
 *   E mais um: portugues que sobrou na prosa do ingles (traducao esquecida pela metade).
 *
 * Uso: node scripts/check-i18n.mjs [--json] [--atualizar] [--root <pasta>]
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const rootArg = argv.indexOf('--root')
const RAIZ = rootArg >= 0 ? resolve(argv[rootArg + 1]) : join(fileURLToPath(new URL('.', import.meta.url)), '..')
const JSON_OUT = argv.includes('--json')
const ATUALIZAR = argv.includes('--atualizar')

/** Cada documento em portugues e o seu par em ingles. Documento novo entra aqui. */
export const PARES = {
  'README.md': 'README.en.md',
  'OPERATING-MODEL.md': 'docs/en/OPERATING-MODEL.md',
  'CONTRIBUTING.md': 'docs/en/CONTRIBUTING.md',
  'docs/INDEX.md': 'docs/en/INDEX.md',
  'docs/AIDLC.md': 'docs/en/AIDLC.md',
  'docs/ARQUITETURA.md': 'docs/en/ARCHITECTURE.md',
  'docs/ESTRATEGIA.md': 'docs/en/STRATEGY.md',
  'docs/REFERENCIA.md': 'docs/en/REFERENCE.md',
  'docs/INTEGRACOES.md': 'docs/en/INTEGRATIONS.md',
  'docs/ROQUESHIELD.md': 'docs/en/ROQUESHIELD.md',
  'docs/ADAPTADORES.md': 'docs/en/ADAPTERS.md',
  'docs/COMECAR.md': 'docs/en/GETTING-STARTED.md',
  'docs/ESTENDER.md': 'docs/en/EXTENDING.md',
  'docs/QUANDO-QUEBRA.md': 'docs/en/WHEN-IT-BREAKS.md',
  'docs/GLOSSARIO.md': 'docs/en/GLOSSARY.md',
  'docs/REGULADO.md': 'docs/en/REGULATED.md',
}
/** Estes dois ficam na raiz (o GitHub so le la): o ingles e uma secao no fim do mesmo arquivo. */
export const SECAO_NO_FIM = ['SECURITY.md', 'CODE_OF_CONDUCT.md']
/** Gerados a partir de outra fonte, so em portugues. */
export const SO_PT = ['docs/PROMPTS.md']

const ARQ_HASH = 'docs/en/.i18n.json'

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
  for (const [pt, en] of Object.entries(PARES)) {
    const tPt = le(raiz, pt)
    if (tPt === null) {
      problemas.push(`${pt}: documento em portugues nao existe (remova do PARES ou crie)`)
      continue
    }
    const tEn = le(raiz, en)
    if (tEn === null) {
      problemas.push(`${pt}: falta o par em ingles ${en}`)
      continue
    }
    const a = forma(tPt)
    const b = forma(tEn)
    for (const k of ['titulos', 'blocos', 'tabelas']) {
      if (a[k] !== b[k]) problemas.push(`${en}: ${k} ${b[k]} != ${a[k]} no original (${pt}); a traducao perdeu ou acrescentou estrutura`)
    }
    const falta = [...a.aidlc].filter((x) => !b.aidlc.has(x))
    const sobra = [...b.aidlc].filter((x) => !a.aidlc.has(x))
    if (falta.length) problemas.push(`${en}: nao cita ${falta.join(', ')}, que o original cita`)
    if (sobra.length) problemas.push(`${en}: cita ${sobra.join(', ')}, que o original nao cita`)
    if (!tEn.includes(`](../${pt.split('/').pop()})`) && !tEn.includes(`](${pt})`) && !tEn.includes(`](../../${pt})`) && !tEn.includes(`](${pt.split('/').pop()})`)) {
      problemas.push(`${en}: falta a linha que aponta para o original em portugues (${pt})`)
    }
    for (const ln of portuguesSobrando(tEn)) problemas.push(`${en}: portugues na prosa: "${ln}"`)
    if (hashes[pt] === undefined) problemas.push(`${pt}: sem hash em ${ARQ_HASH} (rode --atualizar depois de conferir o ingles)`)
    else if (hashes[pt] !== hashDe(tPt)) problemas.push(`${pt}: mudou depois da traducao; reveja ${en} e rode --atualizar`)
  }
  for (const f of SECAO_NO_FIM) {
    const t = le(raiz, f)
    if (t === null) continue
    if (!/^## English\s*$/m.test(t)) problemas.push(`${f}: falta a secao "## English" no fim`)
  }
  return problemas
}

export function atualizar(raiz) {
  const out = {}
  for (const pt of Object.keys(PARES)) {
    const t = le(raiz, pt)
    if (t !== null) out[pt] = hashDe(t)
  }
  writeFileSync(join(raiz, ARQ_HASH), JSON.stringify(out, null, 2) + '\n')
  return out
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (ATUALIZAR) {
    const o = atualizar(RAIZ)
    console.log(`hashes gravados em ${ARQ_HASH} para ${Object.keys(o).length} documentos. Rode so depois de rever o ingles.`)
    process.exit(0)
  }
  const problemas = verificar(RAIZ)
  if (JSON_OUT) {
    console.log(JSON.stringify({ ok: problemas.length === 0, problemas }))
    process.exit(problemas.length ? 1 : 0)
  }
  if (problemas.length) {
    console.error('a documentacao em ingles nao acompanha a em portugues:\n' + problemas.map((p) => '  ' + p).join('\n'))
    process.exit(1)
  }
  console.log(`ok, ${Object.keys(PARES).length} documentos em ingles acompanham o portugues (forma, hash e prosa).`)
}
