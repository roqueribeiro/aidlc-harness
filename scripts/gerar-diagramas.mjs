#!/usr/bin/env node
/*
 * Gera os diagramas da documentacao (SVG, tema claro e escuro) a partir do codigo em
 * scripts/diagramas/.
 *
 *   node scripts/gerar-diagramas.mjs          # escreve docs/assets/diagramas/*.svg (pt e en)
 *   node scripts/gerar-diagramas.mjs --check  # reprova se o SVG versionado difere do que o codigo gera
 *
 * O --check e o mecanismo: sem ele, o diagrama envelhece calado e diz "8 hooks" quando o kit
 * tem 9. O CI roda o --check.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Desenho, TEMAS } from './diagramas/lib.mjs'
import { DIAGRAMAS, inventario } from './diagramas/diagramas.mjs'

const AQUI = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const argv = process.argv.slice(2)
const rootArg = argv.indexOf('--root')
const RAIZ = rootArg >= 0 ? resolve(argv[rootArg + 1]) : AQUI
const SAIDA = join(RAIZ, 'docs/assets/diagramas')
/** Idiomas gerados. 'pt' e o padrao (sem sufixo); os demais viram `<nome>.<idioma>.<tema>.svg`. O logo nao tem texto e so existe em 'pt'. */
export const IDIOMAS = ['pt', 'en']
const CHECK = argv.includes('--check')

/** Todos os SVG que o codigo produz agora: { 'contexto.claro.svg': '<svg...' }. */
export function gerarTodos(raiz = RAIZ) {
  const inv = inventario(raiz)
  const out = {}
  for (const dg of DIAGRAMAS) {
    for (const idioma of dg.semIdioma ? ['pt'] : IDIOMAS) {
      for (const [nomeTema, tema] of Object.entries(TEMAS)) {
        const d = new Desenho(dg.desc, dg.largura, dg.altura, tema, idioma)
        dg.desenha(d, inv)
        out[`${dg.arquivo}${idioma === 'pt' ? '' : '.' + idioma}.${nomeTema}.svg`] = d.svg()
      }
    }
  }
  return out
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const gerados = gerarTodos()
  if (CHECK) {
    const problemas = []
    for (const [nome, svg] of Object.entries(gerados)) {
      const p = join(SAIDA, nome)
      if (!existsSync(p)) problemas.push(`${nome}: nao existe (rode node scripts/gerar-diagramas.mjs)`)
      else if (readFileSync(p, 'utf8') !== svg) problemas.push(`${nome}: difere do que o codigo gera (rode node scripts/gerar-diagramas.mjs)`)
    }
    if (existsSync(SAIDA)) {
      for (const f of readdirSync(SAIDA).filter((f) => f.endsWith('.svg'))) {
        if (!(f in gerados)) problemas.push(`${f}: sobrando, nenhum diagrama o gera mais`)
      }
    }
    if (problemas.length) {
      console.error('diagramas desatualizados:\n' + problemas.map((p) => '  ' + p).join('\n'))
      process.exit(1)
    }
    console.log(`ok, ${Object.keys(gerados).length} SVG acompanham o codigo`)
  } else {
    mkdirSync(SAIDA, { recursive: true })
    for (const [nome, svg] of Object.entries(gerados)) writeFileSync(join(SAIDA, nome), svg)
    console.log(`${Object.keys(gerados).length} SVG escritos em docs/assets/diagramas/`)
  }
}
