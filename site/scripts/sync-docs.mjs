#!/usr/bin/env node
/*
 * sync-docs: monta o conteúdo do site a partir de docs/ e dos READMEs, sem cópia escrita à mão.
 *
 * O site não tem texto próprio. Cada página vem de um arquivo do repositório, e o que muda é só o
 * que a web exige: front matter com o título, links relativos `.md` trocados pela rota do site,
 * imagens de docs/assets servidas pelo site, e links para código apontando o GitHub. A tabela de
 * pares (inglês e português) é a mesma do check-i18n, então o seletor de idioma sempre acha o par.
 *
 *   node scripts/sync-docs.mjs          # regrava src/content/docs e public/assets
 *   node scripts/sync-docs.mjs --check  # sai 1 se algum link relativo não tiver destino
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PARES } from '../../scripts/check-i18n.mjs'
import { FERRAMENTAS, ADAPTADORES } from '../../plugins/aidlc-harness/lib/adaptadores.mjs'

const SITE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RAIZ = resolve(SITE, '..')
const BASE = '/aidlc-harness'
const REPO = 'https://github.com/roqueribeiro/aidlc-harness'
const SAIDA = join(SITE, 'src', 'content', 'docs')

/** Documento em inglês -> rota do site (sem barra). O português usa a mesma rota sob pt-br/. */
// docs/INDEX.md vira /docs/: a raiz do site é o README, e as duas não podem disputar o index.
const rotaEn = (en) => (en === 'README.md' ? '' : en === 'docs/INDEX.md' ? 'docs' : en.replace(/^docs\//, '').replace(/\.md$/, '').toLowerCase())

/** Todas as páginas: arquivo de origem -> rota. */
export function paginas() {
  const mapa = new Map()
  for (const [en, pt] of Object.entries(PARES)) {
    mapa.set(en, rotaEn(en))
    mapa.set(pt, posix.join('pt-br', rotaEn(en)))
  }
  mapa.set('docs/TOOLS.md', 'tools')
  mapa.set('docs/pt-BR/FERRAMENTAS.md', 'pt-br/tools')
  for (const id of FERRAMENTAS) {
    mapa.set(`docs/tools/${id}.md`, `tools/${id}`)
    mapa.set(`docs/pt-BR/ferramentas/${id}.md`, `pt-br/tools/${id}`)
  }
  // Duas páginas na mesma rota: a segunda apagaria a primeira em silêncio (aconteceu com o índice).
  const vistas = new Map()
  for (const [origem, rota] of mapa) {
    if (vistas.has(rota)) throw new Error(`rota ${rota || '/'} disputada por ${vistas.get(rota)} e ${origem}`)
    vistas.set(rota, origem)
  }
  return mapa
}

const urlDaRota = (rota) => `${BASE}/${rota ? rota + '/' : ''}`

/** Troca um alvo relativo (visto a partir de `origem`) pelo endereço que funciona no site. */
export function reescreverAlvo(alvo, origem, mapa, faltando) {
  if (/^(https?:|mailto:|#)/.test(alvo)) return alvo
  const [caminho, ancora] = alvo.split('#')
  const rel = posix.normalize(posix.join(posix.dirname(origem), caminho))
  if (mapa.has(rel)) return urlDaRota(mapa.get(rel)) + (ancora ? `#${ancora}` : '')
  if (rel.startsWith('docs/assets/')) return `${BASE}/${rel.replace(/^docs\//, '')}`
  if (existsSync(join(RAIZ, rel))) return `${REPO}/blob/main/${rel}${ancora ? `#${ancora}` : ''}`
  faltando.push(`${origem}: ${alvo}`)
  return alvo
}

function converter(texto, origem, mapa, faltando) {
  const linhas = texto.replace(/\r\n/g, '\n').split('\n')
  // O título vai para o front matter; o Starlight o desenha.
  const iTitulo = linhas.findIndex((l) => /^# /.test(l))
  let titulo = iTitulo >= 0 ? linhas[iTitulo].slice(2).trim() : 'aidlc-harness'
  if (iTitulo >= 0) linhas.splice(iTitulo, 1)
  if (/README/.test(origem)) titulo = 'aidlc-harness'
  let corpo = linhas.join('\n')
  if (/README/.test(origem)) {
    // No site, o cabeçalho do GitHub (selos e navegação) é a própria interface, e o sumário é a barra lateral.
    let n = 0
    corpo = corpo.replace(/<p align="center">[\s\S]*?<\/p>\n*/g, (m) => (n++ === 0 ? m : ''))
    corpo = corpo.replace(/^## (Contents|Conteúdo)\n[\s\S]*?(?=^## )/m, '')
  }
  // Alerta do GitHub (> [!NOTE]) vira o aviso do Starlight.
  corpo = corpo.replace(/^> \[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\n((?:^>.*\n?)+)/gm, (_, tipo, txt) => {
    const t = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'note', WARNING: 'caution', CAUTION: 'danger' }[tipo]
    return `:::${t}\n${txt.replace(/^> ?/gm, '').trimEnd()}\n:::\n`
  })
  // A frase "Also available in ..." vira o seletor de idioma do site.
  corpo = corpo.replace(/^\*(Also available in|Também em|Também disponível em) \[[^\]]+\]\([^)]+\)[^*]*\*\n\n?/m, '')
  // Só fora dos blocos de código: um exemplo de HTML dentro de ``` é texto, não link.
  corpo = corpo
    .split(/(^```[\s\S]*?^```)/m)
    .map((parte, i) =>
      i % 2
        ? parte
        : parte
            .replace(/\]\(([^)\s]+)\)/g, (_, alvo) => `](${reescreverAlvo(alvo, origem, mapa, faltando)})`)
            .replace(/\b(src|href|srcset)="([^"]+)"/g, (_, attr, alvo) => `${attr}="${reescreverAlvo(alvo, origem, mapa, faltando)}"`)
            .replace(/<(https?:[^>]+)>/g, '[$1]($1)'),
    )
    .join('')
  const frente = ['---', `title: ${JSON.stringify(titulo.replace(/`/g, ''))}`, `editUrl: ${JSON.stringify(`${REPO}/edit/main/${origem}`)}`]
  if (/README/.test(origem)) frente.push('tableOfContents: false')
  frente.push('---', '')
  return frente.join('\n') + corpo.trimStart()
}

/** A barra lateral, nos dois idiomas, na ordem em que alguém novo lê. */
export function barraLateral() {
  const t = (en, pt) => ({ label: en, translations: { 'pt-BR': pt } })
  const ferramentas = FERRAMENTAS.map((id) => ({ label: ADAPTADORES[id].nome, link: `/tools/${id}/` }))
  return [
    { ...t('Start here', 'Comece aqui'), items: [
      { ...t('Overview', 'Visão geral'), link: '/' },
      { ...t('Getting started', 'Começar'), link: '/getting-started/' },
      { ...t('AI tools', 'Ferramentas de IA'), link: '/tools/' },
    ] },
    { ...t('Your AI tool', 'Sua ferramenta de IA'), collapsed: false, items: ferramentas },
    { ...t('The method', 'O método'), items: [
      { label: 'AI-DLC', link: '/aidlc/' },
      { ...t('Adapters', 'Adaptadores'), link: '/adapters/' },
      { ...t('Regulated companies', 'Empresa regulada'), link: '/regulated/' },
      { ...t('Operating model', 'Modelo de operação'), link: '/operating-model/' },
    ] },
    { ...t('Reference', 'Referência'), items: [
      { ...t('Reference', 'Referência'), link: '/reference/' },
      { ...t('Architecture', 'Arquitetura'), link: '/architecture/' },
      { ...t('Integrations', 'Integrações'), link: '/integrations/' },
      { label: 'RoqueShield', link: '/roqueshield/' },
      { ...t('When it breaks', 'Quando quebra'), link: '/when-it-breaks/' },
      { ...t('Extending', 'Estender'), link: '/extending/' },
      { ...t('Strategy', 'Estratégia'), link: '/strategy/' },
      { ...t('Glossary', 'Glossário'), link: '/glossary/' },
      { ...t('Contributing', 'Contribuir'), link: '/contributing/' },
      { ...t('All documents', 'Todos os documentos'), link: '/docs/' },
    ] },
  ]
}

export function sincronizar({ escrever = true } = {}) {
  const mapa = paginas()
  const faltando = []
  if (escrever) rmSync(SAIDA, { recursive: true, force: true })
  for (const [origem, rota] of mapa) {
    const p = join(RAIZ, origem)
    if (!existsSync(p)) {
      faltando.push(`${origem}: arquivo de origem nao existe`)
      continue
    }
    const conteudo = converter(readFileSync(p, 'utf8'), origem, mapa, faltando)
    if (!escrever) continue
    const destino = join(SAIDA, rota === '' ? 'index.md' : rota.endsWith('pt-br') ? 'pt-br/index.md' : `${rota}.md`)
    mkdirSync(dirname(destino), { recursive: true })
    writeFileSync(destino, conteudo)
  }
  if (escrever) {
    rmSync(join(SITE, 'public', 'assets'), { recursive: true, force: true })
    cpSync(join(RAIZ, 'docs', 'assets'), join(SITE, 'public', 'assets'), { recursive: true })
    mkdirSync(join(SITE, 'src', 'assets'), { recursive: true })
    cpSync(join(RAIZ, 'docs', 'assets', 'diagramas', 'logo.claro.svg'), join(SITE, 'src', 'assets', 'marca.svg'))
    cpSync(join(RAIZ, 'docs', 'assets', 'diagramas', 'logo.claro.svg'), join(SITE, 'public', 'favicon.svg'))
  }
  return { paginas: mapa.size, faltando }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check')
  const r = sincronizar({ escrever: !check })
  if (r.faltando.length) {
    console.log(`links sem destino no site:\n${r.faltando.map((f) => `  ${f}`).join('\n')}`)
    process.exit(1)
  }
  console.log(`ok, ${r.paginas} paginas ${check ? 'conferidas' : 'escritas em src/content/docs'}`)
}
