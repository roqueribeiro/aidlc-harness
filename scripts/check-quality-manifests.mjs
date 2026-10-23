#!/usr/bin/env node
/*
 * Valida os manifestos de criterio de aceite contra plugins/aidlc-harness/quality/_schema.json.
 *
 * Nao usa ajv de proposito: o kit nao tem dependencias e o gate precisa rodar em qualquer
 * maquina sem instalar nada. O subconjunto de Draft-07 que os
 * manifestos usam (required, type, enum, pattern, minItems, additionalProperties) e pequeno
 * e explicito o bastante pra ser checado a mao com honestidade.
 *
 * Uso: node scripts/check-quality-manifests.mjs [--json] [--dir <pasta-quality>]
 *
 * `--dir` existe para o teste apontar uma copia com defeito; o padrao e a pasta do plugin.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const dirArg = process.argv.indexOf('--dir')
const DIR = dirArg > 0 ? resolve(process.argv[dirArg + 1]) : join(ROOT, 'plugins/aidlc-harness/quality')
// `@kit/` resolve na raiz do plugin, que e a pasta acima de quality/.
const KIT = dirname(DIR)
const JSON_OUT = process.argv.includes('--json')

const problems = []
const seen = new Map()

function fail(file, msg) {
  problems.push({ file, msg })
}

function checkNode(schema, value, path, file, root) {
  if (schema.$ref) return // nao usamos $ref nos manifestos
  const t = schema.type
  if (t === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return fail(file, `${path} deveria ser object`)
    }
    for (const req of schema.required ?? []) {
      if (!(req in value)) fail(file, `${path}.${req} obrigatorio e ausente`)
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) {
        if (!(k in (schema.properties ?? {}))) fail(file, `${path}.${k} nao existe no schema`)
      }
    }
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (k in value) checkNode(sub, value[k], `${path}.${k}`, file, root)
    }
    return
  }
  if (t === 'array') {
    if (!Array.isArray(value)) return fail(file, `${path} deveria ser array`)
    if (schema.minItems != null && value.length < schema.minItems) {
      fail(file, `${path} precisa de pelo menos ${schema.minItems} item(s), tem ${value.length}`)
    }
    value.forEach((v, i) => schema.items && checkNode(schema.items, v, `${path}[${i}]`, file, root))
    return
  }
  if (schema.enum) {
    if (!schema.enum.includes(value)) {
      fail(file, `${path} = ${JSON.stringify(value)} nao esta em [${schema.enum.join(', ')}]`)
    }
    return
  }
  if (t === 'string') {
    if (typeof value !== 'string') return fail(file, `${path} deveria ser string`)
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
      fail(file, `${path} = "${value}" nao casa /${schema.pattern}/`)
    }
    return
  }
  if (t === 'boolean' && typeof value !== 'boolean') fail(file, `${path} deveria ser boolean`)
  if ((t === 'number' || t === 'integer') && typeof value !== 'number') fail(file, `${path} deveria ser number`)
}

function main() {
  if (!existsSync(DIR)) {
    console.error(`diretorio ausente: ${DIR}`)
    process.exit(1)
  }
  const schema = JSON.parse(readFileSync(join(DIR, '_schema.json'), 'utf8'))
  const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== '_schema.json' && f !== '_org.json').sort()

  /*
   * `_org.json` e a camada org (2.15.0): nao e tecnologia, entao nao passa pelo schema do
   * manifesto. Regra propria: `gates` e `evidence`, cada gate com `id`, `label`, `cmd` ou `agent`,
   * `blocking` e um `when` com `pkgManager` e/ou `tech` em lista. Gate org sem `when` valeria
   * para tudo, inclusive stack sem package.json, e e recusado.
   */
  const orgPath = join(DIR, '_org.json')
  if (existsSync(orgPath)) {
    let org
    try {
      org = JSON.parse(readFileSync(orgPath, 'utf8'))
    } catch (e) {
      fail('_org.json', `JSON invalido: ${e.message}`)
      org = null
    }
    if (org) {
      for (const k of Object.keys(org)) {
        if (!['$comment', 'gates', 'evidence'].includes(k)) fail('_org.json', `chave "${k}" nao existe na camada org (so $comment, gates e evidence)`)
      }
      // Evidencia org: id, label, markers e um `when` explicito; `todas: true` e a forma
      // declarada de valer para tudo (o fechamento de unidade), nunca a ausencia do when.
      for (const e of org.evidence ?? []) {
        for (const req of ['id', 'label', 'markers', 'when']) if (!(req in e)) fail('_org.json', `evidencia "${e.id ?? '?'}" sem ${req}`)
        if (e.when && e.when.todas !== true && !Array.isArray(e.when.pkgManager) && !Array.isArray(e.when.tech)) fail('_org.json', `evidencia "${e.id}" com when sem todas, pkgManager ou tech`)
        for (const r of [...(e.markers ?? []), ...(e.whenSays ?? [])]) {
          try {
            new RegExp(r)
          } catch {
            fail('_org.json', `evidencia "${e.id}": regex invalida ${r}`)
          }
        }
      }
      for (const g of org.gates ?? []) {
        for (const req of ['id', 'label', 'blocking']) if (!(req in g)) fail('_org.json', `gate "${g.id ?? '?'}" sem ${req}`)
        if ((typeof g.cmd === 'string') === (typeof g.agent === 'string')) fail('_org.json', `gate "${g.id}" precisa de exatamente um entre cmd e agent`)
        if (!g.when || (!Array.isArray(g.when.pkgManager) && !Array.isArray(g.when.tech))) fail('_org.json', `gate "${g.id}" sem when.pkgManager ou when.tech: valeria para stack sem o pre-requisito`)
      }
      const orgIds = new Set((org.gates ?? []).map((g) => g.id))
      for (const f of files) {
        try {
          const m = JSON.parse(readFileSync(join(DIR, f), 'utf8'))
          for (const g of m.gates ?? []) {
            if (orgIds.has(g.id) && g.cmd === (org.gates.find((o) => o.id === g.id)?.cmd)) {
              fail(f, `gate "${g.id}" copia o gate org com o mesmo comando: apague a copia, a heranca ja o entrega`)
            }
          }
        } catch {
          /* o laco principal reporta o JSON invalido */
        }
      }
    }
  }

  if (!files.length) fail('quality/', 'nenhum manifesto encontrado')

  for (const f of files) {
    let m
    try {
      m = JSON.parse(readFileSync(join(DIR, f), 'utf8'))
    } catch (e) {
      fail(f, `JSON invalido: ${e.message}`)
      continue
    }

    checkNode(schema, m, '', f, m)

    // Invariantes que o schema sozinho nao expressa.
    const expected = f.replace(/\.json$/, '').replace(/^_/, '')
    if (m.tech !== expected) fail(f, `tech "${m.tech}" nao bate com o nome do arquivo "${expected}"`)

    if (seen.has(m.tech)) fail(f, `tech "${m.tech}" duplicada, ja usada em ${seen.get(m.tech)}`)
    seen.set(m.tech, f)

    for (const g of m.gates ?? []) {
      const hasCmd = typeof g.cmd === 'string'
      const hasAgent = typeof g.agent === 'string'
      if (hasCmd === hasAgent) fail(f, `gate "${g.id}" precisa de exatamente um entre cmd e agent`)
      if (hasCmd && g.model) fail(f, `gate "${g.id}" e comando, model so vale pra gate do tipo agent`)
    }

    /*
     * Ponteiro de estrategia que aponta pro vazio.
     *
     * `read` e o que o roteador manda o agente ABRIR antes de escrever. Ponteiro quebrado nao
     * da erro: o agente tenta ler, nao acha, e segue sem a regra, que e exatamente o sintoma
     * que este bloco de estrategia existe pra acabar. Os `@kit/` sao verificaveis daqui; os
     * relativos ao repo consumidor nao, e ficam por conta do check do lado de la.
     */
    for (const p of m.strategy?.paths ?? []) {
      for (const alvo of p.read ?? []) {
        if (!alvo.startsWith('@kit/')) continue
        if (!existsSync(join(KIT, alvo.slice('@kit/'.length)))) {
          fail(f, `strategy manda ler \`${alvo}\`, que nao existe no plugin`)
        }
      }
      if (!(p.when ?? []).length) fail(f, 'recorte de strategy sem `when`, nunca casa caminho nenhum')
    }
    for (const alvo of m.strategy?.always ?? []) {
      if (alvo.startsWith('@kit/') && !existsSync(join(KIT, alvo.slice('@kit/'.length)))) {
        fail(f, `strategy.always manda ler \`${alvo}\`, que nao existe no plugin`)
      }
    }

    for (const e of m.evidence ?? []) {
      for (const marker of e.markers ?? []) {
        try {
          new RegExp(marker)
        } catch (err) {
          fail(f, `evidencia "${e.id}" tem regex invalida ${JSON.stringify(marker)}: ${err.message}`)
        }
      }
    }

    // Uma stack darwin-only cujo gate nao declara plataforma daria falso verde no Linux.
    if (m.platform === 'darwin') {
      const naked = (m.gates ?? []).filter((g) => g.cmd && !g.platform)
      if (naked.length) {
        fail(f, `platform=darwin mas os gates [${naked.map((g) => g.id).join(', ')}] nao declaram platform`)
      }
    }
  }

  if (problems.length) {
    if (JSON_OUT) console.log(JSON.stringify({ ok: false, problems }))
    else {
      console.error('manifestos de quality com problema:\n')
      for (const p of problems) console.error(`  ${p.file}\n    ${p.msg}`)
    }
    process.exit(1)
  }

  const active = [...seen.keys()].filter((t) => t !== 'archived')
  if (JSON_OUT) console.log(JSON.stringify({ ok: true, manifests: files.length, active }))
  else console.log(`ok, ${files.length} manifestos validos (${active.length} tecnologias vivas: ${active.join(', ')}).`)
}

main()
