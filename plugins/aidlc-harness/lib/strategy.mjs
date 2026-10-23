/*
 * A estrategia como dado consultavel, e o livro-caixa que a entrega usa.
 *
 * O buraco que isto fecha: um kit que fala no SessionStart, uma vez, e volta a falar no Stop,
 * depois do codigo escrito, fica mudo no intervalo em que o codigo NASCE, e as regras ficam
 * esperando alguem lembrar de abri-las. Regra que ninguem abre nao e regra, e decoracao
 * versionada.
 *
 * Duas entregas, e a segunda existe porque a primeira nao tem garantia documentada:
 *
 *  1. PostToolUse(Edit|Write) entrega o recorte do arquivo que ACABOU de mudar, por
 *     `hookSpecificOutput.additionalContext`.
 *  2. UserPromptSubmit, cujo `additionalContext` E documentado, entrega no prompt seguinte
 *     tudo que ficou pendente no livro-caixa.
 *
 * Se o canal 1 for ignorado pelo runtime, o ponteiro chega pelo 2 um prompt depois. Nao
 * existe caminho em que a estrategia suma calada, que e exatamente o defeito de um guard
 * que falha aberto em silencio.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { globMatch, KIT_ROOT } from './detect.mjs'

/** Ledger tem TTL pelo mesmo motivo do contador do dod-check: id de sessao e reaproveitado. */
const TTL_MS = 6 * 60 * 60 * 1000

/** Quantos prompts ate reemitir o mapa inteiro. Compact derruba contexto sem avisar. */
export const FULL_EVERY = 8

export function ledgerPath(sessionId) {
  return join(tmpdir(), `aidlc-strategy-${String(sessionId ?? 'none').replace(/[^a-zA-Z0-9_-]/g, '')}.json`)
}

export function readLedger(sessionId) {
  try {
    const l = JSON.parse(readFileSync(ledgerPath(sessionId), 'utf8'))
    if (typeof l.at === 'number' && Date.now() - l.at < TTL_MS) return { prompts: 0, pending: [], seen: [], ...l }
  } catch {
    /* primeira vez, ou registro velho: recomeca do zero */
  }
  return { prompts: 0, pending: [], seen: [], at: Date.now() }
}

export function writeLedger(sessionId, l) {
  try {
    writeFileSync(ledgerPath(sessionId), JSON.stringify({ ...l, at: Date.now() }))
  } catch {
    /* tmp sem permissao: a entrega vira best-effort, nunca erro na cara da pessoa responsável */
  }
}

/**
 * Os recortes de estrategia que casam um caminho tocado.
 * `rel` e relativo a raiz do repo, com barra normal, sem `./`.
 */
export function strategyFor(manifest, rel) {
  const path = String(rel ?? '').replace(/\\/g, '/').replace(/^\.\//, '')
  if (!path) return []
  return (manifest?.strategy?.paths ?? []).filter((p) => (p.when ?? []).some((glob) => globMatch(glob, path)))
}

/** Revisores que a tecnologia declara, vindos dos gates do tipo agent. */
export function reviewersOf(manifest) {
  return (manifest?.gates ?? [])
    .filter((g) => typeof g.agent === 'string')
    .map((g) => ({ agent: g.agent, blocking: !!g.blocking, model: g.model ?? 'inherit', label: g.label }))
}

/** Chave estavel de um ponteiro, pra nao repetir a mesma linha a cada edicao do mesmo arquivo. */
export const pointerKey = (p) => `${(p.when ?? []).join(',')}|${(p.read ?? []).join(',')}`

/**
 * Escreve o payload do hook e SO ENTAO sai.
 *
 * `process.stdout.write(x); process.exit(0)` trunca em 64 KiB quando o stdout e pipe, que e
 * sempre o caso de um hook: o processo morre antes do flush e o runtime recebe JSON cortado,
 * que ele descarta sem dizer nada. Medido em revisao adversarial: 200 ponteiros no
 * livro-caixa produziam exatamente 65536 bytes de JSON invalido.
 */
export function escreve(payload) {
  process.stdout.write(JSON.stringify(payload), () => process.exit(0))
}

/** A raiz do kit, deduzida de onde ele esta instalado (plugin em cache ou clone). */
export const KIT_BASE = KIT_ROOT

/**
 * Expande o token `@kit/` num caminho que o agente consegue abrir DE ONDE ELE ESTA.
 *
 * Por que existe: o kit pode estar instalado no cache do plugin ou clonado ao lado do projeto,
 * e um caminho relativo fixo acerta um desses layouts e quebra o outro em silencio. O manifesto
 * declara `@kit/rules/...`, e quem resolve e este ponto, que sabe onde o kit esta de verdade.
 * Se o relativo ficar feio (subindo demais), devolve o absoluto: caminho que abre vale mais que
 * caminho bonito.
 */
export function expandPointer(p, fromDir) {
  const raw = String(p ?? '')
  if (!raw.startsWith('@kit/')) return raw
  const abs = join(KIT_BASE, raw.slice('@kit/'.length))
  if (!fromDir) return abs
  const rel = relative(fromDir, abs)
  return rel && !rel.startsWith('../../../') ? rel : abs
}
