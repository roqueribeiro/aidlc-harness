/*
 * O trivy que o aidlc-secscan usa, sem pedir instalação à pessoa.
 *
 * Por que existe: o gate de toda stack tem o `aidlc-secscan`, e ele precisava do trivy no PATH. Numa
 * máquina nova o primeiro `aidlc-gate` saía vermelho por um motivo que não era do projeto. Agora a
 * ordem é: AIDLC_TRIVY (caminho do executável), o `trivy` do PATH, o cache do kit e, por último, o
 * download da versão fixada abaixo, conferido pelo sha256 escrito aqui. Hash que não bate apaga o
 * arquivo e para: executável que não se conferiu não roda.
 *
 * Os hashes vêm de trivy_<versao>_checksums.txt da release oficial e foram conferidos contra o
 * arquivo baixado, nos cinco sistemas, em 2026-11-06. Para subir a versão: troque VERSAO e os cinco hashes.
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'

export const VERSAO = '0.76.1'
export const BASE = 'https://github.com/aquasecurity/trivy/releases/download'

export const ATIVOS = {
  'linux-x64': { arquivo: `trivy_${VERSAO}_Linux-64bit.tar.gz`, sha256: 'c7cbe3137fb8a48a17574bede3dd6beb16742d1e9772929940fc90082c39d9c0' },
  'linux-arm64': { arquivo: `trivy_${VERSAO}_Linux-ARM64.tar.gz`, sha256: 'e174dff2a6dba5e3ae41f8d0537a6324405bd08132497340304c6b20e0f16a1f' },
  'darwin-x64': { arquivo: `trivy_${VERSAO}_macOS-64bit.tar.gz`, sha256: '7aa762eacd582052d053b62dcf972a1ab058abe39a57ccae234ed8894945b6b7' },
  'darwin-arm64': { arquivo: `trivy_${VERSAO}_macOS-ARM64.tar.gz`, sha256: '11a9b6cd2752011b54f01ea4bd0dbfa9f0c41dc6538d5a3f9d23955f471bf4e5' },
  'win32-x64': { arquivo: `trivy_${VERSAO}_windows-64bit.zip`, sha256: '1051f49cb22d5284f43425f72aad9cda63ca12ceb92e7caa06903490c82dc9bf' },
}

const exe = (plataforma) => (plataforma === 'win32' ? 'trivy.exe' : 'trivy')

/** Pasta de cache do kit: XDG_CACHE_HOME, LOCALAPPDATA no Windows, ou ~/.cache. */
export function pastaDeCache(env = process.env, plataforma = process.platform) {
  const base = env.XDG_CACHE_HOME || (plataforma === 'win32' ? env.LOCALAPPDATA : '') || join(env.HOME || env.USERPROFILE || homedir(), '.cache')
  return join(base, 'aidlc-harness')
}

/** O `trivy` do PATH, se houver. */
export function noPath(env = process.env, plataforma = process.platform) {
  const chave = Object.keys(env).find((k) => k.toUpperCase() === 'PATH')
  for (const dir of (chave ? env[chave] : '').split(delimiter).filter(Boolean)) {
    const p = join(dir, exe(plataforma))
    if (existsSync(p)) return p
  }
  return null
}

export const sha256 = (arquivo) => createHash('sha256').update(readFileSync(arquivo)).digest('hex')

/** Baixa com curl (respeita HTTPS_PROXY, existe no Linux, no macOS e no Windows 10+); sem curl, fetch. */
async function baixar(url, destino) {
  try {
    execFileSync('curl', ['-fsSL', '--retry', '2', '-o', destino, url], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 600_000 })
    return
  } catch (e) {
    if (e.code !== 'ENOENT') throw new Error(`curl nao baixou ${url}: ${String(e.stderr || e.message).trim().slice(0, 300)}`)
  }
  const r = await fetch(url)
  if (!r.ok) throw new Error(`download de ${url} respondeu ${r.status}`)
  writeFileSync(destino, Buffer.from(await r.arrayBuffer()))
}

/**
 * Caminho de um trivy que roda. Baixa e confere se precisar.
 * @param {{ env?: object, plataforma?: string, arq?: string, ativos?: object, base?: string, log?: (m: string) => void }} o
 */
export async function resolverTrivy({ env = process.env, plataforma = process.platform, arq = process.arch, ativos = ATIVOS, base = env.AIDLC_TRIVY_BASE || BASE, versao = VERSAO, log = () => {} } = {}) {
  if (env.AIDLC_TRIVY) {
    if (!existsSync(env.AIDLC_TRIVY)) throw new Error(`AIDLC_TRIVY aponta para ${env.AIDLC_TRIVY}, que nao existe`)
    return env.AIDLC_TRIVY
  }
  const doPath = noPath(env, plataforma)
  if (doPath) return doPath

  const ativo = ativos[`${plataforma}-${arq}`]
  if (!ativo) throw new Error(`nao ha trivy oficial para ${plataforma}-${arq}; instale o trivy e ponha no PATH, ou aponte AIDLC_TRIVY`)
  const dir = join(pastaDeCache(env, plataforma), 'trivy', versao)
  const alvo = join(dir, exe(plataforma))
  if (existsSync(alvo)) return alvo

  mkdirSync(dir, { recursive: true })
  const pacote = join(dir, ativo.arquivo)
  const url = `${base}/v${versao}/${ativo.arquivo}`
  log(`aidlc-secscan: baixando trivy ${versao} (uma vez por maquina) de ${url}`)
  try {
    await baixar(url, pacote)
    const visto = sha256(pacote)
    if (visto !== ativo.sha256) throw new Error(`sha256 do trivy baixado nao confere (esperado ${ativo.sha256}, veio ${visto}); o arquivo foi apagado e nada rodou`)
    // tar extrai .tar.gz e, no Windows 10+, também .zip. Extrai numa pasta à parte e só então move: meio-arquivo não vira cache.
    const tmp = join(dir, 'extraindo')
    rmSync(tmp, { recursive: true, force: true })
    mkdirSync(tmp)
    // No Windows, o tar.exe do sistema (bsdtar) abre zip; o tar do Git, que pode vir antes no PATH, não.
    const tar = plataforma === 'win32' && env.SystemRoot ? join(env.SystemRoot, 'System32', 'tar.exe') : 'tar'
    execFileSync(tar, [ativo.arquivo.endsWith('.zip') ? '-xf' : '-xzf', pacote, '-C', tmp, exe(plataforma)], { stdio: ['ignore', 'ignore', 'pipe'] })
    if (plataforma !== 'win32') chmodSync(join(tmp, exe(plataforma)), 0o755)
    renameSync(join(tmp, exe(plataforma)), alvo)
    rmSync(tmp, { recursive: true, force: true })
  } finally {
    rmSync(pacote, { force: true })
  }
  return alvo
}
