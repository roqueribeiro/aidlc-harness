#!/usr/bin/env node
/*
 * O parser do arquivo de preenchimento em lote.
 *
 * Errar aqui e caro de um jeito especifico: o valor entra no cofre MUTILADO, o import diz
 * "gravado", e o erro so aparece dias depois como falha de autenticacao. Cada teste aqui e
 * uma forma de mutilar que ja acontece quando alguem cola de um gerenciador de senhas.
 *
 * Uso: node plugins/aidlc-harness/lib/env-file.test.mjs
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { parseEnvFile, renderTemplate } from './env-file.mjs'

const only = (text) => parseEnvFile(text).entries
const first = (text) => only(text)[0]

describe('parseEnvFile: o basico', () => {
  test('le chave e valor', () => {
    assert.deepEqual(first('GITHUB_TOKEN=abc123'), { key: 'GITHUB_TOKEN', value: 'abc123', line: 1 })
  })

  test('ignora comentario e linha vazia, e conta a linha certa', () => {
    const e = only('# comentario\n\n   \nGITHUB_TOKEN=abc')
    assert.equal(e.length, 1)
    assert.equal(e[0].line, 4)
  })

  test('aceita `export` na frente, que e como se cola de um tutorial', () => {
    assert.equal(first('export GITHUB_TOKEN=abc').value, 'abc')
  })

  test('aceita espaco em volta do igual', () => {
    assert.equal(first('GITHUB_TOKEN = abc').value, 'abc')
  })

  test('CRLF do Windows nao vira parte do valor', () => {
    assert.equal(first('GITHUB_TOKEN=abc\r\nOUTRA=x').value, 'abc')
  })

  test('BOM nao gruda na primeira chave', () => {
    // Sem tratar, a chave viraria "﻿GITHUB_TOKEN" e nao casaria com nada.
    assert.equal(first('﻿GITHUB_TOKEN=abc').key, 'GITHUB_TOKEN')
  })
})

describe('parseEnvFile: o que mutila um segredo', () => {
  test('tira aspas que abrem e fecham', () => {
    assert.equal(first('K="abc"').value, 'abc')
    assert.equal(first("K='abc'").value, 'abc')
  })

  /*
   * Aspa so de um lado e valor com aspa no meio: tirar seria mutilar. Um token que perde
   * um caractere falha na autenticacao com uma mensagem que nao diz que falta um caractere.
   */
  test('nao mexe em aspa solta nem em aspa no meio', () => {
    assert.equal(first('K="abc').value, '"abc')
    assert.equal(first('K=abc"').value, 'abc"')
    assert.equal(first('K=ab"cd').value, 'ab"cd')
    assert.equal(first(`K="abc'`).value, `"abc'`)
  })

  test('igual dentro do valor sobrevive inteiro', () => {
    // Base64 termina em `=` o tempo todo.
    assert.equal(first('K=a=b=c==').value, 'a=b=c==')
  })

  test('cerquilha dentro de aspas e valor, fora de aspas e comentario', () => {
    assert.equal(first('K="a#b"').value, 'a#b')
    assert.equal(first('K=abc # comentario').value, 'abc')
    // Sem espaco antes, a cerquilha e do valor: senha com # no meio e comum.
    assert.equal(first('K=abc#def').value, 'abc#def')
  })

  test('espaco no meio do valor entre aspas e preservado', () => {
    assert.equal(first('K="com espaco no meio"').value, 'com espaco no meio')
  })

  test('valor vazio fica vazio, sem virar undefined', () => {
    assert.equal(first('K=').value, '')
    assert.equal(first('K=   ').value, '')
  })
})

describe('parseEnvFile: problemas', () => {
  test('linha que nao e KEY=VALOR vira problema, nao entrada', () => {
    const { entries, problems } = parseEnvFile('isso nao e nada\nK=v')
    assert.equal(entries.length, 1)
    assert.equal(problems.length, 1)
    assert.equal(problems[0].line, 1)
    assert.match(problems[0].why, /nao e KEY=VALOR/)
  })

  /*
   * Chave repetida em silencio e o pior caso: a pessoa corrige o valor embaixo, o parser
   * fica com um dos dois, e nao ha como saber qual sem ler o codigo. Entao a segunda vira
   * problema e nao sobrescreve.
   */
  test('chave repetida e reportada, e a primeira ocorrencia vence', () => {
    const { entries, problems } = parseEnvFile('K=primeiro\nK=segundo')
    assert.equal(entries.length, 1)
    assert.equal(entries[0].value, 'primeiro')
    assert.match(problems[0].why, /repetido, a linha 1/)
  })

  test('chave com caractere invalido nao passa como chave', () => {
    assert.equal(parseEnvFile('MINHA-CHAVE=v').entries.length, 0)
    assert.equal(parseEnvFile('9CHAVE=v').entries.length, 0)
    assert.equal(parseEnvFile('_CHAVE=v').entries.length, 1)
  })

  test('arquivo vazio nao e erro, e so vazio', () => {
    assert.deepEqual(parseEnvFile(''), { entries: [], problems: [] })
  })
})

describe('renderTemplate', () => {
  const campos = [
    { env: 'GITHUB_TOKEN', name: 'github-token', use: 'API do GitHub', where: 'github.com/settings/tokens' },
    { env: 'ASC_KEY_PATH', name: 'asc-key-path', use: 'chave da Apple', where: 'o .p8 baixado', note: 'baixa uma vez so' },
  ]

  test('escreve uma linha de chave por campo, todas vazias', () => {
    const out = renderTemplate(campos)
    assert.match(out, /^GITHUB_TOKEN=$/m)
    assert.match(out, /^ASC_KEY_PATH=$/m)
  })

  test('leva o onde-achar de cada campo, que e o que economiza tempo', () => {
    const out = renderTemplate(campos)
    assert.match(out, /onde: github\.com\/settings\/tokens/)
    assert.match(out, /nota: baixa uma vez so/)
  })

  test('campo sem nota nao gera linha de nota vazia', () => {
    assert.equal(renderTemplate([campos[0]]).includes('# nota:'), false)
  })

  /* O ciclo fechado: o que o template escreve, o parser le, e sai vazio como esperado. */
  test('o que o template gera e lido pelo parser sem nenhum problema', () => {
    const { entries, problems } = parseEnvFile(renderTemplate(campos))
    assert.deepEqual(problems, [])
    assert.deepEqual(
      entries.map((e) => e.key),
      ['GITHUB_TOKEN', 'ASC_KEY_PATH'],
    )
    assert.ok(entries.every((e) => e.value === ''))
  })

  test('avisa que o arquivo e transitorio e cita o import', () => {
    const out = renderTemplate(campos)
    assert.match(out, /TRANSITORIO/)
    assert.match(out, /aidlc-secrets import/)
  })
})
