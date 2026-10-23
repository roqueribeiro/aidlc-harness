#!/usr/bin/env node
/**
 * Stop hook: recusa encerrar um turno que PROMETE continuar.
 *
 * Por que existe:
 * a regra "entrega termina em verde, não em relatório" foi escrita no OPERATING-MODEL e
 * continuou sendo quebrada no mesmo dia em que foi escrita. Documento não muda
 * comportamento; mecanismo muda.
 *
 * O `check-undeployed.cjs` já cobre um caso vizinho e funciona: commit que não virou
 * produção. Este cobre o que ele deixa passar, que é outro e mais escorregadio: o turno
 * termina com "sigo no loop", "próximo alvo", "na próxima iteração eu faço X". A frase soa
 * como continuidade e é um fim, porque ninguém segue: o turno acabou ali.
 *
 * A regra que este arquivo impõe é dura de propósito: **ou faz agora, ou não promete.**
 * Prometer e parar é a forma mais convincente de parecer que o trabalho está andando.
 *
 * NÃO bloqueia, deliberadamente:
 *  - pendência relatada como FATO ("ficou de fora X, porque Y"), que é obrigatória pela DoD
 *    e não é promessa. Bloquear isso ensinaria a esconder pendência em vez de declarar;
 *  - promessa condicionada aa pessoa responsável ("quando você disser"), porque aí a bola é dele;
 *  - turno sem promessa nenhuma, que é o encerramento normal.
 */

import { readFileSync } from 'node:fs'
import { gateMode } from '../lib/gate-mode.mjs'

if (process.env.AIDLC_PROMISE === '0') process.exit(0)
// gate_mode (block | warn | off) e configuracao do plugin e vale para os tres hooks de Stop.
if (gateMode() !== 'block') process.exit(0)

let entrada = {}
try {
  entrada = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const texto = String(entrada.last_assistant_message || entrada.transcript || '')
if (!texto.trim()) process.exit(0)

/*
 * Tira bloco de código, trecho em crase e linha citada ANTES de procurar promessa.
 *
 * Isto não é refinamento, é correção de um falso positivo real: na primeira versão o hook
 * bloqueou um turno porque a mensagem CITAVA, dentro de um bloco de código, a saída de teste
 * do próprio hook ("Proximo alvo: ..." -> exit 2). Ou seja, ele leu a evidência de que
 * funcionava como se fosse a infração.
 *
 * Citar o que uma ferramenta imprimiu é exatamente o que se pede num relatório com prova.
 * Um guard que pune a apresentação da prova ensina a não colar prova, que é o oposto do que
 * o resto deste harness existe para conseguir.
 */
const semCodigo = texto
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/`[^`\n]*`/g, ' ')
  .split('\n')
  .filter((l) => !/^\s*(?:>|\s{4,}\S)/.test(l))
  .join('\n')

// Só o fim importa: é ali que mora o encerramento.
const fim = semCodigo.slice(-1800)

/*
 * Promessa em PRIMEIRA PESSOA e no futuro. O recorte é estreito porque "falta" e "pendente"
 * sozinhos aparecem em relatório honesto, que é exigido pela DoD.
 */
const PROMESSAS = [
  /\bsigo\b(?!\s+(?:sem|à disposição))/i,
  /\bvou seguir\b/i,
  /\bcontinuo\b(?!\s+(?:disponível|à disposição))/i,
  /\bsegue?\s+(?:no|o)\s+loop\b/i,
  /\bpr[óo]xim[ao]\s+(?:alvo|passo|itera[çc][ãa]o|leva)\b/i,
  /\bem seguida\s+(?:vou|eu)\b/i,
  /\bagora\s+vou\b/i,
  /\bna sequ[êe]ncia\s+(?:vou|eu)\b/i,
]

const CONDICIONADAS = [
  /\bse (?:voc[êe]|vc) (?:quiser|mandar|disser|preferir)\b/i,
  /\bquando (?:voc[êe]|vc) (?:quiser|mandar|disser)\b/i,
  /\b(?:me diga|me avise|aguardo sua|fica (?:a )?seu crit[ée]rio)\b/i,
]

const promessa = PROMESSAS.find((r) => r.test(fim))
if (!promessa) process.exit(0)

const linha = (fim.split('\n').find((l) => promessa.test(l)) || fim.match(promessa)[0])
  .trim()
  .slice(0, 160)
if (CONDICIONADAS.some((r) => r.test(linha))) process.exit(0)

console.error('[aidlc-harness] Este turno PROMETE continuar, e encerrar aqui quebra a promessa.')
console.error('')
console.error(`  O que voce escreveu:  "${linha}"`)
console.error('')
console.error('Duas saidas legitimas, e so essas duas:')
console.error('  1. FACA AGORA. Se e a proxima coisa, ela cabe neste turno.')
console.error('  2. Reescreva o fecho SEM a promessa: declare a pendencia como fato')
console.error('     ("fica em aberto X, porque Y") ou devolva a decisao aa pessoa responsável')
console.error('     ("quando voce disser, eu faco X").')
console.error('')
console.error('Prometer e parar e a forma mais convincente de parecer que o trabalho anda.')
console.error('Kill switch, se for mesmo falso positivo:  AIDLC_PROMISE=0')
process.exit(2)
