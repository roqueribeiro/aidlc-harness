/*
 * O que no package.json mexe no lockfile.
 *
 * O `aidlc-lockcheck` cobra lockfile novo quando o package.json muda. Mas script, nome, versao
 * e metadado nao entram no lockfile: o yarn 1 nao toca no yarn.lock se so um script muda. Cobrar
 * lockfile nesse caso reprova um diff que o gerenciador nunca regeneraria, e o unico jeito de
 * passar seria mexer no lockfile a mao. Exemplo: trocar so um
 * argumento de script nao muda dependencia nenhuma, e o gate reprovaria por `lock-para-tras`.
 *
 * Contam os campos que mudam o que se instala: as tres listas de dependencia que o lockcheck ja
 * confere, `resolutions` (yarn), `overrides` (npm) e `workspaces`. `peerDependencies` conta so
 * no package-lock: o npm 7 em diante instala o peer e o grava no lockfile; o yarn 1 nao.
 */

export const CAMPOS_DO_LOCK = Object.freeze([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'resolutions',
  'overrides',
  'workspaces',
])

/** So os campos do package.json que mexem no lockfile dado. */
export function camposDoLock(pkg, lock = 'yarn.lock') {
  const campos = lock === 'yarn.lock' ? CAMPOS_DO_LOCK : [...CAMPOS_DO_LOCK, 'peerDependencies']
  const out = {}
  for (const campo of campos) {
    if (pkg && pkg[campo] !== undefined) out[campo] = pkg[campo]
  }
  return out
}

/* Chave de objeto em ordem: reordenar as dependencias nao muda o que se instala. Lista fica
 * como esta, porque a ordem de `workspaces` e dado. */
function emOrdem(valor) {
  if (Array.isArray(valor)) return valor.map(emOrdem)
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.keys(valor)
        .sort()
        .map((k) => [k, emOrdem(valor[k])]),
    )
  }
  return valor
}

/** Se o que se instala mudou entre dois package.json, para o lockfile dado. */
export function dependenciasMudaram(antes, depois, lock = 'yarn.lock') {
  const a = JSON.stringify(emOrdem(camposDoLock(antes, lock)))
  const b = JSON.stringify(emOrdem(camposDoLock(depois, lock)))
  return a !== b
}
