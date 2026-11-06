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
import { FERRAMENTAS, FERRAMENTAS_PADRAO, hooksPresentes, mesclarHooks, planoDosAdaptadores, resolverFerramentas } from './adaptadores.mjs'

const MOLDE = join(fileURLToPath(new URL('.', import.meta.url)), '../templates/project')
export { FERRAMENTAS, FERRAMENTAS_PADRAO }

/*
 * Fim de linha: num clone do kit no Windows o git pode converter os moldes para CRLF, e os
 * marcadores e cabeçalhos (que casam `\n`) deixam de casar: o --check reprovava o projeto que o
 * próprio init acabou de criar. Tudo o que se lê passa por `lf`.
 */
const lf = (t) => t.replace(/\r\n/g, '\n')
const lerTexto = (p) => lf(readFileSync(p, 'utf8'))
const lerMolde = (rel) => lerTexto(join(MOLDE, rel))

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
export function planejar({ nome, descricao, ferramentas: pedidas = FERRAMENTAS_PADRAO, agentsExistente = null, tech = null }) {
  const ferramentas = resolverFerramentas(pedidas)
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
  plano.push(...planoDosAdaptadores(ferramentas))
  return plano
}

/**
 * Aplica o plano. Nunca sobrescreve sem `force`.
 * @returns {{ criados: string[], mantidos: string[], sobrescritos: string[] }}
 */
export function aplicar(raiz, plano, { force = false, dryRun = false } = {}) {
  const r = { criados: [], mantidos: [], sobrescritos: [], mesclados: [], derivados: [] }
  for (const { destino, conteudo, mesclar, derivado, mesclarJson, json } of plano) {
    const abs = join(raiz, destino)
    const existe = existsSync(abs)
    if (existe && mesclarJson && !force) {
      // Hooks do time ficam; as entradas do kit entram ao lado.
      let atual
      try {
        atual = JSON.parse(readFileSync(abs, 'utf8'))
      } catch {
        r.mantidos.push(`${destino} (JSON ilegivel: acrescente as entradas do aidlc-hook a mao)`)
        continue
      }
      if (hooksPresentes(atual, json)) {
        r.mantidos.push(destino)
        continue
      }
      if (!dryRun) writeFileSync(abs, JSON.stringify(mesclarHooks(atual, json), null, 2) + '\n')
      r.mesclados.push(destino)
      continue
    }
    if (existe && mesclar) {
      // Acrescentar o bloco preserva tudo o que existia: não depende de --force.
      if (!dryRun) writeFileSync(abs, conteudo)
      r.mesclados.push(destino)
      continue
    }
    if (existe && derivado && !force) {
      // Arquivo do kit (skill copiada, comando gerado): acompanha a versão do kit, como o --sync faria.
      if (lf(readFileSync(abs, 'utf8')) === conteudo) {
        r.mantidos.push(destino)
        continue
      }
      if (!dryRun) writeFileSync(abs, conteudo)
      r.derivados.push(destino)
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
  const base = lerTexto(agentsP).trimEnd()
  const erros = []
  if (!temBloco(base)) erros.push('AGENTS.md: sem o bloco do aidlc (aidlc:inicio/aidlc:fim), entao as regras do AI-DLC nao chegam a ferramenta nenhuma. Rode aidlc-init: ele acrescenta o bloco sem tocar no resto')
  for (const [rel, rotulo] of [
    ['.github/copilot-instructions.md', 'Copilot'],
    ['.kiro/steering/aidlc.md', 'Kiro'],
  ]) {
    const p = join(raiz, rel)
    if (!existsSync(p)) continue
    if (corpoDe(lerTexto(p)) !== base) erros.push(`${rel}: diverge do AGENTS.md (${rotulo}). Regenere com aidlc-init --sync (so as copias sao regravadas; o AGENTS.md fica como esta)`)
  }
  const claudeP = join(raiz, 'CLAUDE.md')
  if (existsSync(claudeP) && !/^@AGENTS\.md\s*$/m.test(lerTexto(claudeP))) erros.push('CLAUDE.md: nao importa @AGENTS.md, entao as regras do Claude Code podem divergir das outras ferramentas')
  erros.push(...adaptadoresDivergentes(raiz))
  return erros
}

/** Ferramentas do projeto: as que o aidlc-init gravou em .aidlc/config.json. */
export function ferramentasDoProjeto(raiz) {
  try {
    const t = JSON.parse(readFileSync(join(raiz, '.aidlc', 'config.json'), 'utf8')).tools
    if (Array.isArray(t)) return resolverFerramentas(t)
  } catch {
    /* sem config: nenhuma ferramenta declarada */
  }
  return []
}

/** Os arquivos de adaptador (skills copiadas, comandos) que divergem do que o kit geraria. */
export function adaptadoresDivergentes(raiz) {
  const erros = []
  for (const { destino, conteudo, mesclarJson, json } of planoDosAdaptadores(ferramentasDoProjeto(raiz))) {
    const p = join(raiz, destino)
    if (!existsSync(p)) erros.push(`${destino}: falta (rode aidlc-init --sync)`)
    else if (mesclarJson) {
      let atual = null
      try {
        atual = JSON.parse(lerTexto(p))
      } catch {
        /* cai na mensagem abaixo */
      }
      if (!atual || !hooksPresentes(atual, json)) erros.push(`${destino}: sem as entradas do aidlc-hook (rode aidlc-init --sync; os hooks do time ficam)`)
    }
    else if (lerTexto(p) !== conteudo) erros.push(`${destino}: diverge do que esta versao do kit gera (rode aidlc-init --sync; o arquivo e do kit, nao se edita)`)
  }
  return erros
}

/** Regrava só as cópias derivadas a partir do AGENTS.md atual. */
export function sincronizar(raiz) {
  const agentsP = join(raiz, 'AGENTS.md')
  const feitos = []
  // O miolo do bloco acompanha a versão do kit; o resto do AGENTS.md é do time e não muda.
  const atual = lerTexto(agentsP)
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
  // Skills e comandos das ferramentas: o kit é a fonte; o --sync traz a versão atual.
  for (const { destino, conteudo, mesclarJson, json } of planoDosAdaptadores(ferramentasDoProjeto(raiz))) {
    const p = join(raiz, destino)
    if (mesclarJson && existsSync(p)) {
      try {
        const atual = JSON.parse(lerTexto(p))
        if (hooksPresentes(atual, json)) continue
        writeFileSync(p, JSON.stringify(mesclarHooks(atual, json), null, 2) + '\n')
        feitos.push(destino)
      } catch {
        /* JSON do time ilegível: o --check continua apontando */
      }
      continue
    }
    if (existsSync(p) && lerTexto(p) === conteudo) continue
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, conteudo)
    feitos.push(destino)
  }
  return feitos
}

export const nomePadrao = (raiz) => basename(resolve(raiz))
export const eDiretorio = (p) => existsSync(p) && statSync(p).isDirectory()
