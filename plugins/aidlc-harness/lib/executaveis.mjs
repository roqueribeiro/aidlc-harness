/*
 * Os gates chamam executáveis do kit pelo nome (`aidlc-secscan`, `aidlc-lockcheck`, `aidlc-scan`).
 *
 * Pôr a pasta deles no PATH não basta: na cópia do kit dentro do projeto (.aidlc/kit/) o arquivo não
 * tem bit de execução (o git do Windows e `core.fileMode=false` também o perdem), e no Windows um
 * arquivo sem extensão não roda pelo nome. O primeiro gate saía com "Permission denied" (127). Aqui
 * o nome do kit no começo de cada comando vira `"<node>" "<caminho do executável>"`, que roda em
 * qualquer sistema e com qualquer permissão de arquivo.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const aspas = (p) => `"${p}"`

/** Troca `aidlc-<nome>` no início do comando e depois de `&&`, `||`, `;` e `|` pelo node do kit. */
export function comandoDoGate(cmd, pastaDosExecutaveis, node = process.execPath) {
  return cmd.replace(/(^|&&|\|\||;|\|)(\s*)(aidlc-[a-z-]+)(?=\s|$)/g, (todo, sep, esp, nome) => {
    const p = join(pastaDosExecutaveis, nome)
    return existsSync(p) ? `${sep}${esp}${aspas(node)} ${aspas(p)}` : todo
  })
}
