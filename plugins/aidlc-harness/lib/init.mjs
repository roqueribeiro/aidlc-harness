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

/*
 * O bloco gerenciado do AGENTS.md.
 *
 * Um repositório que já tem AGENTS.md é o caso comum, e o init antigo errava nos dois sentidos:
 * mantinha o AGENTS.md do time (certo), mas gerava as cópias do Copilot e do Kiro a partir do
 * molde, então o `--check` reprovava na primeira execução e as regras do AI-DLC nunca chegavam ao
 * AGENTS.md. Agora as regras do kit vivem entre dois marcadores: num AGENTS.md que não os tem, o
 * bloco é acrescentado ao fim, sem tocar no que o time escreveu; num que os tem, `--sync` troca só
 * o miolo. As cópias das ferramentas derivam sempre do AGENTS.md final.
 */
export const INICIO = '<!-- aidlc:inicio'
export const FIM = '<!-- aidlc:fim -->'
const RX_BLOCO = /<!-- aidlc:inicio[^\n]*-->\n[\s\S]*?<!-- aidlc:fim -->\n?/

/** O bloco do molde, com marcadores, já com as variáveis aplicadas. */
export function blocoDoMolde(vars = {}) {
  const m = RX_BLOCO.exec(subst(lerMolde('AGENTS.md'), { COMANDO_GATE: 'aidlc-gate', ...vars }))
  if (!m) throw new Error('molde AGENTS.md sem o bloco aidlc:inicio/aidlc:fim')
  return m[0].endsWith('\n') ? m[0] : m[0] + '\n'
}

export const temBloco = (txt) => RX_BLOCO.test(txt)

/** AGENTS.md existente + bloco: acrescenta se faltar, troca o miolo se já houver. */
export function comBloco(existente, bloco) {
  if (temBloco(existente)) return existente.replace(RX_BLOCO, bloco)
  return existente.replace(/\s*$/, '') + '\n\n' + bloco
}
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
export function planejar({ nome, descricao, ferramentas = FERRAMENTAS, agentsExistente = null, tech = null }) {
  for (const f of ferramentas) if (!FERRAMENTAS.includes(f)) throw new Error(`ferramenta desconhecida: ${f} (use ${FERRAMENTAS.join(', ')})`)
  const vars = {
    NOME: nome,
    DESCRICAO: descricao,
    COMANDO_GATE: 'aidlc-gate',
    FERRAMENTAS: JSON.stringify(ferramentas),
  }
  // Com AGENTS.md do time, o plano não o substitui: acrescenta o bloco (mesclar), e as cópias saem dele.
  const agents = agentsExistente === null ? subst(lerMolde('AGENTS.md'), vars) : temBloco(agentsExistente) ? agentsExistente : comBloco(agentsExistente, blocoDoMolde(vars))
  const plano = [{ destino: 'AGENTS.md', conteudo: agents, mesclar: agentsExistente !== null && !temBloco(agentsExistente) }]
  if (ferramentas.includes('claude')) plano.push({ destino: 'CLAUDE.md', conteudo: subst(lerMolde('CLAUDE.md'), vars) })
  if (ferramentas.includes('copilot')) plano.push({ destino: '.github/copilot-instructions.md', conteudo: subst(lerMolde('copilot-instructions.md'), { ...vars, CORPO: agents.trimEnd() }) })
  if (ferramentas.includes('kiro')) plano.push({ destino: '.kiro/steering/aidlc.md', conteudo: subst(lerMolde('kiro-steering-aidlc.md'), { ...vars, CORPO: agents.trimEnd() }) })

  for (const rel of ['context/product.md', 'context/kernel.md', '.aidlc/config.json', '.aidlc/identity.json']) plano.push({ destino: rel, conteudo: subst(lerMolde(rel), vars) })
  plano.push({ destino: '.github/workflows/aidlc-gate.yml', conteudo: subst(lerMolde('aidlc-gate.yml'), { CI_SETUP: passosDeCi(tech) }) })
  for (const rel of arvore(join(MOLDE, 'aidlc'))) plano.push({ destino: join('aidlc', rel), conteudo: subst(lerMolde(join('aidlc', rel)), vars) })
  plano.push({ destino: 'aidlc/audit/.gitkeep', conteudo: '' })
  return plano
}

/**
 * Aplica o plano. Nunca sobrescreve sem `force`.
 * @returns {{ criados: string[], mantidos: string[], sobrescritos: string[] }}
 */
export function aplicar(raiz, plano, { force = false, dryRun = false } = {}) {
  const r = { criados: [], mantidos: [], sobrescritos: [], mesclados: [] }
  for (const { destino, conteudo, mesclar } of plano) {
    const abs = join(raiz, destino)
    const existe = existsSync(abs)
    if (existe && mesclar) {
      // Acrescentar o bloco preserva tudo o que existia: não depende de --force.
      if (!dryRun) writeFileSync(abs, conteudo)
      r.mesclados.push(destino)
      continue
    }
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

/*
 * O CI precisa instalar as dependências do projeto antes do gate: sem isso o `yarn test` de um
 * runner limpo reprova por falta de node_modules, e o defeito não é do projeto. Os passos vêm do
 * campo `ci.setup` do manifesto da tecnologia detectada; sem tecnologia, fica um lembrete.
 */
export function passosDeCi(tech) {
  const passos = tech?.ci?.setup ?? []
  if (!passos.length) return '      # Nenhuma tecnologia reconhecida quando o aidlc-init rodou: acrescente aqui a instalação das\n      # dependências do projeto, ou rode o aidlc-init de novo com --force depois de criar o projeto.'
  return passos.map((p) => p.split('\n').map((l) => '      ' + l).join('\n')).join('\n')
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
  if (!temBloco(base)) erros.push('AGENTS.md: sem o bloco do aidlc (aidlc:inicio/aidlc:fim), entao as regras do AI-DLC nao chegam a ferramenta nenhuma. Rode aidlc-init: ele acrescenta o bloco sem tocar no resto')
  for (const [rel, rotulo] of [
    ['.github/copilot-instructions.md', 'Copilot'],
    ['.kiro/steering/aidlc.md', 'Kiro'],
  ]) {
    const p = join(raiz, rel)
    if (!existsSync(p)) continue
    if (corpoDe(readFileSync(p, 'utf8')) !== base) erros.push(`${rel}: diverge do AGENTS.md (${rotulo}). Regenere com aidlc-init --sync (so as copias sao regravadas; o AGENTS.md fica como esta)`)
  }
  const claudeP = join(raiz, 'CLAUDE.md')
  if (existsSync(claudeP) && !/^@AGENTS\.md\s*$/m.test(readFileSync(claudeP, 'utf8'))) erros.push('CLAUDE.md: nao importa @AGENTS.md, entao as regras do Claude Code podem divergir das outras ferramentas')
  return erros
}

/** Regrava só as cópias derivadas a partir do AGENTS.md atual. */
export function sincronizar(raiz) {
  const agentsP = join(raiz, 'AGENTS.md')
  const feitos = []
  // O miolo do bloco acompanha a versão do kit; o resto do AGENTS.md é do time e não muda.
  const atual = readFileSync(agentsP, 'utf8')
  const novo = comBloco(atual, blocoDoMolde())
  if (novo !== atual) {
    writeFileSync(agentsP, novo)
    feitos.push('AGENTS.md (bloco aidlc)')
  }
  const base = novo.trimEnd()
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
