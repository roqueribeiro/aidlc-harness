/*
 * Uma DSL minima de desenho para os diagramas da documentacao.
 *
 * Por que codigo e nao ferramenta de diagrama: layout automatico empurra caixa para onde
 * couber e o leitor perde a forma do sistema. Aqui cada coordenada e decisao de quem desenha,
 * e o desenho sai igual toda vez, entao `gerar-diagramas.mjs --check` consegue dizer quando o
 * SVG versionado ficou para tras do codigo.
 *
 * A trava que impede o defeito mais comum (texto que vaza da caixa): `caixa` mede o texto e
 * LANCA ERRO se ele nao couber. Um diagrama com texto cortado nao e gerado.
 */

export const TEMAS = {
  claro: {
    fundo: '#ffffff',
    texto: '#0f172a',
    suave: '#475569',
    caixa: '#f8fafc',
    borda: '#cbd5e1',
    destaque: '#2563eb',
    destaqueFundo: '#dbeafe',
    verde: '#15803d',
    verdeFundo: '#dcfce7',
    ambar: '#b45309',
    ambarFundo: '#fef3c7',
    vermelho: '#b91c1c',
    vermelhoFundo: '#fee2e2',
    roxo: '#6d28d9',
    roxoFundo: '#ede9fe',
    faixa: '#f1f5f9',
  },
  escuro: {
    fundo: '#0b1220',
    texto: '#e2e8f0',
    suave: '#94a3b8',
    caixa: '#111a2e',
    borda: '#334155',
    destaque: '#60a5fa',
    destaqueFundo: '#13284d',
    verde: '#4ade80',
    verdeFundo: '#0f2a1b',
    ambar: '#fbbf24',
    ambarFundo: '#33250a',
    vermelho: '#f87171',
    vermelhoFundo: '#341414',
    roxo: '#a78bfa',
    roxoFundo: '#241a45',
    faixa: '#0f172a',
  },
}

const FONTE = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"

/** Largura estimada de um texto, em px. Conservadora de proposito: erra para o lado de sobrar caixa. */
export const largura = (texto, tam, mono = false) => String(texto).length * tam * (mono ? 0.62 : 0.58)

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const r2 = (n) => Math.round(n * 100) / 100

export class Desenho {
  constructor(nome, largura_, altura, tema) {
    this.nome = nome
    this.w = largura_
    this.h = altura
    this.t = tema
    this.partes = []
    this.defs = []
  }

  #cor(k) {
    return this.t[k] ?? k
  }

  /** Titulo e subtitulo do diagrama, no topo. */
  titulo(texto, sub) {
    this.partes.push(`<text x="32" y="44" font-size="22" font-weight="700" fill="${this.t.texto}">${esc(texto)}</text>`)
    if (sub) this.partes.push(`<text x="32" y="68" font-size="13" fill="${this.t.suave}">${esc(sub)}</text>`)
    return this
  }

  /** Faixa de agrupamento (uma fronteira, uma camada). */
  faixa(x, y, w, h, rotulo, { cor = 'faixa', borda = 'borda', tracejado = false } = {}) {
    this.partes.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${this.#cor(cor)}" stroke="${this.#cor(borda)}" stroke-width="1.2"${tracejado ? ' stroke-dasharray="6 5"' : ''}/>`,
    )
    if (rotulo) this.partes.push(`<text x="${x + 14}" y="${y + 22}" font-size="12" font-weight="700" letter-spacing="0.6" fill="${this.t.suave}">${esc(rotulo.toUpperCase())}</text>`)
    return this
  }

  /**
   * Uma caixa com titulo e linhas. Mede e lanca erro se o texto nao couber.
   * `tipo`: neutro | destaque | verde | ambar | vermelho | roxo.
   */
  caixa(x, y, w, h, titulo, linhas = [], { tipo = 'neutro', mono = false, tamanho = 14 } = {}) {
    const fundo = { neutro: 'caixa', destaque: 'destaqueFundo', verde: 'verdeFundo', ambar: 'ambarFundo', vermelho: 'vermelhoFundo', roxo: 'roxoFundo' }[tipo]
    const borda = { neutro: 'borda', destaque: 'destaque', verde: 'verde', ambar: 'ambar', vermelho: 'vermelho', roxo: 'roxo' }[tipo]
    const util = w - 20
    if (largura(titulo, tamanho + 1) > util) throw new Error(`[${this.nome}] titulo "${titulo}" nao cabe em ${w}px (precisa ${Math.ceil(largura(titulo, tamanho + 1))})`)
    for (const l of linhas) {
      if (largura(l, tamanho - 2, mono) > util) throw new Error(`[${this.nome}] linha "${l}" nao cabe em ${w}px (precisa ${Math.ceil(largura(l, tamanho - 2, mono))})`)
    }
    const alturaNecessaria = 22 + 18 + linhas.length * 17 + 8
    if (alturaNecessaria > h) throw new Error(`[${this.nome}] caixa "${titulo}" precisa de ${alturaNecessaria}px de altura, tem ${h}`)
    const g = [`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="${this.#cor(fundo)}" stroke="${this.#cor(borda)}" stroke-width="1.4"/>`]
    g.push(`<text x="${x + 12}" y="${y + 24}" font-size="${tamanho + 1}" font-weight="700" fill="${this.t.texto}">${esc(titulo)}</text>`)
    linhas.forEach((l, i) => {
      g.push(
        `<text x="${x + 12}" y="${y + 44 + i * 17}" font-size="${tamanho - 2}" fill="${this.t.suave}"${mono ? ` font-family="${MONO}"` : ''}>${esc(l)}</text>`,
      )
    })
    this.partes.push(`<g>${g.join('')}</g>`)
    return { x, y, w, h, cx: x + w / 2, cy: y + h / 2, d: x + w, b: y + h }
  }

  /** Um rotulo solto (sem caixa). */
  texto(x, y, conteudo, { tam = 12, cor = 'suave', negrito = false, ancora = 'start', mono = false } = {}) {
    this.partes.push(
      `<text x="${x}" y="${y}" font-size="${tam}" text-anchor="${ancora}" fill="${this.#cor(cor)}"${negrito ? ' font-weight="700"' : ''}${mono ? ` font-family="${MONO}"` : ''}>${esc(conteudo)}</text>`,
    )
    return this
  }

  /** Um chip (etiqueta curta arredondada). */
  chip(x, y, conteudo, { tipo = 'neutro', mono = true } = {}) {
    const w = Math.ceil(largura(conteudo, 11, mono)) + 18
    const fundo = { neutro: 'caixa', destaque: 'destaqueFundo', verde: 'verdeFundo', ambar: 'ambarFundo', vermelho: 'vermelhoFundo', roxo: 'roxoFundo' }[tipo]
    const borda = { neutro: 'borda', destaque: 'destaque', verde: 'verde', ambar: 'ambar', vermelho: 'vermelho', roxo: 'roxo' }[tipo]
    this.partes.push(
      `<rect x="${x}" y="${y}" width="${w}" height="22" rx="11" fill="${this.#cor(fundo)}" stroke="${this.#cor(borda)}" stroke-width="1"/>` +
        `<text x="${x + 9}" y="${y + 15}" font-size="11" fill="${this.t.texto}"${mono ? ` font-family="${MONO}"` : ''}>${esc(conteudo)}</text>`,
    )
    return { x, y, w, h: 22, d: x + w }
  }

  /**
   * Seta ortogonal por uma lista de pontos. `rotulo` fica no meio do primeiro segmento mais longo.
   */
  seta(pontos, { rotulo, tracejado = false, cor = 'suave', dupla = false } = {}) {
    const c = this.#cor(cor)
    const id = `ponta-${cor.replace(/[^a-z0-9]/gi, '')}`
    if (!this.defs.includes(id)) {
      this.defs.push(id)
      this.partes.unshift(
        `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${c}"/></marker></defs>`,
      )
    }
    const d = pontos.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join(' ')
    this.partes.push(
      `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.6"${tracejado ? ' stroke-dasharray="6 4"' : ''} marker-end="url(#${id})"${dupla ? ` marker-start="url(#${id})"` : ''}/>`,
    )
    if (rotulo) {
      let melhor = [pontos[0], pontos[1]]
      let maior = 0
      for (let i = 0; i < pontos.length - 1; i++) {
        const dx = Math.abs(pontos[i + 1][0] - pontos[i][0])
        const dy = Math.abs(pontos[i + 1][1] - pontos[i][1])
        if (dx + dy > maior) {
          maior = dx + dy
          melhor = [pontos[i], pontos[i + 1]]
        }
      }
      const mx = (melhor[0][0] + melhor[1][0]) / 2
      const my = (melhor[0][1] + melhor[1][1]) / 2
      const lw = Math.ceil(largura(rotulo, 11)) + 10
      this.partes.push(
        `<rect x="${r2(mx - lw / 2)}" y="${r2(my - 9)}" width="${lw}" height="18" rx="4" fill="${this.t.fundo}" opacity="0.92"/>` +
          `<text x="${r2(mx)}" y="${r2(my + 4)}" font-size="11" text-anchor="middle" fill="${this.t.suave}">${esc(rotulo)}</text>`,
      )
    }
    return this
  }

  /** Numero de passo (circulo). */
  passo(x, y, n, tipo = 'destaque') {
    const cor = { destaque: 'destaque', verde: 'verde', ambar: 'ambar', vermelho: 'vermelho', roxo: 'roxo' }[tipo]
    this.partes.push(
      `<circle cx="${x}" cy="${y}" r="11" fill="${this.#cor(cor)}"/><text x="${x}" y="${y + 4}" font-size="12" font-weight="700" text-anchor="middle" fill="${this.t.fundo}">${n}</text>`,
    )
    return this
  }

  /** SVG cru, para marcas (logo) que nao sao caixa nem seta. Recebe a funcao que monta a string a partir do tema. */
  bruto(fn) {
    this.partes.push(fn(this.t))
    return this
  }

  svg() {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.w} ${this.h}" width="${this.w}" height="${this.h}" font-family="${FONTE}" role="img" aria-label="${esc(this.nome)}">\n` +
      `<rect width="${this.w}" height="${this.h}" fill="${this.t.fundo}"/>\n` +
      this.partes.join('\n') +
      `\n</svg>\n`
    )
  }
}
