/*
 * O contrato de varredura: qualquer plataforma de seguranca entra no gate por aqui.
 *
 * A regra que organiza tudo: UM SCAN QUE NAO RODOU NAO E UM SCAN LIMPO. Um relatorio vazio pode
 * significar "nada achado" ou "o scanner caiu", e as duas coisas sao indistinguiveis se o gate
 * so conta achados. Por isso este modulo separa tres resultados, com tres codigos de saida:
 *
 *   0  limpo        a cobertura esta completa e nenhum achado chega ao limite
 *   1  reprovado    ha achado no limite ou acima (ou, com --baseline, achado novo no limite)
 *   2  nao rodou    cobertura incompleta, relatorio ilegivel ou scanner exigido ausente
 *
 * O relatorio de cada plataforma e normalizado para uma forma unica:
 *
 *   { formato, coberturaCompleta: true | false | null, scanners: [string], achados: [...] }
 *
 * `coberturaCompleta: null` quer dizer "o relatorio nao diz". O gate trata isso como NAO RODOU,
 * nunca como limpo, porque presumir cobertura e exatamente o erro que isto existe para impedir.
 *
 * Formatos lidos: `neutro` (o contrato do kit), `sarif` (SARIF 2.1.0, o padrao que muitas
 * plataformas exportam) e `roqueshield` (o AI Fix Bundle do RoqueShield, tolerante as duas formas
 * que a documentacao da plataforma descreve).
 */

export const SEVERIDADES = ['info', 'low', 'medium', 'high', 'critical']
const PESO = Object.fromEntries(SEVERIDADES.map((s, i) => [s, i]))

export class ErroDeRelatorio extends Error {}

/** Normaliza o texto de severidade de qualquer plataforma para uma das cinco do kit. */
export function normalizaSeveridade(valor) {
  const s = String(valor ?? '').trim().toLowerCase()
  if (s in PESO) return s
  const mapa = {
    crit: 'critical',
    severe: 'critical',
    important: 'high',
    error: 'high',
    moderate: 'medium',
    warning: 'medium',
    minor: 'low',
    note: 'low',
    none: 'info',
    informational: 'info',
    unknown: 'info',
  }
  return mapa[s] ?? null
}

/** CVSS (a propriedade `security-severity` do SARIF) para a escala do kit. */
export function severidadePorNota(nota) {
  const n = Number(nota)
  if (!Number.isFinite(n)) return null
  if (n >= 9) return 'critical'
  if (n >= 7) return 'high'
  if (n >= 4) return 'medium'
  if (n > 0) return 'low'
  return 'info'
}

function exigeObjeto(x, onde) {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new ErroDeRelatorio(`${onde}: esperava um objeto JSON`)
  return x
}

/** Descobre o formato pelo conteudo, para quem nao passa --format. */
export function detectaFormato(doc) {
  if (doc && typeof doc === 'object') {
    if (typeof doc.version === 'string' && Array.isArray(doc.runs)) return 'sarif'
    if (Array.isArray(doc.vulnerabilities) || (doc.scan && doc.schema_version)) return 'roqueshield'
    if ('coverage_complete' in doc || Array.isArray(doc.findings)) return 'neutro'
  }
  return null
}

function achadoNeutro(a, i) {
  const severidade = normalizaSeveridade(a?.severity)
  if (!severidade) throw new ErroDeRelatorio(`achado ${i}: severidade "${a?.severity}" desconhecida`)
  return {
    chave: String(a.key ?? a.id ?? `${a.title ?? 'achado'}@${a.location ?? i}`),
    severidade,
    titulo: String(a.title ?? a.key ?? a.id ?? '(sem titulo)'),
    local: a.location ? String(a.location) : '',
  }
}

export function lerNeutro(doc) {
  exigeObjeto(doc, 'relatorio neutro')
  if (!Array.isArray(doc.findings)) throw new ErroDeRelatorio('relatorio neutro: falta a lista "findings"')
  return {
    formato: 'neutro',
    coberturaCompleta: typeof doc.coverage_complete === 'boolean' ? doc.coverage_complete : null,
    scanners: (doc.scanners_ran ?? []).map(String),
    achados: doc.findings.map(achadoNeutro),
  }
}

export function lerSarif(doc) {
  exigeObjeto(doc, 'SARIF')
  if (!Array.isArray(doc.runs)) throw new ErroDeRelatorio('SARIF: falta "runs"')
  // Sem nenhuma execucao nao ha o que dizer: isso e "nao rodou", nunca "limpo".
  const scanners = []
  const achados = []
  let completa = doc.runs.length > 0
  for (const run of doc.runs) {
    const nome = run?.tool?.driver?.name
    if (nome) scanners.push(String(nome))
    for (const inv of run?.invocations ?? []) {
      if (inv?.executionSuccessful === false) completa = false
    }
    const regras = new Map((run?.tool?.driver?.rules ?? []).map((r) => [r.id, r]))
    for (const [i, r] of (run?.results ?? []).entries()) {
      const regra = regras.get(r.ruleId)
      const nota = r?.properties?.['security-severity'] ?? regra?.properties?.['security-severity']
      const severidade = severidadePorNota(nota) ?? normalizaSeveridade(r?.level ?? regra?.defaultConfiguration?.level) ?? 'medium'
      const loc = r?.locations?.[0]?.physicalLocation
      const local = loc?.artifactLocation?.uri ? `${loc.artifactLocation.uri}${loc.region?.startLine ? ':' + loc.region.startLine : ''}` : ''
      const impressao = r?.partialFingerprints ? Object.values(r.partialFingerprints)[0] : null
      achados.push({
        chave: String(impressao ?? `${r.ruleId ?? 'regra'}@${local || i}`),
        severidade,
        titulo: String(r?.message?.text ?? r.ruleId ?? '(sem titulo)'),
        local,
      })
    }
  }
  return { formato: 'sarif', coberturaCompleta: completa, scanners, achados }
}

export function lerRoqueShield(doc) {
  exigeObjeto(doc, 'bundle do RoqueShield')
  // A documentacao da plataforma descreve duas formas: `vulnerabilities` (a especificacao do
  // bundle) e `findings` (o guia de integracao). Aceitar as duas evita acoplar o gate a uma
  // discrepancia de documentacao.
  const lista = Array.isArray(doc.vulnerabilities) ? doc.vulnerabilities : Array.isArray(doc.findings) ? doc.findings : null
  if (!lista) throw new ErroDeRelatorio('bundle do RoqueShield: falta "vulnerabilities" (ou "findings")')
  const executados = doc.scan?.scanners_executed ?? doc.scanners_ran ?? []
  const falhos = doc.scan?.scanners_failed
  let cobertura = null
  if (typeof doc.coverage_complete === 'boolean') cobertura = doc.coverage_complete
  else if (Array.isArray(falhos)) cobertura = falhos.length === 0 && executados.length > 0
  const achados = lista.map((v, i) => {
    const severidade = normalizaSeveridade(v?.severity)
    if (!severidade) throw new ErroDeRelatorio(`vulnerabilidade ${i}: severidade "${v?.severity}" desconhecida`)
    const instancia = v?.instances?.[0]?.location ?? v?.location ?? v?.file ?? ''
    return {
      chave: String(v.deduped_key ?? v.id ?? `${v.title ?? 'achado'}@${instancia || i}`),
      severidade,
      titulo: String(v.title ?? v.deduped_key ?? '(sem titulo)'),
      local: String(instancia ?? ''),
    }
  })
  return { formato: 'roqueshield', coberturaCompleta: cobertura, scanners: executados.map(String), achados }
}

const LEITORES = { neutro: lerNeutro, sarif: lerSarif, roqueshield: lerRoqueShield }

/** Le o texto JSON de um relatorio e devolve a forma normalizada. */
export function lerRelatorio(texto, formato = 'auto') {
  let doc
  try {
    doc = JSON.parse(texto)
  } catch (e) {
    throw new ErroDeRelatorio(`o relatorio nao e JSON valido: ${e.message}`)
  }
  const f = formato === 'auto' ? detectaFormato(doc) : formato
  if (!f) throw new ErroDeRelatorio('nao reconheci o formato do relatorio; use --format neutro|sarif|roqueshield')
  if (!(f in LEITORES)) throw new ErroDeRelatorio(`formato desconhecido: ${f}`)
  return LEITORES[f](doc)
}

/**
 * Decide o resultado. `opcoes`: { falhaEm: severidade, exigeScanners: [string], baseline: normalizado }.
 * Devolve { codigo, motivo, bloqueantes, novos, resolvidos, restantes }.
 */
export function avalia(relatorio, opcoes = {}) {
  const limite = opcoes.falhaEm ?? 'high'
  if (!(limite in PESO)) throw new ErroDeRelatorio(`--fail-on "${limite}" desconhecido (use ${SEVERIDADES.join(', ')})`)

  const resultado = { codigo: 0, motivo: 'limpo', bloqueantes: [], novos: [], resolvidos: [], restantes: [] }

  if (relatorio.coberturaCompleta === null) {
    return { ...resultado, codigo: 2, motivo: 'o relatorio nao diz se a cobertura esta completa: tratado como "nao rodou", nunca como limpo' }
  }
  if (relatorio.coberturaCompleta === false) {
    return { ...resultado, codigo: 2, motivo: 'cobertura incompleta: algum scanner nao rodou ou falhou' }
  }
  const faltando = (opcoes.exigeScanners ?? []).filter((s) => !relatorio.scanners.map((x) => x.toLowerCase()).includes(s.toLowerCase()))
  if (faltando.length) {
    return { ...resultado, codigo: 2, motivo: `scanner exigido nao rodou: ${faltando.join(', ')}` }
  }

  if (opcoes.baseline) {
    const antes = opcoes.baseline
    if (antes.coberturaCompleta !== true) {
      return { ...resultado, codigo: 2, motivo: 'o baseline nao tem cobertura completa: nao da para comparar' }
    }
    const sumiu = antes.scanners.filter((s) => !relatorio.scanners.map((x) => x.toLowerCase()).includes(s.toLowerCase()))
    if (sumiu.length) {
      return { ...resultado, codigo: 2, motivo: `scanner que rodou no baseline nao rodou agora: ${sumiu.join(', ')}` }
    }
    const chavesAntes = new Set(antes.achados.map((a) => a.chave))
    const chavesAgora = new Set(relatorio.achados.map((a) => a.chave))
    resultado.novos = relatorio.achados.filter((a) => !chavesAntes.has(a.chave))
    resultado.restantes = relatorio.achados.filter((a) => chavesAntes.has(a.chave))
    resultado.resolvidos = antes.achados.filter((a) => !chavesAgora.has(a.chave))
  }

  resultado.bloqueantes = relatorio.achados.filter((a) => PESO[a.severidade] >= PESO[limite])
  if (resultado.bloqueantes.length) {
    return { ...resultado, codigo: 1, motivo: `${resultado.bloqueantes.length} achado(s) em ${limite} ou acima` }
  }
  return resultado
}
