/*
 * Leitura e escrita do arquivo de preenchimento em lote do cofre.
 *
 * O cadastro um a um e seguro e chato: oito prompts interativos, cada um exigindo achar o
 * valor num console diferente. O arquivo existe para juntar isso numa sentada so, e por
 * isso mesmo ele e transitorio: nasce vazio, e preenchido, e importado, e destruido. Nao
 * e formato de armazenamento, e formato de transporte.
 *
 * O parser e proprio porque a alternativa seria uma dependencia para ler KEY=VALUE, e o
 * kit inteiro nao tem nenhuma. Ele cobre o que aparece quando alguem cola de um gerenciador
 * de senhas: aspas, `export` na frente, CRLF do Windows, BOM, `=` dentro do valor.
 */

/**
 * @param {string} text
 * @returns {{ entries: Array<{key:string,value:string,line:number}>, problems: Array<{line:number,text:string,why:string}> }}
 */
export function parseEnvFile(text) {
  const entries = []
  const problems = []
  const seen = new Map()

  // BOM entra quando o arquivo e salvo por editor do Windows e grudaria na primeira chave.
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/)

  lines.forEach((raw, i) => {
    const line = i + 1
    const trimmed = raw.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const m = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!m) {
      problems.push({ line, text: trimmed.slice(0, 40), why: 'nao e KEY=VALOR' })
      return
    }

    const key = m[1]
    let value = m[2].trim()

    /*
     * So se as aspas ABREM e FECHAM a mesma coisa. Um valor com aspa no meio, ou com uma
     * aspa solta na ponta, fica como esta: tirar aspa de um lado so mutilaria o segredo,
     * e um segredo mutilado falha na autenticacao com uma mensagem que nao ajuda ninguem.
     */
    if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
      value = value.slice(1, -1)
    } else {
      // Sem aspas, um `#` depois de espaco e comentario de fim de linha.
      value = value.replace(/\s+#.*$/, '').trim()
    }

    if (seen.has(key)) {
      problems.push({ line, text: key, why: `repetido, a linha ${seen.get(key)} ja definia` })
      return
    }
    seen.set(key, line)
    entries.push({ key, value, line })
  })

  return { entries, problems }
}

/**
 * Monta o arquivo em branco, uma secao por segredo, com onde achar cada valor.
 * @param {Array<{env:string,name:string,use:string,where:string,note?:string}>} fields
 */
export function renderTemplate(fields) {
  const head = [
    '# Preenchimento em lote do cofre do aidlc-harness.',
    '#',
    '# Este arquivo e TRANSITORIO. Preencha, rode o import, e ele sera destruido:',
    '#',
    '#   aidlc-secrets import aidlc.env',
    '#',
    '# Deixe em branco o que voce ainda nao tem: o import pula linha vazia sem reclamar,',
    '# e voce roda de novo depois com o resto. Nada aqui vai para o git, e o import recusa',
    '# arquivo que esteja versionado.',
    '',
  ]

  const body = fields.flatMap((f) => [
    `# ${f.use}`,
    `# onde: ${f.where}`,
    ...(f.note ? [`# nota: ${f.note}`] : []),
    `${f.env}=`,
    '',
  ])

  return head.concat(body).join('\n')
}
