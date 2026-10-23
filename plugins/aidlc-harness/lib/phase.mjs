/*
 * Fases do AI-DLC como dado verificável.
 *
 * A regra "a fase seguinte não começa com a anterior incompleta" só existe se alguma coisa a
 * executa. Aqui ela é executada pelo `aidlc-phase check`, que reprova enquanto houver campo por
 * preencher (marcador PREENCHER) ou aprovação em branco. A aprovação é de uma pessoa: o detector
 * recusa nome que seja de ferramenta de IA, para o agente não aprovar o próprio trabalho.
 *
 * O que ele NÃO prova: que o conteúdo está certo. Ele prova que existe, está preenchido e tem um
 * nome e uma data de quem validou. A qualidade é da equipe que aprova.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const FASES = {
  inception: { pasta: 'aidlc/inception', arquivos: ['requirements.md', 'user-stories.md', 'units-of-work.md'], depende: [] },
  construction: { pasta: 'aidlc/construction', arquivos: ['design.md', 'test-plan.md'], depende: ['inception'] },
}

const MARCADOR = /<!--\s*PREENCHER/
const IA = /\b(claude|copilot|kiro|chatgpt|gpt|gemini|codex|cursor|assistente|llm|agente)\b/i
const IA_SIGLA = /\b(IA|AI)\b/

/** As duas linhas de aprovação do arquivo. */
function aprovacao(txt) {
  const por = /^Aprovado por:[ \t]*(.*)$/m.exec(txt)
  const data = /^Data:[ \t]*(.*)$/m.exec(txt)
  return { por: por?.[1]?.trim() ?? null, data: data?.[1]?.trim() ?? null }
}

const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

/**
 * Confere um arquivo da fase.
 * @returns {string[]} problemas (vazio = ok)
 */
export function conferirArquivo(raiz, pasta, nome) {
  const rel = `${pasta}/${nome}`
  const p = join(raiz, rel)
  if (!existsSync(p)) return [`${rel}: nao existe`]
  const txt = readFileSync(p, 'utf8')
  const problemas = []
  const restantes = txt.split('\n').filter((l) => MARCADOR.test(l) && !/^\s*(Aprovado por|Data):/.test(l)).length
  if (restantes) problemas.push(`${rel}: ${restantes} campo(s) por preencher (marcador PREENCHER)`)
  const { por, data } = aprovacao(txt)
  if (por === null || por === '' || MARCADOR.test(por)) problemas.push(`${rel}: "Aprovado por:" em branco`)
  else if (IA.test(por) || IA_SIGLA.test(por)) problemas.push(`${rel}: "Aprovado por: ${por}" nao vale, a aprovacao e de uma pessoa`)
  if (data === null || data === '' || MARCADOR.test(data)) problemas.push(`${rel}: "Data:" em branco`)
  else if (!dataValida(data)) problemas.push(`${rel}: "Data: ${data}" nao e AAAA-MM-DD`)
  return problemas
}

/** Estado de uma fase: { fase, ok, problemas, bloqueadaPor } */
export function conferirFase(raiz, fase) {
  const def = FASES[fase]
  if (!def) throw new Error(`fase desconhecida: ${fase} (use ${Object.keys(FASES).join(' ou ')})`)
  const problemas = def.arquivos.flatMap((a) => conferirArquivo(raiz, def.pasta, a))
  const bloqueadaPor = def.depende.filter((d) => !conferirFase(raiz, d).ok)
  return { fase, ok: problemas.length === 0 && bloqueadaPor.length === 0, problemas, bloqueadaPor }
}

export const temAidlc = (raiz) => existsSync(join(raiz, 'aidlc'))
