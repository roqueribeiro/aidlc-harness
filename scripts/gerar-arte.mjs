#!/usr/bin/env node
/*
 * gerar-arte: o banner do README (inglês e português), o social preview e o logo em PNG, a partir
 * da marca do gerador de diagramas, da arte em docs/assets/marca/ e das fontes do design system.
 *
 *   node scripts/gerar-arte.mjs
 *
 * Por que é um script e não um PNG feito à mão: os números do banner (ferramentas, stacks, versão)
 * saem do disco, como nos diagramas, e o texto é composto em Inter Tight e Geist Mono, não
 * desenhado pela IA de imagem (que erra letra). A arte de fundo (arte-esteira.jpg) foi gerada com
 * IA de imagem sem nenhum texto, de propósito.
 *
 * Precisa do Playwright com Chromium (`npx playwright install chromium`), que não é dependência do
 * kit: por isso este script não roda no CI nem no gate. Os PNG ficam versionados.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { ehPrincipal } from './lib/principal.mjs'
import { inventario } from './diagramas/diagramas.mjs'
import { FERRAMENTAS } from '../plugins/aidlc-harness/lib/adaptadores.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MARCA = join(RAIZ, 'docs/assets/marca')
const url = (p) => pathToFileURL(join(RAIZ, p)).href

export const TEXTOS = {
  en: {
    olho: 'OPEN SOURCE · MIT · AI-DLC',
    lema: ['Done requires evidence.', 'A rule without a mechanism is decoration.'],
    sub: 'The quality kit for building software with AI agents, from the Inception to a green gate.',
    numeros: (inv) => [`${FERRAMENTAS.length} AI tools`, `${inv.tecnologias.length} stacks`, `${inv.hooks.length} hooks`, `<span style="text-transform:none">v${inv.versao}</span>`],
  },
  pt: {
    olho: 'CÓDIGO ABERTO · MIT · AI-DLC',
    lema: ['Pronto exige evidência.', 'Regra sem mecanismo é decoração.'],
    sub: 'O kit de qualidade para construir software com agentes de IA, da Inception ao gate verde.',
    numeros: (inv) => [`${FERRAMENTAS.length} ferramentas de IA`, `${inv.tecnologias.length} stacks`, `${inv.hooks.length} hooks`, `<span style="text-transform:none">v${inv.versao}</span>`],
  },
}

const fontes = `
@font-face{font-family:"Inter Tight";src:url("${url('docs/assets/marca/fontes/InterTight.ttf')}") format("truetype");font-weight:100 900}
@font-face{font-family:"Geist Mono";src:url("${url('docs/assets/marca/fontes/GeistMono.ttf')}") format("truetype");font-weight:100 900}
`
const base = `*{box-sizing:border-box}html,body{margin:0}body{background:#07080f;color:#f2f4fa;font-family:"Inter Tight",system-ui,sans-serif;-webkit-font-smoothing:antialiased}`

/** O que o banner mostra e muda com o disco: o teste compara com o carimbo gravado na última geração. */
export const CARIMBO = 'docs/assets/marca/carimbo.json'
export const conteudoDoCarimbo = (inv) => ({ en: TEXTOS.en.numeros(inv), pt: TEXTOS.pt.numeros(inv), lema: { en: TEXTOS.en.lema, pt: TEXTOS.pt.lema } })

/** O nome: "aidlc" na tinta, "-harness" no acento, Inter Tight 800 com tracking negativo. */
const nome = (px) => `<span style="font-weight:800;font-size:${px}px;letter-spacing:-0.025em;line-height:1">aidlc<span style="color:#3d96ff">-harness</span></span>`

export function htmlDoBanner(l, inv) {
  const t = TEXTOS[l]
  return `<!doctype html><meta charset="utf-8"><style>${fontes}${base}
  .palco{position:relative;width:1600px;height:560px;overflow:hidden;background:#07080f}
  .arte{position:absolute;right:-40px;top:-150px;width:1300px;height:auto}
  .veu{position:absolute;inset:0;background:linear-gradient(90deg,#07080f 0%,#07080f 30%,rgba(7,8,15,.86) 46%,rgba(7,8,15,.25) 66%,rgba(7,8,15,0) 80%),linear-gradient(0deg,#07080f 0%,rgba(7,8,15,0) 22%)}
  .txt{position:absolute;left:84px;top:78px;width:760px}
  .olho{font-family:"Geist Mono",monospace;font-size:14px;font-weight:500;letter-spacing:.12em;color:#b0b2b8;display:flex;align-items:center;gap:12px}
  .olho:before{content:"";width:28px;height:2px;background:#007aff}
  .titulo{display:flex;align-items:center;gap:22px;margin-top:30px}
  .lema{margin-top:30px;font-size:40px;font-weight:700;letter-spacing:-0.015em;line-height:1.12}
  .lema div+div{color:#b0b2b8}
  .sub{margin-top:22px;font-family:"Inter Tight",sans-serif;font-size:20px;font-weight:400;line-height:1.45;color:#b0b2b8;max-width:640px}
  .nums{position:absolute;left:84px;bottom:56px;font-family:"Geist Mono",monospace;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:#f2f4fa;display:flex;gap:28px}
  .nums span+span:before{content:"·";margin-right:28px;color:#3d96ff}
  </style><div class="palco"><img class="arte" src="${url('docs/assets/marca/arte-esteira.jpg')}"><div class="veu"></div>
  <div class="txt"><div class="olho">${t.olho}</div>
  <div class="titulo"><img src="${url('docs/assets/diagramas/logo.claro.svg')}" width="92" height="92">${nome(78)}</div>
  <div class="lema">${t.lema.map((x) => `<div>${x}</div>`).join('')}</div>
  <div class="sub">${t.sub}</div></div>
  <div class="nums">${t.numeros(inv).map((n) => `<span>${n}</span>`).join('')}</div></div>`
}

export function htmlDoSocial(inv) {
  const t = TEXTOS.en
  return `<!doctype html><meta charset="utf-8"><style>${fontes}${base}
  .palco{position:relative;width:1280px;height:640px;overflow:hidden;background:#07080f}
  .arte{position:absolute;right:-330px;top:-40px;width:1180px}
  .veu{position:absolute;inset:0;background:linear-gradient(90deg,#07080f 0%,#07080f 40%,rgba(7,8,15,.8) 56%,rgba(7,8,15,0) 78%),linear-gradient(0deg,#07080f 0%,rgba(7,8,15,0) 25%)}
  .txt{position:absolute;left:72px;top:150px}
  .titulo{display:flex;align-items:center;gap:20px}
  .lema{margin-top:34px;font-size:36px;font-weight:700;letter-spacing:-0.015em;line-height:1.14}
  .lema div+div{color:#b0b2b8}
  .nums{position:absolute;left:72px;bottom:64px;font-family:"Geist Mono",monospace;font-size:16px;letter-spacing:.1em;text-transform:uppercase;display:flex;gap:24px}
  .nums span+span:before{content:"·";margin-right:24px;color:#3d96ff}
  </style><div class="palco"><img class="arte" src="${url('docs/assets/marca/arte-esteira.jpg')}"><div class="veu"></div>
  <div class="txt"><div class="titulo"><img src="${url('docs/assets/diagramas/logo.claro.svg')}" width="96" height="96">${nome(84)}</div>
  <div class="lema">${t.lema.map((x) => `<div>${x}</div>`).join('')}</div></div>
  <div class="nums">${t.numeros(inv).map((n) => `<span>${n}</span>`).join('')}</div></div>`
}

/** O logo horizontal (marca + nome) sobre fundo transparente, para fundo claro e escuro. */
export function htmlDoLogoHorizontal(tema) {
  const tinta = tema === 'escuro' ? '#f2f4fa' : '#07080f'
  const acento = tema === 'escuro' ? '#3d96ff' : '#0066cc'
  return `<!doctype html><meta charset="utf-8"><style>${fontes}${base}body{background:transparent}
  .l{display:inline-flex;align-items:center;gap:18px;padding:12px 16px;color:${tinta}}</style>
  <div class="l"><img src="${url('docs/assets/diagramas/logo.claro.svg')}" width="80" height="80"><span style="font-weight:800;font-size:64px;letter-spacing:-0.025em;line-height:1">aidlc<span style="color:${acento}">-harness</span></span></div>`
}

async function renderizar(chromium, html, saida, { largura, altura, escala = 2, transparente = false, seletor = null, jpeg = false }) {
  const b = await chromium.launch()
  const pg = await b.newPage({ viewport: { width: largura, height: altura }, deviceScaleFactor: escala })
  const tmp = join(MARCA, '.render.html')
  writeFileSync(tmp, html)
  await pg.goto(pathToFileURL(tmp).href)
  await pg.evaluate(() => document.fonts.ready)
  await pg.waitForTimeout(150)
  const alvo = seletor ? await pg.$(seletor) : pg
  await alvo.screenshot({ path: saida, omitBackground: transparente, ...(jpeg ? { type: 'jpeg', quality: 92 } : {}) })
  await b.close()
  const { rmSync } = await import('node:fs')
  rmSync(tmp, { force: true })
  console.log(`escrito ${saida.replace(RAIZ + '/', '')}`)
}

if (ehPrincipal(import.meta.url)) {
  let chromium
  try {
    // `require` acha o Playwright instalado globalmente; `import` de ESM só olharia node_modules do repo.
    ;({ chromium } = (await import('node:module')).createRequire(import.meta.url)('playwright'))
  } catch {
    console.error('gerar-arte: precisa do Playwright (npm i -D playwright e npx playwright install chromium); nao e dependencia do kit')
    process.exit(2)
  }
  const inv = inventario(RAIZ)
  mkdirSync(MARCA, { recursive: true })
  for (const l of ['en', 'pt']) await renderizar(chromium, htmlDoBanner(l, inv), join(MARCA, `banner.${l}.jpg`), { largura: 1600, altura: 560, jpeg: true })
  await renderizar(chromium, htmlDoSocial(inv), join(RAIZ, 'docs/assets/social-preview.png'), { largura: 1280, altura: 640, escala: 1 })
  for (const tema of ['claro', 'escuro']) await renderizar(chromium, htmlDoLogoHorizontal(tema), join(MARCA, `logo-horizontal.${tema}.png`), { largura: 800, altura: 200, transparente: true, seletor: '.l' })
  writeFileSync(join(RAIZ, CARIMBO), JSON.stringify(conteudoDoCarimbo(inv), null, 2) + '\n')
  console.log(`escrito ${CARIMBO}`)
  const logo = `<!doctype html><style>html,body{margin:0;background:transparent}</style><img src="${url('docs/assets/diagramas/logo.claro.svg')}" width="512" height="512">`
  await renderizar(chromium, logo, join(MARCA, 'logo-1024.png'), { largura: 512, altura: 512, transparente: true })
  await renderizar(chromium, logo, join(MARCA, 'logo-512.png'), { largura: 512, altura: 512, escala: 1, transparente: true })
}
