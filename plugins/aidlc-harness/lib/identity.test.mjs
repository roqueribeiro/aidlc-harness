#!/usr/bin/env node
/*
 * Teste de mutação do detector de identidade: cada categoria é PLANTADA e tem de reprovar.
 * Um detector que nunca reprovou não é detector. Os valores são montados em tempo de execução
 * para este arquivo não ser, ele mesmo, um achado.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { acharNoTexto, varrer } from './identity.mjs'

const FERRAMENTA = join(dirname(fileURLToPath(import.meta.url)), '../tools/aidlc-identity')
const ip = (...p) => p.join('.')
const mac = (...p) => p.join(':')
const arroba = (a, b) => `${a}@${b}`

const categorias = (txt, o) => acharNoTexto(txt, o).map((a) => a.categoria)

describe('mutantes: cada categoria plantada reprova', () => {
  test('ipv4 privado e publico', () => {
    assert.deepEqual(categorias(`ssh ${ip(192, 168, 1, 40)}`), ['ipv4'])
    assert.deepEqual(categorias(`host ${ip(8, 8, 4, 4)}`), ['ipv4'])
  })
  test('mac', () => {
    assert.deepEqual(categorias(`mac ${mac('a4', 'bb', '6d', '12', '9f', '03')}`), ['mac'])
  })
  test('email', () => {
    assert.deepEqual(categorias(`contato ${arroba('maria.silva', 'banco.com.br')}`), ['email'])
  })
  test('caminho de home de pessoa, mac linux e windows', () => {
    assert.deepEqual(categorias('/Users/' + 'mariasilva/projetos'), ['home'])
    assert.deepEqual(categorias('/home/' + 'mariasilva/.config'), ['home'])
    assert.deepEqual(categorias('C:\\Users\\' + 'mariasilva\\Desktop'), ['home'])
  })
  test('hostname de rede interna', () => {
    assert.deepEqual(categorias('https://' + 'build01' + '.corp'), ['host-interno'])
    assert.deepEqual(categorias('nas.' + 'local'), ['host-interno'])
  })
  test('formato de segredo reutiliza o scrub', () => {
    assert.deepEqual(categorias('token ' + 'ghp_' + 'a'.repeat(30)), ['segredo'])
  })
  test('termo proibido do projeto, sem confundir palavra maior', () => {
    assert.deepEqual(categorias('o cliente Zeta pediu', { termos: ['Zeta'] }), ['termo'])
    assert.deepEqual(categorias('zetabyte e outra coisa', { termos: ['Zeta'] }), [])
  })
})

describe('o que NAO pode virar falso positivo', () => {
  test('documentacao e exemplo passam', () => {
    const limpo = [
      `ping ${ip(127, 0, 0, 1)}`,
      `rede ${ip(192, 0, 2, 10)} e mascara ${ip(255, 255, 255, 0)}`,
      `mail ${arroba('voce', 'example.com')} ${arroba('noreply', 'github.com')}`,
      '/Users/' + 'voce/projeto e /home/' + 'user/app e C:\\Users\\' + 'user\\x',
      'versao 2.26.5 e 1.22.22 e 10.2.3.4.5',
      mac('00', '00', '00', '00', '00', '00'),
      'https://app.example.' + 'internal',
    ].join('\n')
    assert.deepEqual(acharNoTexto(limpo), [])
  })
  test('numero de versao de 4 partes colado a outro numero nao e IP', () => {
    assert.deepEqual(categorias('build 1.2.3.4.5'), [])
  })
})

describe('varredura de diretorio', () => {
  const cria = (arquivos) => {
    const d = mkdtempSync(join(tmpdir(), 'aidlc-identity-'))
    for (const [f, c] of Object.entries(arquivos)) {
      mkdirSync(dirname(join(d, f)), { recursive: true })
      writeFileSync(join(d, f), c)
    }
    return d
  }

  test('repo limpo passa; plantar um IP reprova com arquivo e linha', () => {
    const d = cria({ 'a.md': 'nada aqui\n', 'src/b.js': 'const x = 1\n' })
    assert.equal(varrer(d, { termos: [] }).achados.length, 0)
    writeFileSync(join(d, 'src/b.js'), `const x = 1\nconst h = '${ip(10, 20, 30, 40)}'\n`)
    const r = varrer(d, { termos: [] })
    assert.equal(r.achados.length, 1)
    assert.deepEqual([r.achados[0].arquivo, r.achados[0].linha, r.achados[0].categoria], ['src/b.js', 2, 'ipv4'])
    rmSync(d, { recursive: true, force: true })
  })

  test('allowlist com motivo aceita; sem motivo e recusada e o achado continua', () => {
    const d = cria({ 'doc.md': `exemplo ${ip(10, 20, 30, 40)}\n`, '.aidlc/identity.json': JSON.stringify({ allow: [{ file: 'doc.md', categoria: 'ipv4', why: 'endereco ficticio do tutorial' }] }) })
    const ok = varrer(d, { termos: [] })
    assert.equal(ok.achados.length, 0)
    assert.equal(ok.aceitos, 1)
    writeFileSync(join(d, '.aidlc/identity.json'), JSON.stringify({ allow: [{ file: 'doc.md', why: 'x' }] }))
    const ruim = varrer(d, { termos: [] })
    assert.equal(ruim.achados.length, 1, 'allowlist sem motivo nao vale')
    assert.equal(ruim.erros.length, 1)
    rmSync(d, { recursive: true, force: true })
  })

  test('allowlist com `valor` aceita so aquele termo, nao o arquivo inteiro (mutante: sem o filtro, o outro termo passaria)', () => {
    const d = cria({
      'doc.md': 'usamos Alfa e tambem Beta\n',
      '.aidlc/identity.json': JSON.stringify({ allow: [{ file: 'doc.md', categoria: 'termo', valor: 'alfa', why: 'o produto Alfa e citado de proposito' }] }),
    })
    const r = varrer(d, { termos: ['alfa', 'beta'] })
    assert.ok(r.aceitos >= 1, 'Alfa aceito, sem diferenciar maiusculas')
    assert.equal(r.achados.length, 1, 'Beta continua reprovado')
    assert.equal(r.achados[0].valor, 'Beta')
    rmSync(d, { recursive: true, force: true })
  })

  test('a isenção da allowlist vale só para o valor declarado: outro termo proibido escrito nela continua reprovado', () => {
    const d = cria({ '.aidlc/identity.json': JSON.stringify({ allow: [{ file: 'doc.md', categoria: 'termo', valor: 'alfa', why: 'Alfa e citado, mas Beta nao devia estar aqui' }] }) })
    const r = varrer(d, { termos: ['alfa', 'beta'] })
    assert.deepEqual(r.achados.map((a) => a.valor), ['Beta'])
    rmSync(d, { recursive: true, force: true })
  })

  test('a allowlist pode declarar um e-mail por valor sem se acusar, e outro e-mail nela continua reprovado', () => {
    const d = cria({ '.aidlc/identity.json': JSON.stringify({ allow: [{ file: 'x.md', categoria: 'email', valor: arroba('contato', 'empresa.com.br'), why: 'contato do mantenedor' }] }), 'x.md': 'a\n' })
    assert.equal(varrer(d, { termos: [] }).achados.length, 0)
    writeFileSync(join(d, '.aidlc/identity.json'), JSON.stringify({ allow: [{ file: 'x.md', categoria: 'email', valor: arroba('contato', 'empresa.com.br'), why: `contato, nao ${arroba('outro', 'empresa.com.br')}` }] }))
    assert.equal(varrer(d, { termos: [] }).achados.length, 1)
    rmSync(d, { recursive: true, force: true })
  })

  test('sem `valor`, a entrada libera a categoria toda no arquivo (comportamento antigo preservado)', () => {
    const d = cria({
      'doc.md': 'usamos Alfa e tambem Beta\n',
      '.aidlc/identity.json': JSON.stringify({ allow: [{ file: 'doc.md', categoria: 'termo', why: 'doc de exemplo com termos de proposito' }] }),
    })
    const r = varrer(d, { termos: ['alfa', 'beta'] })
    assert.equal(r.achados.length, 0)
    assert.equal(r.aceitos, 2)
    rmSync(d, { recursive: true, force: true })
  })

  test('node_modules e .git nao entram', () => {
    const d = cria({ 'node_modules/x/i.js': `${ip(10, 20, 30, 40)}\n`, '.git/c': `${ip(10, 20, 30, 40)}\n`, 'ok.md': 'ok\n' })
    assert.equal(varrer(d, { termos: [] }).achados.length, 0)
    rmSync(d, { recursive: true, force: true })
  })
})

describe('ferramenta aidlc-identity', () => {
  test('exit 1 com achado, 0 sem; e avisa quando nao ha lista de termos', () => {
    const d = mkdtempSync(join(tmpdir(), 'aidlc-identity-cli-'))
    writeFileSync(join(d, 'a.md'), 'limpo\n')
    const env = { ...process.env, AIDLC_IDENTITY_TERMS: '', HOME: d }
    const limpo = spawnSync(process.execPath, [FERRAMENTA, d], { encoding: 'utf8', env })
    assert.equal(limpo.status, 0, limpo.stdout + limpo.stderr)
    assert.match(limpo.stdout, /NAO foi verificado/, 'nunca deixar "nada achado" passar por "limpo"')
    writeFileSync(join(d, 'a.md'), `contato ${arroba('fulano', 'empresa.com.br')}\n`)
    const sujo = spawnSync(process.execPath, [FERRAMENTA, d, '--json'], { encoding: 'utf8', env })
    assert.equal(sujo.status, 1)
    assert.equal(JSON.parse(sujo.stdout).porCategoria.email, 1)
    rmSync(d, { recursive: true, force: true })
  })
})
