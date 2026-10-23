#!/usr/bin/env node
/*
 * PreToolUse(Write|Edit|MultiEdit|Bash|device_bash): o arquivo nasce onde alguem acha depois.
 *
 * Agente solto cria script de diagnostico, patch ja aplicado e extracao avulsa na raiz do home de
 * quem o usa, sem repositorio, sem dono e sem como ser encontrado de novo. Isso nao e detalhe de
 * arrumacao: e trabalho que ninguem consegue reaproveitar e que ninguem sabe se pode apagar.
 *
 * OPT-IN. O hook so age quando o projeto declara a pasta de rascunho:
 *   - `"scratchDir": "~/workspaces/scratch"` em `.aidlc/config.json`, ou
 *   - a variavel de ambiente AIDLC_SCRATCH_DIR.
 * Sem nenhuma das duas, sai calado com exit 0.
 *
 * A regra e uma so: fora de um repositorio, arquivo vai para <scratchDir>/<tema>/. A pasta por
 * tema e o que substitui o repo que nao existe, e da ao arquivo o unico contexto que ele teria:
 * ao lado dos irmaos, com um nome que diz de que assunto ele e.
 *
 * Nega (exit 2) e diz o caminho certo. Analisa o CAMINHO, nunca o disco: o hook pode rodar num
 * container, e o home da pessoa esta do outro lado da ponte. Limitacao conhecida: reconhece o
 * home do macOS (/Users/<nome>) e o mount do Cowork; em outro sistema o hook nao age.
 *
 * Falsos positivos custam mais que o problema, entao: so caminho em posicao de ESCRITA, dotfile
 * sempre passa, pasta conhecida do macOS sempre passa, e qualquer duvida sai calado com exit 0.
 * Kill switch: AIDLC_SCRATCH_GUARD=0.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** A pasta de rascunho declarada pelo projeto, no formato `~/algo/bom`, ou null. */
export function pastaDeRascunho(cwd, env = process.env) {
  let valor = env.AIDLC_SCRATCH_DIR
  if (!valor) {
    try {
      valor = JSON.parse(readFileSync(join(cwd, '.aidlc', 'config.json'), 'utf8')).scratchDir
    } catch {
      valor = null
    }
  }
  if (typeof valor !== 'string' || !valor.trim()) return null
  const v = valor.trim().replace(/\/+$/, '')
  return /^~\/[^/]/.test(v) ? v : null
}

let SCRATCH = null // ex.: ~/workspaces/scratch

/* Pastas do home que ja tem dono. Escrever nelas e decisao de quem mora ali, nao sujeira. */
const PERMITIDAS = new Set([
  'Desktop',
  'Documents',
  'Downloads',
  'Pictures',
  'Movies',
  'Music',
  'Public',
  'Library',
  'Applications',
  'Sites',
  'mnt',
  'tmp',
])

/*
 * Caminho relativo ao home da pessoa, ou null se o caminho nao aponta para la.
 *
 * Dois enderecos para o mesmo lugar. Na maquina: ~/x, $HOME/x, /Users/<voce>/x. Pela ponte do
 * Cowork o home da pessoa chega montado em .../mnt/<pasta>/x, e ai `$HOME` ja e outra maquina --
 * por isso o teste do mount vem PRIMEIRO. `/mnt/user-data/` e a area de entrega do proprio
 * Cowork, nao o home de ninguem.
 */
function relativoAoHome(caminho) {
  const p = String(caminho).trim().replace(/\\/g, '/').replace(/^["']|["']$/g, '')
  if (!p) return null

  const mount = p.match(/(?:^|\/)mnt\/([^/]+)(?:\/(.*))?$/)
  if (mount) {
    if (mount[1] === 'user-data') return null
    return mount[2] ?? ''
  }

  /*
   * `~` e `$HOME` so apontam para a pessoa quando o hook roda NA maquina dela. Dentro de
   * um container o mesmo `~` e outro diretorio, que e area de trabalho legitima e some
   * com a sessao: bloquear ali seria barrar o unico rascunho que nao suja a casa de ninguem.
   * De la, o home da pessoa chega apenas pelo mount, tratado acima.
   */
  const meuHome = String(process.env.HOME ?? '')
  if (!/^\/Users\//.test(meuHome)) return null

  const home = p.match(/^(?:~|\$HOME|\$\{HOME\}|\/Users\/[^/]+)(?:\/(.*))?$/)
  if (home) return home[1] ?? ''

  return null
}

/** A violacao, com o destino pronto, ou null se o caminho esta em paz. */
function violacao(caminho, ehPasta = false) {
  const rel = relativoAoHome(caminho)
  if (rel === null || rel === '') return null

  const segs = rel.split('/').filter(Boolean)
  if (!segs.length) return null

  const raiz = segs[0]
  if (raiz.startsWith('.')) return null
  if (PERMITIDAS.has(raiz)) return null
  if (raiz === SCRATCH.split('/')[1]) return null

  const arquivo = segs[segs.length - 1]
  /* Um segmento so: arquivo jogado na raiz do home, sem nem o disfarce de uma pasta. */
  const solto = segs.length === 1 && !ehPasta

  if (ehPasta && segs.length === 1) {
    return {
      o_que: `~/${raiz}/ criaria mais uma pasta de tema na raiz do seu home`,
      destino: `${SCRATCH}/${raiz}/`,
    }
  }
  const tema = solto ? temaDe(arquivo) : raiz
  const resto = solto ? arquivo : segs.slice(1).join('/')

  return {
    o_que: solto ? `~/${arquivo} cria arquivo solto na raiz do seu home` : `~/${raiz}/ e pasta de tema criada direto no home`,
    destino: `${SCRATCH}/${tema}/${resto}`,
  }
}

/*
 * Tema deduzido do nome do arquivo: o prefixo antes do primeiro separador. `diag-play.mjs`
 * vira `diag`, `backup-casa.sh` vira `backup`. Chute grosseiro de proposito -- ele existe so
 * para a mensagem ter um exemplo concreto em vez de um <tema> literal. Quem escreve escolhe.
 */
function temaDe(arquivo) {
  const base = arquivo.replace(/\.[^.]+$/, '')
  const corte = base.split(/[-_.]/)[0]
  return (corte || base || 'avulso').toLowerCase()
}

/*
 * Caminhos em posicao de escrita dentro de uma linha de comando.
 *
 * `cat ~/projeto/x.py` LE e passa. Bloquear leitura seria repetir o erro que ja custou um
 * turno no secret-guard: guarda que nega o comando que apenas cita o arquivo nao protege
 * nada, e ensina a pessoa a desligar a guarda inteira.
 */
function alvosDeEscrita(cmd) {
  const alvos = []
  const tok = '("[^"]+"|\'[^\']+\'|[^\\s;|&<>]+)'

  for (const m of cmd.matchAll(new RegExp(`>>?\\s*${tok}`, 'g'))) alvos.push({ caminho: m[1] })
  for (const m of cmd.matchAll(new RegExp(`\\b(touch|mkdir|tee)\\s+(?:-\\S+\\s+)*${tok}`, 'g')))
    alvos.push({ caminho: m[2], ehPasta: m[1] === 'mkdir' })

  /* cp, mv, rsync, install: o destino e o ultimo argumento, e so ele. */
  for (const m of cmd.matchAll(/\b(?:cp|mv|rsync|install)\s+((?:-\S+\s+)*)([^;|&]+)/g)) {
    const args = m[2].trim().split(/\s+/).filter(Boolean)
    if (args.length >= 2) alvos.push({ caminho: args[args.length - 1] })
  }

  return alvos
}

let raw = ''
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  try {
    if (process.env.AIDLC_SCRATCH_GUARD === '0') process.exit(0)

    const input = JSON.parse(raw || '{}')
    const ti = input.tool_input ?? {}
    SCRATCH = pastaDeRascunho(input.cwd ?? process.cwd())
    if (!SCRATCH) process.exit(0)

    const candidatos = []
    const arquivo = ti.file_path ?? ti.filePath
    if (arquivo) candidatos.push({ caminho: arquivo })
    const cmd = String(ti.command ?? '')
    if (cmd.trim()) candidatos.push(...alvosDeEscrita(cmd))

    for (const c of candidatos) {
      const v = violacao(c.caminho, c.ehPasta === true)
      if (!v) continue
      process.stderr.write(
        `Bloqueado: ${v.o_que}.\n` +
          `Sem repositorio, o lugar e ${SCRATCH}/<tema>/, uma pasta por assunto.\n` +
          `Use: ${v.destino}\n` +
          `Se isto pertence a um repo do projeto, escreva dentro do repo. Se e descartavel de\n` +
          `verdade, use o scratch da sessao, que morre com ela, e nao o home de quem trabalha aqui.\n`,
      )
      process.exit(2)
    }

    process.exit(0)
  } catch {
    process.exit(0)
  }
})
