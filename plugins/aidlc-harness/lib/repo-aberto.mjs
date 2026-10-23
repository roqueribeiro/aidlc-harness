/*
 * O perfil de repo aberto do aidlc-doctor.
 *
 * Repo aberto e porta de entrada de quem nunca falou com o time: sem CONTRIBUTING, sem SECURITY,
 * sem CI que rode no PR de fork, a pessoa desiste antes do primeiro commit. O perfil mede o que
 * um contribuidor de fora precisa.
 *
 * Quem entra no perfil e decidido pelo que o repo DECLARA, sem rede: o LICENSE ou o
 * package.json com licenca de codigo aberto. Um repo fechado (sem licenca) nao e cobrado por
 * CONTRIBUTING; um repo MIT e, esteja publico hoje ou nao, porque licenca aberta e a promessa
 * de abrir.
 *
 * O DCO e opcional e declarado pelo projeto: `"dco": true` em `.aidlc/config.json`. Exigir
 * Signed-off-by de quem contribui e uma decisao de governanca, nao um padrao do kit.
 */

const LICENCAS = [
  ['AGPL-3.0', /GNU AFFERO GENERAL PUBLIC LICENSE/i],
  ['GPL-3.0', /GNU GENERAL PUBLIC LICENSE\s+Version 3/i],
  ['LGPL-3.0', /GNU LESSER GENERAL PUBLIC LICENSE/i],
  ['Apache-2.0', /Apache License,?\s+Version 2\.0/i],
  ['MPL-2.0', /Mozilla Public License,?\s+(v\.|version)\s*2\.0/i],
  ['BSD-3-Clause', /Redistribution and use in source and binary forms[\s\S]*Neither the name/i],
  ['BSD-2-Clause', /Redistribution and use in source and binary forms/i],
  ['ISC', /Permission to use, copy, modify, and\/or distribute this software for any purpose/i],
  ['MIT', /Permission is hereby granted, free of charge/i],
]

export const ABERTAS = new Set(LICENCAS.map(([id]) => id))

/** A licenca que o texto do LICENSE declara, ou null. A ordem importa: GPL antes de LGPL. */
export function licencaDoTexto(texto) {
  if (!texto) return null
  for (const [id, re] of LICENCAS) if (re.test(texto)) return id
  return null
}

/** O repo declara licenca de codigo aberto? Pelo LICENSE ou pelo package.json. */
export function licencaAberta({ licenseText, pkgLicense }) {
  const doArquivo = licencaDoTexto(licenseText)
  if (doArquivo) return doArquivo
  return pkgLicense && ABERTAS.has(pkgLicense) ? pkgLicense : null
}

/**
 * O texto tem uma parte em ingles? Titulo ou aviso ("English below"), ou prosa em ingles de
 * verdade. Aceitar so o titulo reprovaria READMEs escritos em ingles do comeco ao fim. Prosa conta
 * pelas palavras funcionais do ingles, que nao aparecem em portugues: 25 delas nao cabem num
 * trecho de comando ou num nome proprio.
 */
const FUNCIONAIS_EN = /\b(the|and|with|your|you|this|that|for|from|is|are|to|of|it|when|which)\b/gi
export const temIngles = (texto) =>
  /^#{1,3}\s.*\b(English|How to contribute|Getting started|Reporting a vulnerability)\b|_?English below_?|\bRead (this )?in English\b/im.test(
    texto ?? '',
  ) || (String(texto ?? '').replace(/```[\s\S]*?```/g, '').match(FUNCIONAIS_EN) || []).length >= 25

/*
 * O YAML sem os comentarios. O workflow de exemplo explica, em comentario, que "nunca
 * roda em pull_request_target", e a primeira versao desta regra o reprovou por isso.
 */
export const semComentario = (yaml) =>
  String(yaml ?? '')
    .split('\n')
    .map((l) => l.replace(/(^|\s)#.*$/, ''))
    .join('\n')

/**
 * Os jobs de um workflow, cada um com o texto do bloco e a condicao do `if:` do job.
 * Le o YAML pela indentacao que o GitHub exige (job a dois espacos de `jobs:`), sem parser.
 */
export function jobsDe(yaml) {
  const linhas = yaml.split('\n')
  const inicio = linhas.findIndex((l) => /^jobs:\s*$/.test(l))
  if (inicio < 0) return []
  const jobs = []
  for (const l of linhas.slice(inicio + 1)) {
    if (/^\S/.test(l)) break
    const m = l.match(/^ {2}([\w-]+):\s*$/)
    if (m) jobs.push({ nome: m[1], linhas: [] })
    else if (jobs.length) jobs[jobs.length - 1].linhas.push(l)
  }
  return jobs.map((j) => {
    const se = j.linhas.find((l) => /^ {4}if:/.test(l)) || ''
    return { nome: j.nome, texto: j.linhas.join('\n'), se }
  })
}

/** O job roda num pull_request? So nao roda quando o `if:` dele o prende a outro evento. */
export const rodaNoPr = (job) =>
  !/github\.event_name\s*==\s*'(push|workflow_dispatch|schedule|release)'|startsWith\(\s*github\.ref,\s*'refs\/tags\//.test(
    job.se,
  )

/**
 * CI de fork: existe um workflow que roda em `pull_request` e nenhum job que ele dispara no
 * PR precisa de segredo (o GitHub nao entrega segredo a PR de fork, entao esse job reprovaria
 * todo contribuidor de fora). `pull_request_target` reprova sempre: e ele que da ao codigo do
 * fork o token com escrita.
 *
 * Reprovar qualquer workflow com `pull_request` e um `secrets.` em qualquer
 * lugar daria falso vermelho: um job de publicar imagem que so roda em
 * `workflow_dispatch` pode usar segredo com seguranca.
 */
export function ciDeFork(workflows) {
  const limpos = workflows.map((w) => ({ ...w, yaml: semComentario(w.texto) }))
  const doPr = limpos.filter((w) => /\bpull_request\b/.test(w.yaml))
  const deFork = doPr.filter((w) => {
    const noPr = jobsDe(w.yaml).filter(rodaNoPr)
    return noPr.length > 0 && noPr.every((j) => !/\$\{\{\s*secrets\./.test(j.texto))
  })
  const perigosos = limpos.filter((w) => /pull_request_target/.test(w.yaml))
  const comSegredoNoPr = doPr.filter((w) => !deFork.includes(w))
  return { ok: deFork.length > 0 && perigosos.length === 0, doPr, deFork, perigosos, comSegredoNoPr }
}

/** O DCO tem mecanismo: um workflow que confere o Signed-off-by, e o CONTRIBUTING que explica. */
export const dcoDeVerdade = ({ contributing, workflows }) =>
  /Signed-off-by|\bDCO\b|Developer Certificate of Origin/i.test(contributing ?? '') &&
  workflows.some((w) => /Signed-off-by/.test(w.texto) && /\bpull_request\b/.test(w.texto))

export const exigeDco = (ctx) => ctx?.dco === true

/**
 * Os itens do perfil, como o doctor os pesa. `ctx` traz leitura de disco e o remoto:
 * has(rel), read(rel), workflows [{ nome, texto }], pkgLicense, dco (bool, de .aidlc/config.json).
 */
export function checksDeRepoAberto(ctx) {
  const licenseText = ctx.read('LICENSE') || ctx.read('LICENSE.md')
  const licenca = licencaAberta({ licenseText, pkgLicense: ctx.pkgLicense })
  if (!licenca) return { licenca: null, checks: [] }
  const doArquivo = licencaDoTexto(licenseText)
  const contributing = ctx.read('CONTRIBUTING.md')
  const readme = ctx.read('README.md')
  const ci = ciDeFork(ctx.workflows)
  const temAssets = ctx.has('public') || ctx.has('assets') || ctx.has('src/assets')
  const checks = [
    {
      id: 'aberto-licenca',
      label: `LICENSE e package.json dizem a mesma licenca (${licenca})`,
      weight: 4,
      ok: Boolean(doArquivo) && (!ctx.pkgLicense || ctx.pkgLicense === doArquivo),
      fix: 'o LICENSE tem o texto da licenca, e o "license" do package.json diz o mesmo SPDX',
      note: `LICENSE: ${doArquivo ?? 'ausente'}, package.json: ${ctx.pkgLicense ?? '-'}`,
    },
    {
      id: 'aberto-readme-en',
      label: 'README tem a parte em ingles',
      weight: 3,
      ok: temIngles(readme) || ctx.has('README.en-US.md') || ctx.has('README.en.md'),
      fix: 'pt-BR e canonico e en-US e obrigatorio: uma secao "English" no README, ou README.en-US.md',
    },
    {
      id: 'aberto-contributing',
      label: 'CONTRIBUTING.md em pt-BR e en-US',
      weight: 4,
      ok: Boolean(contributing) && temIngles(contributing),
      fix: 'CONTRIBUTING.md com o que so este repo tem, e a parte em ingles',
    },
    {
      id: 'aberto-security',
      label: 'SECURITY.md diz como relatar vulnerabilidade',
      weight: 3,
      ok: ctx.has('SECURITY.md'),
      fix: 'SECURITY.md com o canal privado (relato privado do GitHub) e o prazo de resposta',
    },
    {
      id: 'aberto-conduta',
      label: 'CODE_OF_CONDUCT.md',
      weight: 2,
      ok: ctx.has('CODE_OF_CONDUCT.md'),
      fix: 'CODE_OF_CONDUCT.md (Contributor Covenant 2.1, com o contato de quem responde)',
    },
    {
      id: 'aberto-modelos',
      label: 'Modelos de issue e de PR',
      weight: 2,
      ok:
        ctx.has('.github/ISSUE_TEMPLATE') &&
        (ctx.has('.github/pull_request_template.md') || ctx.has('.github/PULL_REQUEST_TEMPLATE.md')),
      fix: '.github/ISSUE_TEMPLATE/ (bug e ideia) e .github/pull_request_template.md',
    },
    {
      id: 'aberto-codeowners',
      label: 'CODEOWNERS: merge passa pelo dono',
      weight: 2,
      ok: ctx.has('.github/CODEOWNERS') || ctx.has('CODEOWNERS'),
      fix: '.github/CODEOWNERS apontando o mantenedor',
    },
    {
      id: 'aberto-ci-fork',
      label: 'CI roda no PR de fork, sem segredo',
      weight: 3,
      ok: ci.ok,
      fix: 'workflow com `pull_request`, sem `pull_request_target` e sem `secrets.*` nos jobs que o PR dispara',
      note: ci.perigosos.length
        ? `pull_request_target em: ${ci.perigosos.map((w) => w.nome).join(', ')}`
        : !ci.deFork.length && ci.comSegredoNoPr.length
          ? `pede segredo no PR: ${ci.comSegredoNoPr.map((w) => w.nome).join(', ')}`
          : null,
    },
  ]
  if (temAssets)
    checks.push({
      id: 'aberto-assets',
      label: 'ASSETS.md diz a origem e a licenca de cada arquivo de midia',
      weight: 2,
      ok: ctx.has('ASSETS.md'),
      fix: 'ASSETS.md com uma linha por arquivo: origem e licenca',
    })
  if (exigeDco(ctx))
    checks.push({
      id: 'aberto-dco',
      label: 'DCO: o CI confere o Signed-off-by, e o CONTRIBUTING explica',
      weight: 3,
      ok: dcoDeVerdade({ contributing, workflows: ctx.workflows }),
      fix: 'workflow de PR que reprova commit sem Signed-off-by, e a secao DCO no CONTRIBUTING',
    })
  return { licenca, checks }
}
