/*
 * Os formatos de segredo que nunca podem sobreviver a um texto que sai da maquina.
 *
 * Vive em lib/ e nao dentro de um bin porque dois consumidores precisam da MESMA lista:
 * o `aidlc-secrets scrub`, que redige um texto a pedido, e qualquer ferramenta que
 * poste texto para fora da maquina. Duas copias divergem, e a copia que fica para tras e
 * justamente a que deixa passar o formato novo.
 *
 * O criterio para entrar aqui e o formato ser reconhecivel sozinho, sem contexto. Nao ha
 * como detectar "senha do banco" num texto qualquer, e fingir que ha seria pior que nao
 * tentar: daria a sensacao de que o texto foi limpo.
 */

export const SECRET_SHAPES = [
  [/gh[pousr]_[A-Za-z0-9]{16,}/g, 'github-token'],
  [/\bsk-[A-Za-z0-9_-]{20,}/g, 'api-key'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, 'google-api-key'],
  [/-----BEGIN[^-]{0,40}PRIVATE KEY-----[\s\S]*?-----END[^-]{0,40}PRIVATE KEY-----/g, 'private-key'],
  [/\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, 'jwt'],
  [/\b[MNO][A-Za-z0-9_-]{23}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}\b/g, 'discord-token'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, 'slack-token'],
  [/\b(?:ASIA|AKIA)[0-9A-Z]{16}\b/g, 'aws-key-id'],
  // Token de tunel do cloudflared: JSON em base64, entao sempre comeca em `eyJ`
  // e nao tem ponto (o que o separa do jwt acima). Ele sai inteiro num
  // `docker inspect`, que e exatamente o texto que se cola num chat pedindo
  // ajuda, e quem o tem controla o tunel.
  [/\beyJ[A-Za-z0-9_+/=-]{80,}/g, 'cloudflare-tunnel-token'],
]

/*
 * O que deliberadamente NAO entra aqui, e por que:
 *
 * O token de API da Cloudflare sao 40 caracteres de [A-Za-z0-9_-], e a chave
 * global sao 37 em hex. Nenhum dos dois e reconhecivel sozinho: os dois casam
 * com hash, id e pedaco de base64 que aparecem em qualquer log. Pelo criterio
 * do topo deste arquivo eles ficam de fora, porque um scrub que redige demais
 * ensina a ignorar o marcador, e um que finge cobrir o que nao cobre e pior que
 * nao existir. Para esses, a protecao e nunca deixarem o cofre.
 */

/**
 * Troca todo segredo reconhecido por um marcador.
 * @returns {{ text: string, hits: string[] }} texto redigido e os rotulos encontrados
 */
export function scrub(text) {
  let out = String(text)
  const hits = []
  for (const [rx, label] of SECRET_SHAPES) {
    // `lastIndex` de regex global e estado: sem o reset, uma segunda chamada
    // comeca no meio do texto anterior e deixa passar o que estava antes.
    rx.lastIndex = 0
    out = out.replace(rx, () => {
      hits.push(label)
      return `[REDIGIDO:${label}]`
    })
  }
  return { text: out, hits }
}
