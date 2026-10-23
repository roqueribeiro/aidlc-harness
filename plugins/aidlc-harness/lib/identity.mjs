/*
 * Detector de identidade: o que não pode sair de dentro de um repositório.
 *
 * `scrub.mjs` reconhece FORMATO de segredo (token, chave privada). Este reconhece FORMATO de
 * identidade: IP, MAC, e-mail, caminho de home de uma pessoa, hostname de rede interna. Os dois
 * são complementares e nenhum finge cobrir o que não cobre: nome de cliente, nome de produto
 * interno e frase que identifica alguém não têm formato, e para esses existe a lista de termos
 * do próprio projeto (denylist), mantida FORA do repositório.
 *
 * Quem executa: `aidlc-identity` (ferramenta), o gate `identity` do manifesto da tecnologia, e o
 * CI. Teste de mutação em lib/identity.test.mjs: cada categoria é plantada e tem de reprovar.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { homedir } from 'node:os'
import { SECRET_SHAPES } from './scrub.mjs'
import { globMatch } from './detect.mjs'

const OCTETO = '(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)'
const IPV4 = new RegExp(`(?<![\\w.])${OCTETO}(?:\\.${OCTETO}){3}(?![\\w]|\\.\\d)`, 'g')
const MAC = /(?<![0-9A-Fa-f:])(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}(?![0-9A-Fa-f:])/g
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g
const HOME = /(?:\/Users\/|\/home\/|C:[\\/]Users[\\/])([A-Za-z0-9._-]+)/g
const HOST_INTERNO = /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:local|lan|internal|corp|intranet|intra)\b/gi

/* Valores que são documentação, não identidade. */
const IP_DOC = [/^127\./, /^0\./, /^255\./, /^192\.0\.2\./, /^198\.51\.100\./, /^203\.0\.113\./, /^10\.0\.0\.\d+$/, /^192\.168\.0\.1$/]
const EMAIL_DOC = /@(?:[a-z0-9-]+\.invalid|example\.(?:com|org|net)|exemplo\.com(?:\.br)?|test|localhost|users\.noreply\.github\.com)$|^(?:noreply|no-reply|t|a|git)@/i
const HOME_DOC = new Set(['user', 'you', 'voce', 'usuario', 'seu-usuario', 'seuusuario', 'name', 'nome', 'example', 'exemplo', 'runner', 'me', 'x', 'foo', 'dev', 'ubuntu', 'node', 'claude'])
const HOST_DOC = /(?:^|\.)(?:example|exemplo|test)\.(?:local|lan|internal|corp)$|^localhost\.localdomain$/i

const SKIP_DIR = new Set(['.git', 'node_modules', '.venv', 'dist', 'build', 'coverage'])
const BINARIO = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip|gz|pptx|xlsx|mp[34]|mov)$/i

export const CATEGORIAS = ['ipv4', 'mac', 'email', 'home', 'host-interno', 'segredo', 'termo']

/**
 * Procura identidade num texto.
 * @param {string} texto
 * @param {{ termos?: string[] }} [opts] termos: palavras que este projeto proíbe (case-insensitive)
 * @returns {{ categoria: string, valor: string, linha: number }[]}
 */
export function acharNoTexto(texto, opts = {}) {
  const achados = []
  const linhas = String(texto).split('\n')
  const termos = (opts.termos ?? []).map((t) => t.trim()).filter(Boolean)
  const rxTermos = termos.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${termos.map(escapar).join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null

  linhas.forEach((ln, i) => {
    const push = (categoria, valor) => achados.push({ categoria, valor, linha: i + 1 })
    for (const m of ln.matchAll(IPV4)) if (!IP_DOC.some((r) => r.test(m[0]))) push('ipv4', m[0])
    for (const m of ln.matchAll(MAC)) if (!/^(?:00[:-]){5}00$|^(?:ff[:-]){5}ff$/i.test(m[0])) push('mac', m[0])
    for (const m of ln.matchAll(EMAIL)) if (!EMAIL_DOC.test(m[0])) push('email', m[0])
    for (const m of ln.matchAll(HOME)) if (!HOME_DOC.has(m[1].toLowerCase()) && !/^[<{$%]/.test(m[1])) push('home', m[0])
    for (const m of ln.matchAll(HOST_INTERNO)) if (!HOST_DOC.test(m[0])) push('host-interno', m[0])
    for (const [rx, rotulo] of SECRET_SHAPES) {
      rx.lastIndex = 0
      for (const m of ln.matchAll(new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g'))) push('segredo', `${rotulo}:${m[0].slice(0, 6)}…`)
    }
    if (rxTermos) for (const m of ln.matchAll(rxTermos)) push('termo', m[1])
  })
  return achados
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Lê a lista de termos proibidos. Fica FORA do repositório de propósito: um arquivo que lista
 * "o que não pode aparecer" dentro do repo publicaria exatamente isso.
 * Ordem: AIDLC_IDENTITY_TERMS (caminho), depois ~/.config/aidlc/identity-terms.txt.
 * Formato: um termo por linha; linha vazia e `#` são ignoradas.
 */
export function carregarTermos(env = process.env) {
  const candidatos = [env.AIDLC_IDENTITY_TERMS, join(homedir(), '.config', 'aidlc', 'identity-terms.txt')].filter(Boolean)
  for (const f of candidatos) {
    if (existsSync(f)) {
      return { arquivo: f, termos: readFileSync(f, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')) }
    }
  }
  return { arquivo: null, termos: [] }
}

/**
 * Allowlist do projeto: `.aidlc/identity.json`
 *   { "allow": [ { "file": "glob", "categoria": "email", "valor": "opcional", "why": "por que este achado é legítimo" } ] }
 * Entrada sem `why` é recusada: aceitar um achado é decisão com motivo, não arquivamento.
 * `valor` (opcional) restringe a entrada a UM valor (sem diferenciar maiúsculas): sem ele, a entrada
 * libera toda a categoria no arquivo, e um termo proibido diferente, escrito depois no mesmo arquivo,
 * passaria junto. Prefira sempre `valor` para termo.
 */
export function carregarAllow(raiz) {
  const f = join(raiz, '.aidlc', 'identity.json')
  if (!existsSync(f)) return { regras: [], erros: [] }
  const erros = []
  let j
  try {
    j = JSON.parse(readFileSync(f, 'utf8'))
  } catch (e) {
    return { regras: [], erros: [`.aidlc/identity.json nao e JSON valido: ${e.message}`] }
  }
  const regras = []
  for (const [i, r] of (j.allow ?? []).entries()) {
    if (!r.file || !r.why || String(r.why).trim().length < 8) {
      erros.push(`.aidlc/identity.json allow[${i}]: precisa de "file" e de um "why" que explique (>= 8 caracteres)`)
      continue
    }
    regras.push(r)
  }
  return { regras, erros }
}

function arquivos(raiz) {
  const out = []
  const anda = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIR.has(e.name)) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) anda(p)
      else if (e.isFile() && !BINARIO.test(e.name) && statSync(p).size < 2_000_000) out.push(p)
    }
  }
  anda(raiz)
  return out
}

/**
 * Varre um diretório.
 * @returns {{ achados: {arquivo:string, categoria:string, valor:string, linha:number}[], aceitos: number, erros: string[], arquivos: number }}
 */
export function varrer(raiz, opts = {}) {
  const { regras, erros } = carregarAllow(raiz)
  const termos = opts.termos ?? carregarTermos().termos
  const achados = []
  let aceitos = 0
  // A propria allowlist cita, por necessidade, os termos que aceita: um valor declarado nela nao e achado nela.
  const declarados = new Set(regras.filter((r) => r.valor).map((r) => String(r.valor).toLowerCase()))
  const lista = arquivos(raiz)
  for (const abs of lista) {
    const rel = relative(raiz, abs).split(sep).join('/')
    let txt
    try {
      txt = readFileSync(abs, 'utf8')
    } catch {
      continue
    }
    if (txt.includes('\u0000')) continue
    for (const a of acharNoTexto(txt, { termos })) {
      const naAllowlist = rel === '.aidlc/identity.json' && declarados.has(String(a.valor).toLowerCase())
      const liberado = naAllowlist || regras.some((r) => globMatch(r.file, rel) && (!r.categoria || r.categoria === a.categoria) && (!r.valor || String(r.valor).toLowerCase() === String(a.valor).toLowerCase()))
      if (liberado) aceitos++
      else achados.push({ arquivo: rel, ...a })
    }
  }
  return { achados, aceitos, erros, arquivos: lista.length }
}
