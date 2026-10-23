#!/usr/bin/env node
/**
 * check-links.mjs: todo link relativo da documentacao aponta para algo que existe.
 *
 * Documentacao grande quebra link calada: um arquivo renomeia, um titulo muda, e o indice continua
 * apontando para o lugar antigo. Este check le cada .md versionado, e para cada `[texto](destino)`
 * relativo confere o arquivo e, quando ha `#ancora`, o titulo que a gera (com a regra de slug do
 * GitHub). Link externo (http, https, mailto) nao e conferido: sem rede, sem opiniao.
 *
 * Imagem conta: `![alt](caminho)` e `<img src>` e `srcset` relativos tambem.
 *
 * Uso: node scripts/check-links.mjs [--root <pasta>]
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const argv = process.argv.slice(2)
const i = argv.indexOf('--root')
const RAIZ = i >= 0 ? resolve(argv[i + 1]) : join(fileURLToPath(new URL('.', import.meta.url)), '..')
const PULA = new Set(['node_modules', '.git', 'fresh'])

function markdowns(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (PULA.has(e.name)) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) markdowns(p, out)
    else if (e.isFile() && e.name.endsWith('.md')) out.push(p)
  }
  return out
}

/** O slug que o GitHub gera para um titulo: minusculas, sem pontuacao (exceto - e _), espaco vira hifen. */
export function slug(titulo) {
  return titulo
    .trim()
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-')
}

function ancoras(texto) {
  const set = new Set()
  const usados = new Map()
  let bloco = false
  for (const ln of texto.split('\n')) {
    if (/^\s*```/.test(ln)) bloco = !bloco
    if (bloco) continue
    const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(ln)
    if (!m) continue
    let s = slug(m[1].replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'))
    const n = usados.get(s) ?? 0
    usados.set(s, n + 1)
    set.add(n ? `${s}-${n}` : s)
  }
  return set
}

const problemas = []
const cacheAncoras = new Map()
const ancorasDe = (arquivo) => {
  if (!cacheAncoras.has(arquivo)) cacheAncoras.set(arquivo, ancoras(readFileSync(arquivo, 'utf8')))
  return cacheAncoras.get(arquivo)
}

for (const arquivo of markdowns(RAIZ)) {
  const rel = relative(RAIZ, arquivo).split(sep).join('/')
  const texto = readFileSync(arquivo, 'utf8')
  // blocos de codigo guardam exemplos, nao links
  const prosa = texto.replace(/```[\s\S]*?```/g, (b) => b.replace(/[^\n]/g, ' '))
  const destinos = []
  prosa.split('\n').forEach((ln, n) => {
    for (const m of ln.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) destinos.push([n + 1, m[1]])
    for (const m of ln.matchAll(/(?:src|srcset|href)="([^"]+)"/g)) destinos.push([n + 1, m[1]])
  })
  for (const [linha, bruto] of destinos) {
    if (/^(https?:|mailto:|tel:|data:|\/\/)/i.test(bruto)) continue
    const [caminho, ancora] = bruto.split('#')
    const alvo = caminho ? resolve(dirname(arquivo), decodeURIComponent(caminho)) : arquivo
    if (!alvo.startsWith(RAIZ)) {
      problemas.push(`${rel}:${linha}  ${bruto}  sai do repositorio`)
      continue
    }
    if (!existsSync(alvo)) {
      problemas.push(`${rel}:${linha}  ${bruto}  arquivo nao existe`)
      continue
    }
    if (ancora && statSync(alvo).isFile() && alvo.endsWith('.md')) {
      if (!ancorasDe(alvo).has(decodeURIComponent(ancora).toLowerCase())) problemas.push(`${rel}:${linha}  ${bruto}  nenhum titulo gera a ancora "${ancora}"`)
    }
  }
}

if (problemas.length) {
  console.error('links quebrados:\n' + problemas.map((p) => '  ' + p).join('\n'))
  process.exit(1)
}
console.log('ok, todos os links relativos dos documentos resolvem (arquivo e ancora)')
