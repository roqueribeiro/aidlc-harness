/*
 * Onde mora a trilha de auditoria do gate.
 *
 * O dod-check gravava em `.claude/audit/`, que é pasta do Claude Code, enquanto o `aidlc-init` cria
 * `aidlc/audit/` para todo projeto, de qualquer ferramenta. O doctor e o cycle liam só a primeira:
 * um projeto que nunca usou Claude Code ficava sempre "sem registro". Agora grava-se em
 * `aidlc/audit/` e lê-se das duas, para não perder o histórico de quem já tinha registros antigos.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const AUDIT_DIR = join('aidlc', 'audit')
export const AUDIT_DIRS_LEITURA = [AUDIT_DIR, join('.claude', 'audit')]

/** Linhas do registro do gate (hook dod-check) a partir de `desde` (Date ou ms), das duas pastas. */
export function registrosDoGate(raiz, desde = 0) {
  const corte = new Date(desde).getTime()
  const out = []
  for (const rel of AUDIT_DIRS_LEITURA) {
    const dir = join(raiz, rel)
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl')).sort()) {
      for (const line of readFileSync(join(dir, f), 'utf8').split('\n')) {
        if (!line.trim()) continue
        try {
          const r = JSON.parse(line)
          if (r.hook === 'dod-check' && r.at && new Date(r.at).getTime() >= corte) out.push(r)
        } catch {
          /* linha quebrada: o registro é append-only, uma linha ruim não invalida as outras */
        }
      }
    }
  }
  return out
}

/*
 * O gate verde NESTA árvore.
 *
 * Fora do Claude Code o transcript tem outro formato em cada ferramenta, então o hook de parada
 * não consegue procurar a saída colada no chat. O que dá para conferir em qualquer uma: o
 * `aidlc-gate` rodou, saiu verde, e a árvore de trabalho é a mesma de quando ele rodou. O
 * `aidlc-gate` grava a impressão digital da árvore a cada execução; o hook recalcula e compara.
 * A pasta de auditoria fica fora da conta, senão gravar o registro mudaria a própria impressão.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

const git = (raiz, args) => execFileSync('git', args, { cwd: raiz, encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 })
const FORA = ':(exclude)aidlc/audit'

/** Impressão digital da árvore de trabalho: HEAD + diff + arquivos novos. null fora de um repo git. */
export function impressaoDaArvore(raiz) {
  try {
    const h = createHash('sha256')
    h.update(git(raiz, ['rev-parse', 'HEAD']))
    h.update(git(raiz, ['diff', 'HEAD', '--binary', '--', '.', FORA]))
    const novos = git(raiz, ['ls-files', '--others', '--exclude-standard', '-z', '--', '.', FORA]).toString().split('\0').filter(Boolean).sort()
    for (const f of novos) {
      h.update(f + '\0')
      try {
        h.update(readFileSync(join(raiz, f)))
      } catch {
        /* sumiu entre a listagem e a leitura: o nome já entrou na conta */
      }
    }
    return h.digest('hex').slice(0, 16)
  } catch {
    return null
  }
}

/** A árvore tem mudança em relação ao HEAD (fora da pasta de auditoria)? */
export function arvoreMudou(raiz) {
  try {
    if (git(raiz, ['diff', 'HEAD', '--quiet', '--', '.', FORA]).length) return true
  } catch {
    return true // --quiet sai 1 quando há diferença
  }
  try {
    return git(raiz, ['ls-files', '--others', '--exclude-standard', '--', '.', FORA]).toString().trim() !== ''
  } catch {
    return false
  }
}

/** O aidlc-gate grava cada execução: quando, se passou, de que tecnologia e em que árvore. */
export function registrarGate(raiz, rec) {
  if (process.env.AIDLC_AUDIT === '0') return
  try {
    const dir = join(raiz, AUDIT_DIR)
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, `gate-${new Date().toISOString().slice(0, 10)}.jsonl`), JSON.stringify({ at: new Date().toISOString(), hook: 'aidlc-gate', ...rec }) + '\n')
  } catch {
    /* registro é best-effort; o gate não depende dele */
  }
}

/** A última execução do gate nesta árvore passou? */
export function gateVerdeNaArvore(raiz, arvore) {
  if (!arvore) return false
  const dir = join(raiz, AUDIT_DIR)
  if (!existsSync(dir)) return false
  let ultima = null
  for (const f of readdirSync(dir).filter((x) => /^gate-.*\.jsonl$/.test(x)).sort()) {
    for (const l of readFileSync(join(dir, f), 'utf8').split('\n')) {
      try {
        const r = JSON.parse(l)
        if (r.hook === 'aidlc-gate' && r.arvore === arvore) ultima = r
      } catch {
        /* linha quebrada */
      }
    }
  }
  return ultima?.ok === true
}
