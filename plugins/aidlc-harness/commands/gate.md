---
description: 'Roda o critério de aceite da tecnologia detectada e cola a evidência no chat, sem resumir.'
argument-hint: '[id de um gate específico, padrão: todos]'
allowed-tools: Bash, Read, Glob, Grep
---

Rode o critério de aceite deste repositório e **mostre a saída real**.

```bash
aidlc-gate --list        # o que existe para esta tecnologia
aidlc-gate $1            # sem argumento, roda todos
```

Gate do tipo `agent` nao roda sozinho: quem dispara o subagente e voce. Ele aparece como
**PENDENTE** e entra em `pending` no `--json`. Rode o revisor e cole o veredito: o Stop
recusa o encerramento sem ele. No CI vira `::warning::`, porque runner nao dispara subagente.

## O contrato de evidência

Isto é o que separa "acho que passou" de "passou":

- **Cole a saída de verdade**, não uma paráfrase. Contagem de teste, nome de arquivo, código de saída.
- Um gate que não rodou é **não rodou**, nunca "provavelmente passa". Diga por que não rodou (falta binário, precisa de macOS, precisa de rede) e o que destravaria.
- Gate vermelho: mostre a falha inteira antes de propor qualquer conserto.
- Não conserte nada neste comando. Aqui é medição. Conserto é outra conversa, com o diagnóstico já na mesa.

## Quando terminar

Uma linha por gate, no formato `id · ok|falhou|não rodou · o número que prova`. Depois, se houver falha, o trecho bruto da primeira.

Se tudo passou, encerre com a contagem total e nada mais. Não elogie o resultado.
