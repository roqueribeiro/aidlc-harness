/*
 * aidlc-init: cria no projeto o que o método precisa, uma vez, e confere que as instruções das
 * ferramentas de IA não divergem.
 *
 * Uma fonte, três ferramentas: as regras vivem em AGENTS.md, e CLAUDE.md, .github/copilot-instructions.md
 * e .kiro/steering/aidlc.md são derivados dele. Instrução copiada à mão diverge em silêncio, e a
 * cópia que fica para trás é exatamente a da ferramenta que o time esqueceu de atualizar. Por isso
 * `conferirSincronia` existe: ele reprova quando o corpo de uma cópia deixa de bater com o AGENTS.md.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MOLDE = join(fileURLToPath(new URL('.', import.meta.url)), '../templates/project')
export const FERRAMENTAS = ['claude', 'kiro', 'copilot']

const lerMolde = (rel) => readFileSync(join(MOLDE, rel), 'utf8')
const subst = (txt, vars) => txt.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in vars ? vars[k] : m))

function arvore(base, rel = '') {
  const out = []
  for (const e of readdirSync(join(base, rel), { withFileTypes: true })) {
    const r = join(rel, e.name)
    if (e.isDirectory()) out.push(...arvore(base, r))
    else out.push(r)
  }
  return out
}

/**
 * Monta o plano de arquivos a criar.
 * @returns {{ destino: string, conteudo: string }[]}
 */
export function planejar({ nome, descricao, ferramentas = FERRAMENTAS }) {
  for (const f of ferramentas) if (!FERRAMENTAS.includes(f)) throw new Error(`ferramenta desconhecida: ${f} (use ${FERRAMENTAS.join(', ')})`)
  const vars = {
    NOME: nome,
    DESCRICAO: descricao,
    COMANDO_GATE: 'aidlc-gate',
    FERRAMENTAS: JSON.stringify(ferramentas),
  }
  const agents = subst(lerMolde('AGENTS.md'), vars)
  const plano = [{ destino: 'AGENTS.md', conteudo: agents }]
  if (ferramentas.includes('claude')) plano.push({ destino: 'CLAUDE.md', conteudo: subst(lerMolde('CLAUDE.md'), vars) })
  if (ferramentas.includes('copilot')) plano.push({ destino: '.github/copilot-instructions.md', conteudo: subst(lerMolde('copilot-instructions.md'), { ...vars, CORPO: agents.trimEnd() }) })
  if (ferramentas.includes('kiro')) plano.push({ destino: '.kiro/steering/aidlc.md', conteudo: subst(lerMolde('kiro-steering-aidlc.md'), { ...vars, CORPO: agents.trimEnd() }) })

  for (const rel of ['context/product.md', 'context/kernel.md', '.aidlc/config.json', '.aidlc/identity.json']) plano.push({ destino: rel, conteudo: subst(lerMolde(rel), vars) })
  plano.push({ destino: '.github/workflows/aidlc-gate.yml', conteudo: lerMolde('aidlc-gate.yml') })
  for (const rel of arvore(join(MOLDE, 'aidlc'))) plano.push({ destino: join('aidlc', rel), conteudo: subst(lerMolde(join('aidlc', rel)), vars) })
  plano.push({ destino: 'aidlc/audit/.gitkeep', conteudo: '' })
  return plano
}

/**
 * Aplica o plano. Nunca sobrescreve sem `force`.
 * @returns {{ criados: string[], mantidos: string[], sobrescritos: string[] }}
 */
export function aplicar(raiz, plano, { force = false, dryRun = false } = {}) {
  const r = { criados: [], mantidos: [], sobrescritos: [] }
  for (const { destino, conteudo } of plano) {
    const abs = join(raiz, destino)
    const existe = existsSync(abs)
    if (existe && !force) {
      r.mantidos.push(destino)
      continue
    }
    if (!dryRun) {
      mkdirSync(dirname(abs), { recursive: true })
      writeFileSync(abs, conteudo)
    }
    ;(existe ? r.sobrescritos : r.criados).push(destino)
  }
  return r
}

/** Corpo do Kiro/Copilot depois do cabeçalho da ferramenta. */
const corpoDe = (txt) => txt.replace(/^---\n[\s\S]*?\n---\n\n?/, '').trimEnd()

/**
 * As cópias das instruções batem com o AGENTS.md?
 * @returns {string[]} divergências (vazio = em sincronia)
 */
export function conferirSincronia(raiz) {
  const agentsP = join(raiz, 'AGENTS.md')
  if (!existsSync(agentsP)) return ['AGENTS.md: nao existe (rode aidlc-init)']
  const base = readFileSync(agentsP, 'utf8').trimEnd()
  const erros = []
  for (const [rel, rotulo] of [
    ['.github/copilot-instructions.md', 'Copilot'],
    ['.kiro/steering/aidlc.md', 'Kiro'],
  ]) {
    const p = join(raiz, rel)
    if (!existsSync(p)) continue
    if (corpoDe(readFileSync(p, 'utf8')) !== base) erros.push(`${rel}: diverge do AGENTS.md (${rotulo}). Regenere com aidlc-init --force --sync ou copie o corpo`)
  }
  const claudeP = join(raiz, 'CLAUDE.md')
  if (existsSync(claudeP) && !/^@AGENTS\.md\s*$/m.test(readFileSync(claudeP, 'utf8'))) erros.push('CLAUDE.md: nao importa @AGENTS.md, entao as regras do Claude Code podem divergir das outras ferramentas')
  return erros
}

/** Regrava só as cópias derivadas a partir do AGENTS.md atual. */
export function sincronizar(raiz) {
  const base = readFileSync(join(raiz, 'AGENTS.md'), 'utf8').trimEnd()
  const feitos = []
  const cop = join(raiz, '.github/copilot-instructions.md')
  if (existsSync(cop)) {
    writeFileSync(cop, base + '\n')
    feitos.push('.github/copilot-instructions.md')
  }
  const kiro = join(raiz, '.kiro/steering/aidlc.md')
  if (existsSync(kiro)) {
    writeFileSync(kiro, subst(lerMolde('kiro-steering-aidlc.md'), { CORPO: base }))
    feitos.push('.kiro/steering/aidlc.md')
  }
  return feitos
}

export const nomePadrao = (raiz) => basename(resolve(raiz))
export const eDiretorio = (p) => existsSync(p) && statSync(p).isDirectory()
