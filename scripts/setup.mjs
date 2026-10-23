#!/usr/bin/env node
/*
 * setup: põe os executáveis do kit (`aidlc-gate`, `aidlc-init`, ...) no PATH.
 *
 *   node scripts/setup.mjs                 # instala no diretório padrão
 *   node scripts/setup.mjs --dir ~/bin     # outro diretório
 *   node scripts/setup.mjs --check         # só confere, exit 1 se faltar ou estiver quebrado
 *   node scripts/setup.mjs --uninstall     # remove só o que este script criou
 *
 * Por que existe: o plugin instalado no Claude Code carrega hooks, skills e agentes sozinho, mas
 * os executáveis precisam estar no PATH para o agente (e você) chamá-los pelo nome. Kiro e Copilot
 * não carregam o plugin e dependem inteiramente deste passo.
 *
 * Diretório padrão: ~/.local/bin no macOS e no Linux; %USERPROFILE%\.aidlc\bin no Windows.
 *   - POSIX: symlink para o arquivo em tools/.
 *   - Windows: um `<nome>.cmd` que chama `node` com o caminho do arquivo. NÃO testado em Windows
 *     real por quem escreveu: se falhar, abra uma issue com a saída.
 *
 * Nunca sobrescreve o que não é nosso: um arquivo ou link alheio com o mesmo nome vira conflito.
 * Requer Node 20.19 ou mais novo (os executáveis são ESM sem extensão, e o Node precisa detectar o módulo).
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MARCADOR_CMD = 'REM aidlc-harness: gerado por scripts/setup.mjs'

export function dirPadrao(plat = platform(), home = homedir()) {
  return plat === 'win32' ? join(home, '.aidlc', 'bin') : join(home, '.local', 'bin')
}

/** O que instalar, sem tocar no disco. `tools` são nomes de arquivo; `toolsDir` é o caminho absoluto. */
export function planejar({ tools, toolsDir, dir, plat = platform() }) {
  return tools.map((nome) => {
    const alvo = join(toolsDir, nome)
    if (plat === 'win32') {
      return { nome, tipo: 'cmd', destino: join(dir, `${nome}.cmd`), alvo, conteudo: `@echo off\r\n${MARCADOR_CMD}\r\nnode "${alvo}" %*\r\n` }
    }
    return { nome, tipo: 'symlink', destino: join(dir, nome), alvo }
  })
}

/** Estado de um item: 'ok' | 'falta' | 'desatualizado' | 'conflito'. */
export function estado(item, leitura) {
  if (leitura.existe === false) return 'falta'
  if (item.tipo === 'symlink') {
    if (!leitura.ehLink) return 'conflito'
    return leitura.alvoDoLink === item.alvo ? 'ok' : leitura.alvoDoLink && leitura.alvoDoLink.includes('aidlc-harness') ? 'desatualizado' : 'conflito'
  }
  if (!String(leitura.conteudo ?? '').includes(MARCADOR_CMD)) return 'conflito'
  return leitura.conteudo === item.conteudo ? 'ok' : 'desatualizado'
}

function ler(item) {
  let st
  try {
    st = lstatSync(item.destino)
  } catch {
    return { existe: false }
  }
  if (item.tipo === 'symlink') return { existe: true, ehLink: st.isSymbolicLink(), alvoDoLink: st.isSymbolicLink() ? readlinkSync(item.destino) : null }
  return { existe: true, conteudo: readFileSync(item.destino, 'utf8') }
}

function aplicarItem(item, est) {
  if (est === 'ok' || est === 'conflito') return est
  mkdirSync(dirname(item.destino), { recursive: true })
  if (est === 'desatualizado') rmSync(item.destino, { force: true })
  if (item.tipo === 'symlink') symlinkSync(item.alvo, item.destino)
  else writeFileSync(item.destino, item.conteudo)
  return est === 'falta' ? 'instalado' : 'atualizado'
}

export function noPath(dir, envPath = process.env.PATH ?? '') {
  return envPath.split(delimiter).some((p) => p && resolve(p) === resolve(dir))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const so = args.includes('--check')
  const remover = args.includes('--uninstall')
  const i = args.indexOf('--dir')
  const dir = resolve(i >= 0 ? args[i + 1].replace(/^~(?=$|\/)/, homedir()) : dirPadrao())
  const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const toolsDir = join(raiz, 'plugins', 'aidlc-harness', 'tools')
  const tools = readdirSync(toolsDir).filter((n) => n.startsWith('aidlc-')).sort()
  const plano = planejar({ tools, toolsDir, dir })
  let falhou = false

  for (const item of plano) {
    const est = estado(item, ler(item))
    if (remover) {
      if (est === 'ok' || est === 'desatualizado') {
        rmSync(item.destino, { force: true })
        console.log(`removido     ${item.destino}`)
      }
      continue
    }
    const r = so ? est : aplicarItem(item, est)
    if (['falta', 'desatualizado', 'conflito'].includes(r)) falhou = true
    if (r !== 'ok') console.log(`${r.padEnd(12)} ${item.destino}`)
  }
  if (!remover) {
    const n = plano.length
    console.log(falhou ? `\nsetup: pendências acima (${n} executáveis em ${dir})` : `\nsetup: ${n} executáveis em ${dir}`)
    if (!noPath(dir)) console.log(`\natenção: ${dir} não está no PATH. Acrescente-o ao PATH do seu shell e abra um terminal novo.`)
  }
  process.exit(falhou ? 1 : 0)
}
