#!/usr/bin/env node
/*
 * PostToolUse(Edit|Write|MultiEdit): o roteador de estrategia.
 *
 * O arquivo acabou de mudar. Este e o unico instante em que o kit sabe, com certeza, QUAL
 * pedaco do sistema esta sendo construido, e por isso e o instante em que o ponteiro certo
 * custa menos e vale mais. Antes disto o hook teria que adivinhar; depois, no Stop, ja e
 * autopsia.
 *
 * Ele nao bloqueia e nao conserta. Entrega tres coisas sobre o caminho tocado, e so quando
 * existem: a rule que governa aquele caminho, o raio cross-repo se o arquivo for contrato, e
 * o revisor que a tecnologia exige antes do Stop.
 *
 * Barato de proposito. Edit dispara dezenas de vezes por sessao, entao: nada de spawn, nada
 * de modelo, nada de git, e cada ponteiro sai UMA vez por sessao. Repetir a mesma linha a
 * cada save e o caminho mais curto pra alguem desligar o hook.
 *
 * Falha SEMPRE pro lado de deixar trabalhar: sem tecnologia reconhecida, sem caminho, sem
 * recorte casando, ou com qualquer excecao, ele sai calado com exit 0.
 */

import { detectTech, repoRoot } from '../lib/detect.mjs'
import { blast } from '../lib/graph.mjs'
import { readLedger, writeLedger, strategyFor, reviewersOf, pointerKey, escreve, expandPointer } from '../lib/strategy.mjs'
import { relative, isAbsolute, basename } from 'node:path'

let raw = ''
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  try {
    if (process.env.AIDLC_STRATEGY === '0') process.exit(0)

    const input = JSON.parse(raw || '{}')
    const cwd = input.cwd || process.cwd()
    const root = repoRoot(cwd)

    /* Write e Edit trazem file_path na entrada; o retorno traz filePath. Aceita os dois. */
    const file = input.tool_input?.file_path ?? input.tool_response?.filePath ?? input.tool_input?.filePath
    if (!file) process.exit(0)

    const abs = String(file).replace(/\\/g, '/')
    const rel = isAbsolute(abs) ? relative(root, abs).replace(/\\/g, '/') : abs.replace(/^\.\//, '')
    /* Arquivo fora do repo da sessao e assunto de outro repo, e outro manifesto governa. */
    if (!rel || rel.startsWith('..')) process.exit(0)

    const manifest = detectTech(root)
    if (!manifest || (manifest.status ?? 'active') === 'archived') process.exit(0)

    const ledger = readLedger(input.session_id)
    const seen = new Set(ledger.seen)
    const linhas = []

    for (const p of strategyFor(manifest, rel)) {
      const k = pointerKey(p)
      if (seen.has(k)) continue
      seen.add(k)
      const alvos = (p.read ?? []).map((r) => expandPointer(r, root))
      const ler = alvos.length ? ` Leia: ${alvos.join(', ')}.` : ''
      linhas.push(`${rel}:${ler} ${p.why}.`)
    }

    /*
     * Contrato cross-repo: a ordem de mudanca e dado no grafo, nao memoria de ninguem.
     *
     * Duas travas que a primeira versao nao tinha, as duas achadas em revisao adversarial:
     *
     * 1. A dedupe e por CONTRATO, nao por arquivo. `contract:mirrored-files` declara
     *    `public/icons/**`: com a chave por caminho, editar tres icones repetia o mesmo
     *    paragrafo tres vezes, contra o que o cabecalho deste arquivo promete.
     * 2. O contrato so vale se ESTE repo participa dele. `blast()` casa glob e ignora repo,
     *    o que era inofensivo quando so um humano chamava nomeando o alvo. Disparando sozinho
     *    a cada Edit, um arquivo num repo que nao participa do contrato receberia a ordem de
     *    sincronizar algo que nao existe ali.
     */
    const repoId = basename(root)
    for (const ct of blast(rel)) {
      const participa = ct.owner === repoId || ct.downstream.some((d) => d.repo === repoId)
      if (!participa) continue
      const k = `blast|${ct.contract}`
      if (seen.has(k)) continue
      seen.add(k)
      const ondas = ct.downstream.map((d) => `${d.order}. ${d.repo}`).join(' -> ')
      linhas.push(`${rel} e CONTRATO ${ct.contract}. ${ct.why} Ordem de mudanca: ${ondas || 'sem jusante declarada'}.`)
    }

    /* Revisor exigido pela tecnologia, uma vez por sessao e so se o caminho o pediu. */
    const pedeRevisor = strategyFor(manifest, rel).some((p) => p.reviewer)
    for (const r of reviewersOf(manifest)) {
      const k = `reviewer|${r.agent}`
      if (!pedeRevisor || seen.has(k)) continue
      seen.add(k)
      linhas.push(
        `Esta stack exige o subagente ${r.agent} (${r.model})${r.blocking ? ', gate bloqueante' : ''} antes de declarar pronto. O Stop cobra o veredito colado no chat.`,
      )
    }

    if (!linhas.length) {
      writeLedger(input.session_id, { ...ledger, seen: [...seen] })
      process.exit(0)
    }

    /*
     * Pendencia vai pro livro-caixa ANTES de tentar entregar. `additionalContext` no
     * PostToolUse nao esta documentado, entao ou ele chega agora, ou o strategy-map entrega
     * no proximo prompt por um canal que esta. O que nao pode e sumir.
     */
    writeLedger(input.session_id, { ...ledger, seen: [...seen], pending: [...(ledger.pending ?? []), ...linhas] })

    /*
     * `process.exit(0)` logo depois do write TRUNCA em 64 KiB quando o stdout e pipe, que e
     * sempre o caso de um hook: o JSON chega cortado e o runtime descarta calado. Escrever
     * com callback e sair so depois resolve. O resto do kit tem o mesmo padrao e nunca doeu
     * porque as cargas sao pequenas; aqui a carga cresce com a sessao.
     */
    escreve({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[aidlc-harness] ${linhas.join(' ')}`,
      },
    })
  } catch {
    process.exit(0)
  }
})
