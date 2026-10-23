#!/usr/bin/env node
/*
 * SessionStart: diz ao agente onde ele esta e o que autoriza a entrega.
 *
 * Curto de proposito. Isto entra no contexto de TODA sessao de TODO repo, e o
 * baseline sempre-on do front ja esta acima do proprio alvo. Cada linha aqui e paga muitas
 * vezes, entao so entra o que muda a decisao do primeiro turno: qual e a stack, qual e o
 * gate, e o que precisa aparecer no chat antes de dizer que acabou.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectTech, repoRoot, platformAllows, platformLabel, KIT_ROOT } from '../lib/detect.mjs'

/** O nucleo do contexto de produto, o mesmo que o strategy-map carrega. */
function kernel() {
  try {
    return readFileSync(join(KIT_ROOT, 'context/kernel.md'), 'utf8').trim().replace(/\s+/g, ' ')
  } catch {
    return ''
  }
}

let raw = ''
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw || '{}')
    const root = repoRoot(input.cwd || process.cwd())
    const m = detectTech(root)
    if (!m || (m.status ?? 'active') === 'archived') process.exit(0)

    /*
     * Filtrar so por `g.cmd` esconderia o gate de revisor: o brief anunciaria menos bloqueantes
     * do que o manifesto declara, e o que sumiria seria justamente o que ninguem executa.
     */
    const blocking = (m.gates ?? []).filter((g) => g.blocking && g.cmd).map((g) => g.cmd)
    const revisores = (m.gates ?? []).filter((g) => g.blocking && g.agent).map((g) => g.agent)
    const offPlatform = (m.gates ?? []).filter((g) => !platformAllows(g.platform ?? m.platform ?? 'any'))

    /*
     * Depois de um `/compact` o contexto foi embora inteiro: as rules com `paths:` sairam, e
     * o mapa do `strategy-map` so volta cheio no proximo multiplo de FULL_EVERY, o que pode
     * levar sete prompts. Este e o unico evento que sabe que a compactacao ACABOU de
     * acontecer, entao e aqui que o nucleo do contexto de produto volta.
     */
    const compactou = input.source === 'compact'
    const nucleo = compactou ? kernel() : ''

    const lines = [
      ...(nucleo ? [nucleo] : []),
      `[aidlc-harness] ${m.label}. Gate: aidlc-gate (${blocking.length} comandos bloqueantes${revisores.length ? ` mais ${revisores.length} revisor(es) que a sessao roda: ${revisores.join(', ')}` : ''}).`,
      `Evidencia obrigatoria no chat ANTES de declarar pronto: ${m.evidence.map((e) => e.label).join('; ')}.`,
      `O Stop recusa o encerramento sem ela. Kill switch: AIDLC_GATE=0.`,
    ]
    if (offPlatform.length) {
      lines.push(
        `${offPlatform.length} gate(s) so rodam em ${m.platform}, esta maquina e ${platformLabel()}: reporte como pendente de maquina, nunca como verde.`,
      )
    }

    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join(' ') },
      }),
    )
    process.exit(0)
  } catch {
    process.exit(0)
  }
})
