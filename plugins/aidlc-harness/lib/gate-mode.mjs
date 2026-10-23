/*
 * O modo do gate, lido num lugar so.
 *
 * `gate_mode` e o campo de configuracao do plugin (block | warn | off) e, antes,
 * so o dod-check o lia: com `off` na tela do plugin, ai-tells e promise-check continuavam
 * recusando o Stop com exit 2, e a descricao do campo dizia "desligado". Tres hooks de Stop,
 * uma configuracao, tres leituras diferentes e a de um deles. Agora e uma funcao.
 *
 * AIDLC_GATE=0 continua sendo o kill switch de emergencia e vence tudo.
 */
export function gateMode() {
  if (process.env.AIDLC_GATE === '0') return 'off'
  const v = (process.env.CLAUDE_PLUGIN_OPTION_GATE_MODE ?? 'block').toLowerCase()
  return ['block', 'warn', 'off'].includes(v) ? v : 'block'
}
