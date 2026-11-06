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
