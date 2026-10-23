#!/usr/bin/env node
/*
 * UserPromptSubmit: o mapa da estrategia, no unico canal com garantia documentada.
 *
 * O SessionStart fala uma vez. Depois de um `/compact` ele nao volta (o matcher e
 * startup|resume), e as rules com `paths:` tambem saem do contexto: a sessao longa continua
 * trabalhando com a memoria do que leu ha cinquenta turnos. Este hook e o que impede isso,
 * porque UserPromptSubmit e um dos tres eventos onde a documentacao garante que o texto
 * entra no contexto do modelo.
 *
 * Duas formas, pra nao pagar o mapa inteiro a cada prompt:
 *   - mapa completo no primeiro prompt e a cada FULL_EVERY prompts (a janela do compact);
 *   - linha curta nos demais, so com stack, gate e revisor.
 * Em qualquer uma das duas, o que o roteador de Edit deixou pendente no livro-caixa sai
 * junto e e zerado. Ponteiro entregue uma vez nao volta a custar token.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectTech, repoRoot, KIT_ROOT } from '../lib/detect.mjs'
import { readLedger, writeLedger, reviewersOf, FULL_EVERY, escreve, expandPointer } from '../lib/strategy.mjs'

/*
 * O nucleo do contexto de produto.
 *
 * Fica em `context/kernel.md` e nao aqui dentro de proposito: e texto de produto, e quem o
 * corrige nao deveria precisar abrir um hook pra isso. So entra no mapa COMPLETO, que sai no
 * primeiro prompt e a cada FULL_EVERY, porque e caro e porque o que ele muda e a decisao de
 * enquadramento, nao a de cada turno. O resto vive na skill `aidlc-context`, sob demanda.
 */
const kernel = () => {
  try {
    return readFileSync(join(KIT_ROOT, 'context/kernel.md'), 'utf8').trim().replace(/\s+/g, ' ')
  } catch {
    return ''
  }
}

const skills = () => {
  try {
    return readdirSync(join(KIT_ROOT, 'skills'), { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(KIT_ROOT, 'skills', e.name, 'SKILL.md')))
      .map((e) => e.name)
  } catch {
    return []
  }
}

let raw = ''
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  try {
    if (process.env.AIDLC_STRATEGY === '0') process.exit(0)

    const input = JSON.parse(raw || '{}')
    const root = repoRoot(input.cwd || process.cwd())
    const m = detectTech(root)
    if (!m || (m.status ?? 'active') === 'archived') process.exit(0)

    const ledger = readLedger(input.session_id)
    const n = (ledger.prompts ?? 0) + 1
    const completo = n === 1 || n % FULL_EVERY === 0

    const revisores = reviewersOf(m)
    const partes = []

    if (completo) {
      const k = kernel()
      if (k) partes.push(k)
      partes.push(`[aidlc-harness] ${m.label}. Gate: aidlc-gate. Evidencia exigida no Stop: ${(m.evidence ?? []).map((e) => e.label).join('; ')}.`)
      const always = (m.strategy?.always ?? []).map((r) => expandPointer(r, root))
      if (always.length) partes.push(`Leia antes de escrever: ${always.join(', ')}.`)
      if (revisores.length) {
        partes.push(
          `Revisor da stack: ${revisores.map((r) => `${r.agent} (${r.model}${r.blocking ? ', bloqueante' : ''})`).join(', ')}. Rode como subagente e cole o veredito.`,
        )
      }
      const sk = skills()
      if (sk.length) partes.push(`Skills do kit: ${sk.join(', ')}.`)
    } else {
      const rev = revisores.length ? ` Revisor: ${revisores.map((r) => r.agent).join(', ')}.` : ''
      partes.push(`[aidlc-harness] ${m.label}, gate aidlc-gate.${rev}`)
    }

    /*
     * O que o roteador de Edit registrou e ainda nao foi entregue por canal garantido.
     *
     * Com teto, e dizendo quantas ficaram de fora. Uma sessao que toca cem arquivos de
     * contrato geraria uma carga grande o bastante pra estourar o buffer do stdout, e corte
     * silencioso aqui seria o mesmo defeito que este hook existe pra consertar.
     */
    const TETO = 12
    const pend = ledger.pending ?? []
    if (pend.length) {
      const mostra = pend.slice(0, TETO)
      const sobra = pend.length - mostra.length
      partes.push(`Pendente desde a ultima edicao: ${mostra.join(' ')}${sobra ? ` (mais ${sobra} ponteiro(s) omitido(s) por teto)` : ''}`)
    }

    writeLedger(input.session_id, { ...ledger, prompts: n, pending: [] })

    /* Sair antes do flush trunca em 64 KiB quando o stdout e pipe. Ver lib/strategy.mjs. */
    escreve({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: partes.join(' ') } })
  } catch {
    process.exit(0)
  }
})
