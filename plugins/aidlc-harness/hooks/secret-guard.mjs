#!/usr/bin/env node
/*
 * PreToolUse(Bash): impede que um comando IMPRIMA segredo.
 *
 * Com Remote Control ligado, o transcript e armazenado e sincronizado entre dispositivos.
 * Um `cat ~/.ssh/id_ed25519` deixa de ser um deslize local e vira chave privada persistida
 * fora da maquina. Esta guarda e a razao de o cofre existir: o aidlc-secrets exec injeta
 * no ambiente do filho justamente pra que o valor nunca precise ser impresso.
 *
 * Nega o comando (exit 2) e diz qual e o caminho certo.
 */

const DANGEROUS = [
  { rx: /\bcat\s+[^|;&]*\.ssh\/id_/i, why: 'imprimiria uma chave privada SSH', use: 'ssh e git usam o ssh-agent, nao precisam do arquivo' },
  { rx: /\bsecurity\s+find-generic-password\b[^|;&]*\s-w\b/i, why: 'imprimiria um segredo do cofre do sistema', use: 'aidlc-secrets exec <nome> -- <comando>' },
  /*
   * O lookbehind existe porque `\b` casa entre o ponto e o "e" de `.env`, entao sem ele
   * seria negado `git check-ignore -v .env` e `ls -la .env` como se fossem `env`. Uma
   * guarda que bloqueia o comando que apenas CITA o nome do arquivo nao protege nada e
   * gasta o turno: o dano viria de despejar o ambiente, nao de escrever a palavra.
   */
  { rx: /(?<![\w./-])(printenv|env)\s*(\||;|&|$)/i, why: 'despejaria o ambiente inteiro, com segredo dentro', use: 'aidlc-secrets status, que lista sem imprimir valor' },
  { rx: /\becho\s+["'$]*\$\{?(GITHUB_TOKEN|ASC_|PLAY_|DOCKERHUB_TOKEN|AWS_SECRET|ANTHROPIC_API_KEY)/i, why: 'ecoaria um segredo do ambiente', use: 'passar a variavel direto pro comando que precisa dela' },
  /*
   * `.env.example`, `.env.sample` e `.env.template` sao versionados de proposito: eles
   * carregam o NOME de cada variavel e onde achar o valor, nunca o valor. Bloquear a
   * leitura deles negava justamente o arquivo que existe para ser lido.
   */
  { rx: /\bcat\s+[^|;&]*(\.env(?!\.(example|sample|template))\b|\.p8\b|service-account[^|;&]*\.json)/i, why: 'imprimiria um arquivo de credencial', use: 'aidlc-secrets exec, que injeta sem imprimir' },
  { rx: /\bgh\s+auth\s+token\b/i, why: 'imprimiria o token do GitHub', use: 'gh ja autentica sozinho, nao precisa do valor' },
]

let raw = ''
process.stdin.on('data', (d) => (raw += d))
process.stdin.on('end', () => {
  try {
    if (process.env.AIDLC_SECRET_GUARD === '0') process.exit(0)
    const input = JSON.parse(raw || '{}')
    const cmd = String(input.tool_input?.command ?? '')
    if (!cmd.trim()) process.exit(0)

    for (const d of DANGEROUS) {
      if (d.rx.test(cmd)) {
        process.stderr.write(
          `Bloqueado: o comando ${d.why}.\n` +
            `O transcript e sincronizado entre dispositivos, entao segredo impresso vira segredo vazado.\n` +
            `Use: ${d.use}\n`,
        )
        process.exit(2)
      }
    }
    process.exit(0)
  } catch {
    process.exit(0)
  }
})
