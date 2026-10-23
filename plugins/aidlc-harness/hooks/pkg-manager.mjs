#!/usr/bin/env node
/*
 * PreToolUse(Bash): guarda de gerenciador de pacote, orientada por manifesto.
 *
 * Um guard cego que bloqueia npm e npx em todo lugar presume que todo repo e yarn-only, e nega
 * comando que a propria documentacao do repo manda executar (uma extensao de navegador, por
 * exemplo, e npm por definicao).
 *
 * Agora a fonte da verdade e o campo pkgManager do quality/<tech>.json do repo onde o
 * comando vai rodar. Sem tecnologia reconhecida, ele libera: falha pro lado de deixar
 * trabalhar, nunca pro lado de travar.
 *
 * "Onde o comando vai rodar" nao e o cwd da sessao. Uma sessao aberta num repo yarn rodando
 * `cd ../outro-repo && npm ci` seria julgada pelo manifesto do repo da sessao, citando um repo
 * que o comando nem toca. Por isso os segmentos sao percorridos
 * rastreando `cd`, e cada invocacao de gerenciador e conferida contra a tecnologia do
 * diretorio vigente naquele ponto.
 */

import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'
import { detectTech, repoRoot } from '../lib/detect.mjs'

const WRONG = {
  yarn: { rx: /^(npm|npx)(\s|$)/, use: 'yarn (yarn add, yarn dlx, yarn create)', banned: 'npm/npx' },
  npm: { rx: /^yarn(\s|$)/, use: 'npm (npm install, npx)', banned: 'yarn' },
}

/** Tira aspas e expande `~`, que e o que aparece num `cd` escrito a mao. */
function cleanPath(arg) {
  const unquoted = arg.trim().replace(/^(['"])(.*)\1$/, '$2')
  if (unquoted === '~') return homedir()
  if (unquoted.startsWith('~/')) return resolve(homedir(), unquoted.slice(2))
  return unquoted
}

/**
 * Percorre os segmentos do comando mantendo o diretorio vigente e devolve os pares
 * [segmento, diretorio] de cada invocacao de gerenciador de pacote.
 *
 * A divisao por `&&`, `||`, `;`, `|` e QUEBRA DE LINHA e grosseira de proposito: um parser
 * de shell de verdade nao cabe num hook que roda a cada turno. Quando o rastreio se perde
 * (um `cd` que nao da pra resolver, como `cd -` ou `cd` pelado), o diretorio vira null e as
 * invocacoes seguintes sao ignoradas: na duvida sobre ONDE o comando roda, este guard libera.
 *
 * A quebra de linha entrou depois, e a falta dela era um buraco de verdade: num script de
 * varias linhas, o `cd` de uma linha ficava grudado no fim do comando anterior, o segmento
 * nao COMECAVA com `cd`, e o rastreio simplesmente nao via a troca de diretorio. O guard
 * entao julgava o repo da sessao e negava um npm perfeitamente legitimo.
 */
/**
 * Remove o CORPO de cada heredoc, que e dado e nao comando.
 *
 * Sem isto, escrever um arquivo que contem a palavra `npm` era negado como se fosse uma
 * invocacao: um `cat > Dockerfile <<'EOF'` com `RUN npm install …` dentro
 * levou o guard a ver tres npm num repo yarn, quando o unico comando da linha era `cat`.
 * Um guard que impede ESCREVER a palavra nao guarda gerenciador de pacote, guarda texto —
 * e falso positivo e o que ensina alguem a desligar o guard.
 *
 * A linha de abertura fica (ela e comando de verdade, e pode ter um npm legitimo antes do
 * `<<`), e o terminador fica: some so o miolo.
 */
function stripHeredocs(cmd) {
  const out = []
  let fim = null

  for (const linha of String(cmd).split('\n')) {
    if (fim !== null) {
      // `<<-` permite terminador indentado com tab; comparamos sem espaco nas pontas.
      if (linha.trim() === fim) fim = null
      continue
    }
    out.push(linha)
    // Ultima abertura da linha manda: `cmd <<A <<B` termina em B por ultimo, e para o que
    // este guard precisa (nao ler o miolo) parar no primeiro terminador ja basta.
    const abre = [...linha.matchAll(/<<-?\s*(['"]?)([A-Za-z_][A-Za-z0-9_]*)\1/g)].pop()
    if (abre) fim = abre[2]
  }

  return out.join('\n')
}

/**
 * Divide por separador de shell SEM cortar dentro de aspas.
 *
 * Mesma raiz do heredoc, outra porta: `node -e "… && npm run dist …"` e UM comando, e o
 * `npm` ali dentro e argumento, nao invocacao. Cortando por `&&` sem olhar aspas, o guard
 * inventava um segmento comecando por `npm` e negava um `node` legitimo.
 *
 * O preco e conhecido e aceito: `sh -c "npm install"` deixa de ser visto. Este guard ja
 * escolheu falhar ABERTO quando nao tem certeza (ver o `dir = null` acima), e um falso
 * positivo custa mais caro que um falso negativo — ele ensina a desligar o guard.
 */
function splitSegments(cmd) {
  const partes = []
  let atual = ''
  let aspa = null

  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]

    if (aspa) {
      atual += c
      if (c === aspa && cmd[i - 1] !== '\\') aspa = null
      continue
    }
    if (c === '"' || c === "'") {
      aspa = c
      atual += c
      continue
    }
    if (c === '\n' || c === ';' || c === '&' || c === '|') {
      partes.push(atual)
      atual = ''
      continue
    }
    atual += c
  }
  partes.push(atual)

  return partes
}

function pkgCalls(cmd, startDir) {
  const calls = []
  let dir = startDir

  for (const rawSegment of splitSegments(stripHeredocs(cmd))) {
    const segment = rawSegment.trim()
    if (!segment) continue

    const cd = segment.match(/^cd\s*(.*)$/)
    if (cd) {
      const target = cleanPath(cd[1])
      if (!target || target === '-') dir = null
      else if (isAbsolute(target)) dir = target
      else if (dir !== null) dir = resolve(dir, target)
      continue
    }

    if (dir !== null && /^(npm|npx|yarn)(\s|$)/.test(segment)) calls.push([segment, dir])
  }

  return calls
}

let raw = ''
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw || '{}')
    const cmd = String(input.tool_input?.command ?? '')
    if (!cmd.trim()) return process.exit(0)

    const cwd = input.cwd || process.cwd()

    for (const [segment, dir] of pkgCalls(cmd, cwd)) {
      const manifest = detectTech(repoRoot(dir))
      const pm = manifest?.pkgManager
      if (!pm || !WRONG[pm]) continue

      const rule = WRONG[pm]
      if (!rule.rx.test(segment)) continue

      const fonte =
        manifest.pkgManagerFrom === 'package.json'
          ? 'o campo packageManager do package.json do repo, que vence o do manifesto da stack.'
          : `plugins/aidlc-harness/quality/${manifest.tech}.json, campo pkgManager.`
      process.stderr.write(
        `${manifest.label} usa ${rule.use}, nao ${rule.banned}.\n` +
          `Fonte: ${fonte}\n` +
          `Diretorio julgado: ${repoRoot(dir)}\n`,
      )
      return process.exit(2)
    }

    process.exit(0)
  } catch {
    // stdin nao-JSON, manifesto ilegivel, qualquer coisa: nao bloquear.
    process.exit(0)
  }
})
