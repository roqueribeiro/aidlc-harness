/*
 * O que sobra depois do trabalho.
 *
 * Regra: nao deixar lixo na maquina nem nos servidores. Worktrees velhos, containers parados e
 * cache de build crescem em silencio, e cada um nasce de uma entrega que terminou sem arrumar a
 * bancada. O inventario separa o que se apaga sozinho do que exige decisao de uma pessoa.
 *
 * Duas classes, e so a primeira se apaga sozinha:
 *   lixo:    copia local de algo que o remoto ja guarda (worktree limpo cuja ponta esta numa
 *            branch remota, branch local cuja ponta esta numa branch remota, worktree que o git
 *            ja marca como prunable) e, nos servidores, container parado, imagem sem uso e
 *            cache de build.
 *   decidir: o que perderia trabalho se sumisse (worktree sujo, commit que nenhum remoto tem).
 *            Vai para o relato, nunca para o rm.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const git = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const tenta = (fn, fallback) => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function parseWorktrees(porcelain) {
  const out = []
  let cur = null
  for (const linha of porcelain.split('\n')) {
    if (linha.startsWith('worktree ')) {
      cur = { path: linha.slice(9), head: null, branch: null, detached: false, prunable: false }
      out.push(cur)
    } else if (!cur) continue
    else if (linha.startsWith('HEAD ')) cur.head = linha.slice(5)
    else if (linha.startsWith('branch ')) cur.branch = linha.slice(7).replace('refs/heads/', '')
    else if (linha === 'detached') cur.detached = true
    else if (linha.startsWith('prunable')) cur.prunable = true
  }
  return out
}

/** A ponta esta guardada em alguma branch remota? */
export function noRemoto(root, sha) {
  return Boolean(tenta(() => git(root, ['branch', '-r', '--contains', sha]).trim(), ''))
}

export function principalRemota(root) {
  const sym = tenta(() => git(root, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD']).trim(), '')
  if (sym) return sym
  for (const b of ['origin/main', 'origin/master']) if (tenta(() => git(root, ['rev-parse', '-q', '--verify', b]).trim(), '')) return b
  return null
}

const ancestral = (root, a, b) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function inventarioRepo(root) {
  const lixo = []
  const decidir = []
  if (!existsSync(root)) return { lixo, decidir }
  tenta(() => git(root, ['fetch', '-q', '--prune', 'origin']), null)
  const wts = parseWorktrees(tenta(() => git(root, ['worktree', 'list', '--porcelain']), ''))
  const principal = wts[0]?.path
  const emUso = new Set()
  // O que fica de proposito: a copia servida do kit (branch kit-servido, 2.24.0) e o que o repo
  // declarar com `git config --add aidlc.manter <branch>`.
  const manter = new Set(['kit-servido', ...tenta(() => git(root, ['config', '--get-all', 'aidlc.manter']), '').split('\n').filter(Boolean)])
  for (const w of wts.slice(1)) {
    if (w.branch) emUso.add(w.branch)
    if (w.branch && manter.has(w.branch)) continue
    if (w.prunable) {
      lixo.push({ tipo: 'worktree-orfao', alvo: w.path, repo: root, motivo: 'o git ja marca como prunable' })
      continue
    }
    const sujo = tenta(() => git(w.path, ['status', '--porcelain']).trim(), 'x')
    if (sujo) decidir.push({ tipo: 'worktree-sujo', alvo: w.path, repo: root, motivo: 'tem mudanca nao commitada' })
    else if (w.head && noRemoto(root, w.head)) lixo.push({ tipo: 'worktree', alvo: w.path, repo: root, branch: w.branch, motivo: 'limpo, e a ponta esta no remoto' })
    else decidir.push({ tipo: 'worktree-sem-remoto', alvo: w.path, repo: root, motivo: 'tem commit que nenhum remoto guarda' })
  }
  const atual = tenta(() => git(principal ?? root, ['branch', '--show-current']).trim(), '')
  // O trabalho so termina na principal do remoto: HEAD fora dela, ou arvore suja, e decisao pendente.
  const def = principalRemota(root)
  const head = tenta(() => git(root, ['rev-parse', 'HEAD']).trim(), '')
  if (tenta(() => git(root, ['status', '--porcelain']).trim(), '')) decidir.push({ tipo: 'arvore-suja', alvo: root, repo: root, motivo: 'mudanca nao commitada no clone principal' })
  if (def && head && !ancestral(root, head, def)) decidir.push({ tipo: 'head-fora-da-principal', alvo: atual || head.slice(0, 7), repo: root, motivo: `o HEAD nao esta em ${def}: mergeie na principal e empurre` })
  const branches = tenta(() => git(root, ['for-each-ref', '--format=%(refname:short) %(objectname)', 'refs/heads']), '')
  for (const linha of branches.split('\n').filter(Boolean)) {
    const [nome, sha] = linha.split(' ')
    if (nome === atual || manter.has(nome)) continue
    if (noRemoto(root, sha)) lixo.push({ tipo: 'branch', alvo: nome, repo: root, emWorktree: emUso.has(nome), motivo: 'a ponta esta no remoto' })
    else decidir.push({ tipo: 'branch-sem-remoto', alvo: nome, repo: root, motivo: 'commit que nenhum remoto guarda' })
  }
  return { lixo, decidir }
}

export function apagarRepo(itens) {
  const feitos = []
  for (const i of itens.filter((x) => x.tipo === 'worktree' || x.tipo === 'worktree-orfao')) {
    tenta(() => {
      if (i.tipo === 'worktree') git(i.repo, ['worktree', 'remove', i.alvo])
      feitos.push(i)
    }, null)
  }
  for (const r of new Set(itens.map((i) => i.repo))) tenta(() => git(r, ['worktree', 'prune']), null)
  for (const i of itens.filter((x) => x.tipo === 'branch')) {
    tenta(() => {
      git(i.repo, ['branch', '-D', i.alvo])
      feitos.push(i)
    }, null)
  }
  return feitos
}

/*
 * Servidores. O comando remoto imprime quatro blocos separados por linha "---":
 *   1. containers parados;
 *   2. imagens orfas: sem tag E sem container usando (o tunel do cloudflared roda de imagem sem tag);
 *   3. imagens antigas: com tag, sem container usando, e que nao sao a mais nova do seu repositorio.
 *      Um servidor de longa vida acumula dezenas de releases velhas do mesmo repositorio
 *      (dezenas de GB). A mais nova sem uso de cada repositorio fica: e o rollback, ou o app parado do usuario.
 *      Tag `rollback`, `previous` ou `anterior` nunca entra: um instalador que guarda a versao
 *      anterior de um servico com essa tag nao pode ter o rollback contado como release velha. E ficam as MANTER_RELEASES
 *      mais novas de cada repositorio, nao so a mais nova: uma politica de retencao tipica guarda
 *      a ativa e duas de rollback, e apagar as duas faz o deploy seguinte parar por imagem ausente;
 *   4. o `docker system df`.
 */
/** Quantas releases de cada repositorio ficam (a ativa e duas de rollback). */
export const MANTER_RELEASES = 3

export const SONDA_DOCKER =
  "docker ps -a --filter status=exited --filter status=created --filter status=dead --format '{{.Names}}'; echo ---; " +
  "docker ps -aq | xargs -r docker inspect --format '{{.Image}}' | sort -u > /tmp/.aidlc-em-uso; " +
  "docker images -f dangling=true -q --no-trunc | sort -u | grep -vxFf /tmp/.aidlc-em-uso | wc -l; echo ---; " +
  "docker images --no-trunc --format '{{.Repository}} {{.Tag}} {{.ID}}' | awk '$1!=\"<none>\" && $2 !~ /^(rollback|previous|anterior)$/ { if (visto[$1]++ >= " + MANTER_RELEASES + ") print $3 }' | sort -u | grep -vxFf /tmp/.aidlc-em-uso; " +
  "rm -f /tmp/.aidlc-em-uso; echo ---; " +
  "docker system df --format '{{.Type}}|{{.Reclaimable}}'"

/*
 * Container parado so e lixo quando o nome diz que e de uma unidade (`u12-carga-...`, `bolt3-...`): numa
 * caixa de usuario, container parado tambem e app que o usuario parou, e apagar aquilo apaga o estado
 * dele. Imagem, so a orfa (sem tag); imagem sem uso pode ser o app parado do usuario ou o rollback.
 */
export const DE_UNIDADE = /^(?:u|unidade|bolt)\d+[-_]/i

const SHA = /^sha256:[0-9a-f]{64}$/

export function limpaDocker(parados, antigas = []) {
  const meus = parados.filter((n) => DE_UNIDADE.test(n))
  const rm = meus.length ? `docker rm ${meus.map((n) => `'${n.replace(/'/g, '')}'`).join(' ')} >/dev/null; ` : ''
  const ids = antigas.filter((i) => SHA.test(i))
  const rmi = ids.length ? `docker rmi ${ids.join(' ')} >/dev/null 2>&1; ` : ''
  return `${rm}${rmi}docker image prune -f >/dev/null; docker builder prune -af --filter until=24h >/dev/null; echo limpo`
}

export function parseSonda(texto) {
  const blocos = texto.split(/^---$/m)
  // Sonda antiga (tres blocos) ainda se le: sem o bloco de imagens antigas.
  const [parados = '', orfas = '0', antigas = '', df = ''] = blocos.length >= 4 ? blocos : [blocos[0], blocos[1], '', blocos[2]]
  const recuperavel = {}
  for (const l of df.split('\n').filter(Boolean)) {
    const [tipo, valor] = l.split('|')
    recuperavel[tipo.trim()] = (valor ?? '').trim()
  }
  return {
    parados: parados.split('\n').map((s) => s.trim()).filter(Boolean),
    orfas: Number(orfas.trim()) || 0,
    antigas: antigas.split('\n').map((x) => x.trim()).filter((x) => SHA.test(x)),
    recuperavel,
  }
}

/**
 * Tem lixo no servidor? Container parado de unidade ou imagem orfa que ninguem usa. O cache de build sai
 * no relato e e podado a cada --apagar (o de mais de 24 h): logo depois de um deploy ele e grande e
 * legitimo, e contar ele como lixo deixaria o fechamento de unidade impossivel. Container parado que nao
 * e de goal tambem so sai no relato: pode ser app do usuario.
 */
export function lixoNoServidor(s) {
  return s.parados.some((n) => DE_UNIDADE.test(n)) || s.orfas > 0 || (s.antigas ?? []).length > 0
}
