/**
 * Diz se o modulo esta rodando como programa (e nao importado por um teste).
 *
 * A comparacao ingenua `resolve(process.argv[1]) === fileURLToPath(import.meta.url)` falha
 * quando o caminho chega por um link simbolico: no macOS, /var e um link para /private/var,
 * entao um script copiado para a pasta temporaria e chamado por /var/... nao se reconhece,
 * nao faz nada e sai com 0. Um check que sai 0 sem rodar e o pior defeito que um check pode
 * ter. Por isso os dois lados passam por realpath.
 */
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function ehPrincipal(metaUrl) {
  if (!process.argv[1]) return false
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl))
  } catch {
    return false
  }
}
