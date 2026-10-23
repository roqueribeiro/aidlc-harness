#!/usr/bin/env node
/*
 * Stop: o gate de evidencia.
 *
 * "Esta pronto" deixa de ser opiniao. O hook le o transcript desde a ultima mensagem do
 * responsável, descobre quais evidencias o manifesto da tecnologia exige, e recusa o
 * encerramento quando alguma falta. O agente continua trabalhando em vez de devolver o
 * problema, que e exatamente o ciclo de ida e volta que isto existe pra cortar.
 *
 * Determinista de proposito. O Stop dispara dezenas de vezes por sessao (medido no front:
 * media de 43,8, pico de 197), entao nada de modelo aqui dentro. Um check de DoD ja foi um
 * hook do tipo agent: 336 execucoes, media de 19,3s, pico de 87s, pra fazer aritmetica de
 * caminho. Esta versao faz o mesmo em milissegundos.
 *
 * Falha SEMPRE pro lado de liberar:
 *   - AIDLC_GATE=0 ou gate_mode != block           -> libera (gate_mode vale para os tres hooks de Stop)
 *   - tecnologia nao reconhecida                     -> libera
 *   - nada foi alterado na arvore                    -> libera (nao houve entrega a provar), salvo
 *     quando o turno afirma fechar uma unidade de trabalho: ai so a evidencia `whenSays` e cobrada
 *   - ja bloqueou MAX_BLOCKS vezes nesta sessao      -> avisa e libera
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { detectTech, repoRoot, globMatch } from '../lib/detect.mjs'
import { gateMode } from '../lib/gate-mode.mjs'

const KIT_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/*
 * Trilha de auditoria que sobrevive.
 *
 * No inicio o que autorizou uma entrega vivia em dois lugares: o transcript do chat e
 * um contador em tmp com TTL de 6h. Nenhum dos dois responde, semanas depois, "sob qual
 * criterio esta mudanca passou". O registro vai para `.claude/audit/<dia>.jsonl` do repo,
 * append-only, uma linha por decisao do gate, com a versao do kit e o hash do manifesto
 * (configuracao congelada por execucao, emprestado do Collaborative AI-DLC). O que fazer
 * com o arquivo (commitar ou ignorar) e decisao do repo; o kit so garante que ele existe.
 * Falha de escrita nunca segura o Stop: auditoria e registro, nao gate.
 */
function kitVersion() {
  try {
    return JSON.parse(readFileSync(join(KIT_DIR, '.claude-plugin/plugin.json'), 'utf8')).version ?? null
  } catch {
    return null
  }
}
function manifestHash(tech) {
  try {
    return createHash('sha256').update(Buffer.concat([readFileSync(join(KIT_DIR, 'quality', `${tech}.json`)), existsSync(join(KIT_DIR, 'quality', '_org.json')) ? readFileSync(join(KIT_DIR, 'quality', '_org.json')) : Buffer.alloc(0)])).digest('hex').slice(0, 12)
  } catch {
    return null
  }
}
function auditRecord(root, rec) {
  if (process.env.AIDLC_AUDIT === '0') return
  try {
    const dir = join(root, '.claude', 'audit')
    mkdirSync(dir, { recursive: true })
    const day = new Date().toISOString().slice(0, 10)
    appendFileSync(join(dir, `${day}.jsonl`), JSON.stringify({ at: new Date().toISOString(), ...rec }) + '\n')
  } catch {
    /* sem permissao de escrita: o registro e best-effort, o gate nao */
  }
}

const MAX_BLOCKS = 3

function readTranscript(path) {
  if (!path || !existsSync(path)) return []
  const out = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch {
      /* linha malformada, segue */
    }
  }
  return out
}

const roleOf = (m) => m.message?.role || m.role || m.type
const textOf = (m) => {
  const content = m.message?.content ?? m.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((b) => {
      if (typeof b === 'string') return b
      if (b?.type === 'text') return b.text ?? ''
      if (b?.type === 'tool_use') return `${b.name ?? ''} ${JSON.stringify(b.input ?? {})}`
      if (b?.type === 'tool_result') {
        const c = b.content
        if (typeof c === 'string') return c
        if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? x : (x?.text ?? ''))).join('\n')
      }
      if (b?.type === 'image') return '[image]'
      return ''
    })
    .join('\n')
}

/** Tudo que aconteceu desde a ultima mensagem real da pessoa responsável. */
function sinceLastUserTurn(msgs) {
  let start = 0
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (roleOf(msgs[i]) === 'user') {
      const t = textOf(msgs[i])
      // Resultado de ferramenta tambem chega como role user; a mensagem real tem texto proprio.
      const isToolResult = /"type":"tool_result"/.test(JSON.stringify(msgs[i].message?.content ?? ''))
      if (!isToolResult && t.trim()) {
        start = i
        break
      }
    }
  }
  return msgs.slice(start)
}

function changedFiles(dir) {
  try {
    const tracked = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: dir, encoding: 'utf8' })
    const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: dir, encoding: 'utf8' })
    return [...tracked.split('\n'), ...untracked.split('\n')].filter(Boolean)
  } catch {
    return []
  }
}

function blockCountPath(sessionId) {
  return join(tmpdir(), `aidlc-dod-${String(sessionId ?? 'none').replace(/[^a-zA-Z0-9_-]/g, '')}.json`)
}

/*
 * O contador tem TTL. Sem ele, um id de sessao reaproveitado (resume, ou um harness de teste)
 * herda a contagem de horas atras e o gate ja nasce esgotado, liberando entrega sem evidencia
 * justamente onde deveria barrar.
 */
const BLOCK_TTL_MS = 6 * 60 * 60 * 1000

function bumpBlockCount(sessionId) {
  const p = blockCountPath(sessionId)
  let n = 0
  try {
    const prev = JSON.parse(readFileSync(p, 'utf8'))
    if (typeof prev.at === 'number' && Date.now() - prev.at < BLOCK_TTL_MS) n = prev.n ?? 0
  } catch {
    /* primeiro bloqueio, ou registro velho: recomeca do zero */
  }
  n += 1
  try {
    writeFileSync(p, JSON.stringify({ n, at: Date.now() }))
  } catch {
    /* tmp sem permissao: o teto vira best-effort */
  }
  return n
}

function release() {
  process.exit(0)
}

let raw = ''
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw || '{}')

    if (process.env.AIDLC_GATE === '0') return release()
    if (gateMode() !== 'block') return release()

    const cwd = input.cwd || process.cwd()
    const root = repoRoot(cwd)
    const manifest = detectTech(root)
    if (!manifest || (manifest.status ?? 'active') === 'archived') return release()

    const touched = changedFiles(root)
    const msgs = readTranscript(input.transcript_path)
    if (!msgs.length) return release()

    const turn = sinceLastUserTurn(msgs)
    const haystack = turn.map(textOf).join('\n')

    /*
     * Evidencia de afirmacao (`whenSays`): vale quando a ultima mensagem do turno
     * diz que fechou uma unidade, com a arvore suja ou limpa. Fechamento de unidade acontece com a
     * arvore limpa (tudo commitado e na principal), que e exatamente quando o resto deste hook
     * libera sem olhar; sem isto "unidade fechada" nunca era conferido.
     */
    const ultima = textOf([...turn].reverse().find((m) => roleOf(m) === 'assistant' && textOf(m).trim()) ?? {})
    const afirma = (ev) =>
      (ev.whenSays ?? []).some((r) => {
        try {
          return new RegExp(r, 'i').test(ultima)
        } catch {
          return false
        }
      })
    if (!touched.length && !(manifest.evidence ?? []).some((ev) => ev.whenSays?.length && afirma(ev))) return release()

    const missing = []
    for (const ev of manifest.evidence ?? []) {
      if (ev.whenSays?.length && !afirma(ev)) continue
      if (!touched.length && !ev.whenSays?.length) continue
      if (ev.whenTouches?.length) {
        const relevant = touched.some((f) => ev.whenTouches.some((g) => globMatch(g, f)))
        if (!relevant) continue
      }
      const satisfied = (ev.markers ?? []).some((m) => {
        try {
          return new RegExp(m, 'i').test(haystack)
        } catch {
          return false
        }
      })
      if (!satisfied) missing.push(ev)
    }

    const base = {
      hook: 'dod-check',
      session: input.session_id ?? null,
      tech: manifest.tech,
      kitVersion: kitVersion(),
      manifestHash: manifestHash(manifest.tech),
      autonomy: manifest.autonomy ?? 'approve',
      touched: touched.length,
      files: touched.slice(0, 20),
      satisfied: (manifest.evidence ?? []).filter((e) => !missing.includes(e)).map((e) => e.id),
      missing: missing.map((e) => e.id),
    }

    if (!missing.length) {
      auditRecord(root, { ...base, decision: 'released' })
      return release()
    }

    const n = bumpBlockCount(input.session_id)
    auditRecord(root, { ...base, decision: n > MAX_BLOCKS ? 'released-after-cap' : 'blocked', blocks: n })
    if (n > MAX_BLOCKS) {
      // Teto anti-loop: depois de MAX_BLOCKS o gate vira aviso, nunca prisao.
      process.stdout.write(
        JSON.stringify({
          systemMessage: `Gate de evidencia ainda incompleto (${missing.map((m) => m.label).join('; ')}), mas ja bloqueou ${MAX_BLOCKS} vezes. Liberando.`,
        }),
      )
      return release()
    }

    process.stderr.write(
      [
        `Falta evidencia no chat antes de declarar pronto (${manifest.label}):`,
        ...missing.map((m) => `  - ${m.label}`),
        '',
        `Arquivos alterados nesta sessao: ${touched.slice(0, 8).join(', ')}${touched.length > 8 ? ` (+${touched.length - 8})` : ''}`,
        `Rode o gate e cole a saida:  aidlc-gate`,
        `Kill switch, se for mesmo desnecessario:  AIDLC_GATE=0`,
      ].join('\n') + '\n',
    )
    process.exit(2)
  } catch {
    release()
  }
})
