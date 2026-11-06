#!/usr/bin/env node
/*
 * Porta de entrada única do pacote: `npx github:roqueribeiro/aidlc-harness <comando>`.
 *
 *   npx github:roqueribeiro/aidlc-harness init          # prepara o projeto (pergunta as ferramentas)
 *   npx github:roqueribeiro/aidlc-harness doctor
 *   npx github:roqueribeiro/aidlc-harness gate
 *
 * O npx roda o executável com o nome do pacote, `aidlc-harness`, que já era o nome do medidor de
 * custo de contexto. Para não quebrar quem o usa: subcomando conhecido (init, gate, phase...) vai
 * para `aidlc-<subcomando>`; qualquer outra coisa (nada, um caminho, --json) continua sendo o
 * medidor, como antes.
 *
 * Instalação permanente, com todos os `aidlc-*` no PATH em qualquer sistema (o npm cria os .cmd no
 * Windows): `npm install -g github:roqueribeiro/aidlc-harness`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ehPrincipal } from './lib/principal.mjs'

const TOOLS = join(dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'aidlc-harness', 'tools')
export const SUBCOMANDOS = readdirSync(TOOLS)
  .filter((n) => n.startsWith('aidlc-') && n !== 'aidlc-harness')
  .map((n) => n.slice('aidlc-'.length))

export function destino(argv) {
  const [primeiro, ...resto] = argv
  if (primeiro && SUBCOMANDOS.includes(primeiro)) return { tool: `aidlc-${primeiro}`, args: resto }
  if (primeiro === 'help' || primeiro === '--help' || primeiro === '-h') return { ajuda: true }
  return { tool: 'aidlc-harness', args: argv }
}

if (ehPrincipal(import.meta.url)) {
  const d = destino(process.argv.slice(2))
  if (d.ajuda) {
    console.log(`aidlc-harness <comando> [opcoes]\n\nComandos: ${SUBCOMANDOS.join(', ')}\nSem comando: mede o custo de contexto do repo (o aidlc-harness de sempre).\n\nExemplo: npx github:roqueribeiro/aidlc-harness init --tools claude,cursor`)
    process.exit(0)
  }
  const alvo = join(TOOLS, d.tool)
  if (!existsSync(alvo)) {
    console.error(`aidlc-harness: ${d.tool} nao existe`)
    process.exit(2)
  }
  const r = spawnSync(process.execPath, [alvo, ...d.args], { stdio: 'inherit' })
  process.exit(r.status ?? 1)
}
