/*
 * Deteccao de tecnologia a partir de um diretorio.
 *
 * Um repo so tem um criterio de aceite, e ele vem da STACK, nao do nome do repo: varios
 * repos diferentes rodam a mesma stack, e o mesmo manifesto vale para todos. Por isso a
 * deteccao olha pro conteudo do diretorio, nao pro remote nem pra uma lista fixa.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

export const KIT_ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
export const QUALITY_DIR = join(KIT_ROOT, 'quality')

/** Todos os manifestos, ja parseados, ordenados por prioridade decrescente. */
/*
 * Camada org.
 *
 * `quality/_org.json` guarda o que vale para toda stack viva. Cada gate de la traz um `when`
 * (hoje: `pkgManager` em lista) e entra no manifesto que casa, a menos que o manifesto
 * declare `inherits: false` ou ja tenha um gate com o mesmo id (o local vence, de proposito:
 * e assim que uma stack sobrescreve). Antes disto o gate `lockfile` estava copiado em sete
 * arquivos; copia e o jeito mais rapido de divergir calado. O gate herdado sai marcado com
 * `inherited: '_org'` para o --list e o registro de auditoria dizerem de onde veio.
 */
function loadOrg() {
  const p = join(QUALITY_DIR, '_org.json')
  if (!existsSync(p)) return { gates: [] }
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return { gates: [] }
  }
}

function orgApplies(when, m) {
  if (!when || when.todas === true) return true
  if (when.pkgManager && !when.pkgManager.includes(m.pkgManager ?? 'none')) return false
  if (when.tech && !when.tech.includes(m.tech)) return false
  return true
}

export function withOrg(m, org = loadOrg()) {
  if ((m.status ?? 'active') === 'archived' || m.inherits === false) return m
  const own = new Set((m.gates ?? []).map((g) => g.id))
  const extra = (org.gates ?? [])
    .filter((g) => !own.has(g.id) && orgApplies(g.when, m))
    .map(({ when, ...g }) => ({ ...g, inherited: '_org' }))
  // Evidencia org: o fechamento de unidade vale para toda stack, nao so para quem lembrou de copiar.
  const ownEv = new Set((m.evidence ?? []).map((e) => e.id))
  const extraEv = (org.evidence ?? [])
    .filter((e) => !ownEv.has(e.id) && orgApplies(e.when, m))
    .map(({ when, ...e }) => ({ ...e, inherited: '_org' }))
  if (!extra.length && !extraEv.length) return m
  return { ...m, gates: [...(m.gates ?? []), ...extra], evidence: [...(m.evidence ?? []), ...extraEv] }
}

/**
 * Manifestos do PROJETO: `<projeto>/.aidlc/quality/*.json`.
 *
 * Sem isto, ajustar um comando de gate ou acrescentar uma tecnologia exigia editar o proprio kit.
 * Regra: um manifesto do projeto com o mesmo `tech` de um do kit SUBSTITUI o do kit; com `tech`
 * novo, e ACRESCENTADO. A camada org do kit (`_org.json`) continua valendo para os dois.
 * Manifesto invalido nao derruba hook nenhum (falha para o lado de liberar), mas nao some em
 * silencio: `erros` de `manifestosDoProjeto` e o que o aidlc-gate e o doctor imprimem.
 */
export function manifestosDoProjeto(dir = process.cwd()) {
  const pasta = join(dir, '.aidlc', 'quality')
  const manifestos = []
  const erros = []
  if (!existsSync(pasta)) return { manifestos, erros }
  for (const f of readdirSync(pasta).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
    try {
      const m = JSON.parse(readFileSync(join(pasta, f), 'utf8'))
      if (!m.tech || !m.detect || !Array.isArray(m.gates)) throw new Error('faltam tech, detect ou gates')
      manifestos.push({ ...m, origem: 'projeto' })
    } catch (e) {
      erros.push(`.aidlc/quality/${f}: ${e.message}`)
    }
  }
  return { manifestos, erros }
}

export function loadManifests(dir = process.cwd()) {
  const org = loadOrg()
  const doKit = existsSync(QUALITY_DIR)
    ? readdirSync(QUALITY_DIR)
        .filter((f) => f.endsWith('.json') && f !== '_schema.json' && f !== '_org.json')
        .map((f) => JSON.parse(readFileSync(join(QUALITY_DIR, f), 'utf8')))
    : []
  const locais = manifestosDoProjeto(dir).manifestos
  const porTech = new Map(doKit.map((m) => [m.tech, m]))
  for (const m of locais) porTech.set(m.tech, m)
  return [...porTech.values()]
    .map((m) => withOrg(m, org))
    .sort((a, b) => (b.detect?.priority ?? 50) - (a.detect?.priority ?? 50))
}

function readPackageJson(dir) {
  const p = join(dir, 'package.json')
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function has(dir, rel) {
  return existsSync(join(dir, rel))
}

/**
 * Casa um manifesto contra um diretorio.
 * allFiles e AND, anyFiles e OR, packageDeps e OR sobre dependencies + devDependencies.
 * Precisa satisfazer TODOS os criterios que o manifesto declarou.
 */
function matches(manifest, dir, pkg) {
  const d = manifest.detect ?? {}
  let declared = 0

  if (d.allFiles?.length) {
    declared++
    if (!d.allFiles.every((f) => has(dir, f))) return false
  }
  if (d.anyFiles?.length) {
    declared++
    if (!d.anyFiles.some((f) => has(dir, f))) return false
  }
  if (d.packageDeps?.length) {
    declared++
    const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) }
    if (!d.packageDeps.some((k) => k in deps)) return false
  }
  return declared > 0
}

/*
 * O repo pode declarar o proprio gerenciador no `packageManager` do package.json (o campo do
 * Corepack, "yarn@1.22.22"), e o dele vence o do manifesto: a stack diz o gerenciador de quem
 * nao declara. Caso tipico: um repo com
 * lockfile npm que passou a usar yarn. Sem isto o guard de pacote recusava o yarn que o proprio repo usa, e
 * o gate herdado de lockfile cobrava um package-lock.json que ele nao tem mais.
 */
export function repoPkgManager(pkg) {
  const m = /^(npm|yarn|pnpm)@/.exec(String(pkg?.packageManager ?? ''))
  return m ? m[1] : null
}

/**
 * Retorna o manifesto que governa este diretorio, ou null.
 * Empate resolve por prioridade, que ja veio ordenada.
 */
export function detectTech(dir = process.cwd()) {
  const pkg = readPackageJson(dir)
  for (const m of loadManifests(dir)) {
    if (!matches(m, dir, pkg)) continue
    const own = repoPkgManager(pkg)
    if (!own || own === m.pkgManager) return m
    // Os gates herdados do _org dependem do gerenciador: saem e voltam com o do repo.
    const base = { ...m, gates: (m.gates ?? []).filter((g) => g.inherited !== '_org') }
    return withOrg({ ...base, pkgManager: own, pkgManagerFrom: 'package.json' })
  }
  return null
}

/** Sobe a arvore ate achar a raiz do repo (.git), pra deteccao funcionar de subdiretorio. */
export function repoRoot(from = process.cwd()) {
  let dir = from
  for (let i = 0; i < 24; i++) {
    if (existsSync(join(dir, '.git'))) return dir
    const up = dirname(dir)
    if (up === dir) break
    dir = up
  }
  return from
}

/** A plataforma atual roda este gate? */
export function platformAllows(want) {
  if (!want || want === 'any') return true
  return want === process.platform
}

export function platformLabel() {
  return { darwin: 'macOS', win32: 'Windows', linux: 'Linux' }[process.platform] ?? process.platform
}

/*
 * Arquivos que a sessao tocou, pra decidir se uma evidencia condicional e exigida.
 *
 * Antes, esta funcao chamava `require('node:child_process')` dentro de um modulo
 * ESM, onde `require` nao existe. O `catch` engolia o ReferenceError e ela devolvia SEMPRE
 * lista vazia, mesmo com o git reportando arquivo modificado. Ninguem importava (o dod-check
 * tem copia propria, com execFileSync, e funciona), entao o defeito estava dormente: o
 * primeiro importador teria desligado toda evidencia condicional sem um unico aviso.
 *
 * Passa a usar o import estatico e a cobrir untracked, igual ao dod-check: arquivo novo e
 * entrega tanto quanto arquivo alterado.
 */
export function changedFiles(dir) {
  try {
    const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return [...tracked.split('\n'), ...untracked.split('\n')].filter(Boolean)
  } catch {
    return []
  }
}

/** Glob simples o bastante pros padroes que os manifestos usam: **, * e literais. */
export function globMatch(pattern, path) {
  const rx = new RegExp(
    '^' +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*\//g, '§DIRSTAR§')
        .replace(/\*\*/g, '§STAR§')
        .replace(/\*/g, '[^/]*')
        .replace(/§DIRSTAR§/g, '(?:.*/)?')
        .replace(/§STAR§/g, '.*') +
      '$',
  )
  return rx.test(path)
}

export function isDir(p) {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}
