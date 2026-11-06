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

/** Itens de lista (`- `, `* `, `1. `) sob um título `## <nome>`, até o próximo título. */
export function itensDaSecao(txt, nome) {
  const m = new RegExp(`^##\\s+${nome}\\s*$([\\s\\S]*?)(?=^##\\s|(?![\\s\\S]))`, 'm').exec(txt)
  if (!m) return null
  return m[1].split('\n').filter((l) => /^\s*([-*]|\d+\.)\s+\S/.test(l) && !/^\s*([-*]|\d+\.)\s+nenhuma\.?\s*$/i.test(l))
}

export const MAX_PERGUNTAS_ABERTAS = 5

/*
 * Regras do Inception que recomenda primeiro (v0.2), só em requirements.md:
 * - no máximo 5 perguntas em aberto: o resto a IA decide e registra como premissa;
 * - a seção Premissas existe, e com premissas listadas alguém (pessoa) assina que as revisou.
 * Sem isto, "pergunte só o que trava" e "premissa visível" seriam texto de prompt, sem mecanismo.
 */
function regrasDosRequisitos(rel, txt) {
  const problemas = []
  const abertas = itensDaSecao(txt, 'Perguntas em aberto')
  if (abertas && abertas.length > MAX_PERGUNTAS_ABERTAS)
    problemas.push(`${rel}: ${abertas.length} perguntas em aberto; o maximo e ${MAX_PERGUNTAS_ABERTAS} (o resto vira premissa, com o motivo)`)
  const premissas = itensDaSecao(txt, 'Premissas')
  if (premissas === null) problemas.push(`${rel}: falta a secao "## Premissas" (o que a IA decidiu sem a equipe; "nenhuma" se nao houver)`)
  else if (premissas.length) {
    const rev = /^Premissas revisadas por:[ \t]*(.*)$/m.exec(txt)?.[1]?.trim() ?? null
    if (rev === null || rev === '' || MARCADOR.test(rev)) problemas.push(`${rel}: ${premissas.length} premissa(s) e "Premissas revisadas por:" em branco`)
    else if (IA.test(rev) || IA_SIGLA.test(rev)) problemas.push(`${rel}: "Premissas revisadas por: ${rev}" nao vale, a revisao e de uma pessoa`)
  }
  return problemas
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
  const restantes = txt.split('\n').filter((l) => MARCADOR.test(l) && !/^\s*(Aprovado por|Data|Premissas revisadas por):/.test(l)).length
  if (restantes) problemas.push(`${rel}: ${restantes} campo(s) por preencher (marcador PREENCHER)`)
  const { por, data } = aprovacao(txt)
  if (por === null || por === '' || MARCADOR.test(por)) problemas.push(`${rel}: "Aprovado por:" em branco`)
  else if (IA.test(por) || IA_SIGLA.test(por)) problemas.push(`${rel}: "Aprovado por: ${por}" nao vale, a aprovacao e de uma pessoa`)
  if (data === null || data === '' || MARCADOR.test(data)) problemas.push(`${rel}: "Data:" em branco`)
  else if (!dataValida(data)) problemas.push(`${rel}: "Data: ${data}" nao e AAAA-MM-DD`)
  if (rel === 'aidlc/inception/requirements.md') problemas.push(...regrasDosRequisitos(rel, txt))
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
