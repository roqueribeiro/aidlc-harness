#!/usr/bin/env node
/*
 * definir-dono: troca os marcadores de dono e de contato pelos valores reais, e confere que não sobrou nenhum.
 *
 *   node scripts/definir-dono.mjs --check                              # exit 1 se sobrou marcador (gate de publicação)
 *   node scripts/definir-dono.mjs --owner meu-usuario --email a@b.org  # troca nos arquivos versionados
 *   ... --dry-run                                                      # mostra o que trocaria
 *
 * Marcadores: SEU-USUARIO (dono do repositório no GitHub) e SEU-EMAIL-DE-CONTATO (para código de conduta e segurança).
 *
 * Por que existe: o repositório nasce com marcadores para não carregar a identidade de ninguém. Publicar com
 * `@SEU-USUARIO` no CODEOWNERS e no README é um defeito invisível; a conferência torna o esquecimento visível.
 *
 * Fora do escopo, de propósito: `templates/aberto/**` (modelos que o aplicar-repo-aberto preenche para OUTRO
 * repositório), os arquivos de teste e este script.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MARCADORES = { owner: 'SEU-USUARIO', email: 'SEU-EMAIL-DE-CONTATO' }

export function foraDoEscopo(rel) {
  return (
    rel.startsWith('plugins/aidlc-harness/templates/aberto/') ||
    rel.endsWith('.test.mjs') ||
    rel === 'scripts/definir-dono.mjs' ||
    /\.(png|jpg|jpeg|gif|ico|svg|pdf)$/i.test(rel)
  )
}

/** Ocorrências de cada marcador num texto: [{ marcador, linha }]. */
export function achar(texto) {
  const achados = []
  texto.split('\n').forEach((l, i) => {
    for (const m of Object.values(MARCADORES)) if (l.includes(m)) achados.push({ marcador: m, linha: i + 1 })
  })
  return achados
}

export function trocar(texto, { owner, email }) {
  let t = texto
  if (owner) t = t.replaceAll(MARCADORES.owner, owner)
  if (email) t = t.replaceAll(MARCADORES.email, email)
  return t
}

export function valido({ owner, email }) {
  const erros = []
  if (owner !== undefined && !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(owner)) erros.push(`--owner inválido: ${owner}`)
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push(`--email inválido: ${email}`)
  return erros
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const val = (n) => {
    const i = args.indexOf(n)
    return i >= 0 ? args[i + 1] : undefined
  }
  const RAIZ = resolve(val('--root') ?? join(dirname(fileURLToPath(import.meta.url)), '..'))
  const owner = val('--owner')
  const email = val('--email')
  const check = args.includes('--check')
  const seco = args.includes('--dry-run')
  const erros = valido({ owner, email })
  if (erros.length) {
    console.error(erros.join('\n'))
    process.exit(2)
  }
  if (!check && !owner && !email) {
    console.error('uso: definir-dono.mjs --check | --owner <usuario> [--email <contato>] [--dry-run]')
    process.exit(2)
  }
  const arquivos = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\0')
    .filter((f) => f && !foraDoEscopo(f))
  let restantes = 0
  for (const rel of arquivos) {
    let texto
    try {
      texto = readFileSync(join(RAIZ, rel), 'utf8')
    } catch {
      continue
    }
    const achados = achar(texto)
    if (!achados.length) continue
    if (check) {
      for (const a of achados) console.log(`${rel}:${a.linha}  ${a.marcador}`)
      restantes += achados.length
    } else {
      const novo = trocar(texto, { owner, email })
      console.log(`${seco ? 'trocaria' : 'trocou'}  ${rel}  (${achados.length})`)
      if (!seco) writeFileSync(join(RAIZ, rel), novo)
    }
  }
  if (check) {
    console.log(restantes ? `\ndefinir-dono: ${restantes} marcador(es) por trocar` : 'definir-dono: nenhum marcador sobrando')
    process.exit(restantes ? 1 : 0)
  }
}
