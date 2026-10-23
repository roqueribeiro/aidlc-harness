/*
 * O README diz como comecar? A regra do check `readme-quickstart` do aidlc-doctor.
 *
 * Mede a secao, nao a formatacao do titulo. Tres falsos negativos ja custaram nota a repo
 * que TINHA a secao:
 *  - "## 🚀 Quick Start" (muito README escreve com emoji): por isso `[^\w\n]*` no meio;
 *  - "## Começando" reprovava enquanto "## Comecando" passava: por isso `Come[cç]`;
 *  - "## Como começar" reprovava, porque a alternativa exigia o
 *    titulo comecando por "Come". Ganhou `Como come[cç]ar`.
 *  - "## Como rodar" e um titulo comum para a secao com os comandos. Ganhou `Como rodar`.
 */
export const QUICKSTART =
  /^#{2,3}\s*[^\w\n]*\s*(Quickstart|Quick Start|Come[cç]|Como come[cç]ar|Como rodar|Getting started|Start|Setup|Install|Uso|Usage|Commands|Comandos)/im

export const temQuickstart = (readme) => QUICKSTART.test(readme ?? '')

/*
 * O README mostra o que o repo e? A regra do check `readme-capa` do aidlc-doctor, nos repos de
 * app. Sem medir, repo com capa e repo sem capa recebem a mesma nota. E um arquivo de imagem
 * de 6 bytes, que nao e imagem, faz o README mostrar um icone quebrado: existir o arquivo nao
 * prova nada.
 *
 * Por isso a regra abre o arquivo: imagem local (o que aparece no GitHub e no clone), que
 * existe e cujos bytes sao de imagem. Imagem por URL nao conta: a regra nao sai para a rede, e
 * a do projeto mora no repo.
 */
const IMAGEM_MD = /!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g
const IMAGEM_HTML = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi

/** Os caminhos locais das imagens do README, na ordem em que aparecem. */
export function imagensDoReadme(readme) {
  const texto = String(readme ?? '')
  const achadas = [...texto.matchAll(IMAGEM_MD), ...texto.matchAll(IMAGEM_HTML)]
    .sort((a, b) => a.index - b.index)
    .map((m) => m[1].split(/[?#]/)[0])
  return achadas.filter((c) => c && !/^(https?:|data:|\/\/)/i.test(c)).map((c) => c.replace(/^\.\//, ''))
}

/** Os bytes sao de uma imagem que abre? PNG, JPEG, GIF e WebP pela assinatura; SVG pelo texto. */
export function eImagem(bytes, nome = '') {
  if (!bytes || typeof bytes.length !== 'number') return false
  const b = bytes
  if (/\.svg$/i.test(nome)) {
    const texto = Buffer.from(b).toString('utf8')
    return b.length >= 200 && /<svg[\s>]/i.test(texto)
  }
  if (b.length < 1024) return false
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  const gif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46
  const webp = Buffer.from(b.subarray(0, 4)).toString('latin1') === 'RIFF' && Buffer.from(b.subarray(8, 12)).toString('latin1') === 'WEBP'
  return png || jpeg || gif || webp
}

/**
 * A capa do README: a primeira imagem local que abre. `lerBytes(caminho)` devolve os bytes ou null.
 * @returns {{ ok: true, imagem: string } | { ok: false, motivo: string }}
 */
export function capaDoReadme(readme, lerBytes) {
  const imagens = imagensDoReadme(readme)
  if (!imagens.length) return { ok: false, motivo: 'o README nao mostra imagem do repo' }
  const problemas = []
  for (const caminho of imagens) {
    const bytes = lerBytes(caminho)
    if (!bytes) problemas.push(`${caminho} nao existe`)
    else if (!eImagem(bytes, caminho)) problemas.push(`${caminho} nao e imagem (${bytes.length} bytes)`)
    else return { ok: true, imagem: caminho }
  }
  return { ok: false, motivo: problemas.join('; ') }
}
