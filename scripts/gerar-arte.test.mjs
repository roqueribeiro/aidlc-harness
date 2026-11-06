#!/usr/bin/env node
/*
 * O banner e o social preview são PNG (não dá para comparar pixel no CI sem navegador), mas o que
 * eles dizem e muda com o disco (ferramentas, stacks, hooks, versão, lema) fica num carimbo. Versão
 * nova sem rodar `node scripts/gerar-arte.mjs` deixaria o banner mentindo: este teste reprova.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CARIMBO, conteudoDoCarimbo } from './gerar-arte.mjs'
import { inventario } from './diagramas/diagramas.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')

test('o banner foi gerado com os números e a versão de agora (rode node scripts/gerar-arte.mjs)', () => {
  const gravado = JSON.parse(readFileSync(join(RAIZ, CARIMBO), 'utf8'))
  assert.deepEqual(gravado, JSON.parse(JSON.stringify(conteudoDoCarimbo(inventario(RAIZ)))))
})

test('as peças que o README e o GitHub usam existem', () => {
  for (const f of ['docs/assets/marca/banner.en.jpg', 'docs/assets/marca/banner.pt.jpg', 'docs/assets/social-preview.png', 'docs/assets/marca/logo-512.png', 'docs/assets/marca/logo-1024.png', 'docs/assets/marca/fontes/OFL-InterTight.txt', 'docs/assets/marca/fontes/OFL-GeistMono.txt']) assert.ok(existsSync(join(RAIZ, f)), f)
})

test('mutante: versão diferente da gravada no carimbo reprova', () => {
  const inv = { ...inventario(RAIZ), versao: '9.9.9' }
  const gravado = JSON.parse(readFileSync(join(RAIZ, CARIMBO), 'utf8'))
  assert.notDeepEqual(gravado, JSON.parse(JSON.stringify(conteudoDoCarimbo(inv))))
})
