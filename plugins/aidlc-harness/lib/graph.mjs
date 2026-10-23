/*
 * O grafo de dependencias entre repos como biblioteca.
 *
 * Ate aqui a logica de raio de impacto vivia so dentro de `bin/aidlc-graph`, e quem
 * quisesse a resposta tinha que gastar um processo. Um hook que roda a cada Edit nao pode
 * pagar spawn de node, entao ou a logica virava lib ou virava copia, e copia divergindo em
 * silencio e o defeito que este harness passa o dia combatendo.
 *
 * O binario continua sendo a interface humana e a que o graph.test.mjs exercita: ele apenas
 * passou a importar daqui em vez de definir em casa.
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { globMatch } from './detect.mjs'

const EXEMPLO = join(fileURLToPath(new URL('.', import.meta.url)), '../graph/ecosystem.example.json')

/**
 * Onde mora o mapa de contratos: o dado e do PROJETO, nao do kit.
 * Ordem de busca: AIDLC_GRAPH, depois .aidlc/graph.json a partir do diretorio de trabalho, e
 * por ultimo o exemplo que viaja com o kit (para o comando funcionar num projeto novo).
 */
export function graphFile(cwd = process.cwd()) {
  if (process.env.AIDLC_GRAPH) return process.env.AIDLC_GRAPH
  const doProjeto = join(cwd, '.aidlc', 'graph.json')
  return existsSync(doProjeto) ? doProjeto : EXEMPLO
}

let cache = null
let cacheDe = null
export function loadGraph() {
  const f = graphFile()
  if (!cache || cacheDe !== f) {
    cache = JSON.parse(readFileSync(f, 'utf8'))
    cacheDe = f
  }
  return cache
}

const SOURCE_REL = ['provides', 'defines']

/**
 * Quais contratos um alvo toca.
 * Alvo pode ser caminho de arquivo (casa contra os globs do contrato) ou id de repo
 * (todos os contratos que aquele repo prove).
 */
export function contractsFor(target, g = loadGraph()) {
  const nodes = new Map(g.nodes.map((n) => [n.id, n]))
  const contracts = g.nodes.filter((n) => n.kind === 'contract')

  const asNode = nodes.get(target)
  if (asNode && asNode.kind !== 'contract') {
    return contracts.filter((ct) => g.edges.some((e) => e.from === target && e.to === ct.id && SOURCE_REL.includes(e.rel)))
  }
  if (asNode?.kind === 'contract') return [asNode]

  const path = target.replace(/^\.\//, '')
  return contracts.filter((ct) => (ct.files ?? []).some((glob) => globMatch(glob, path)))
}

/** O que mais precisa mudar, agrupado por contrato e ordenado pelo campo order. */
export function blast(target, g = loadGraph()) {
  const nodes = new Map(g.nodes.map((n) => [n.id, n]))
  const label = (id) => nodes.get(id)?.label ?? id

  return contractsFor(target, g).map((ct) => {
    /*
     * fan-out: a fonte e quem PROVE. fan-in: a fonte e quem DEFINE a interface, e os
     * provedores sao os que precisam implementar. As duas formas existem de verdade, e tratar as duas como uma so inverteria a ordem de mudanca.
     */
    const sourceRel = ct.shape === 'fan-in' ? 'defines' : 'provides'
    const owner = g.edges.find((e) => e.to === ct.id && e.rel === sourceRel)?.from
    const downstream = g.edges
      .filter((e) => e.to === ct.id && e.rel !== sourceRel)
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
      .map((e) => ({ repo: e.from, label: label(e.from), rel: e.rel, order: e.order ?? 99, todo: e.todo }))
    return { contract: ct.id, label: ct.label, why: ct.why, owner, downstream }
  })
}
