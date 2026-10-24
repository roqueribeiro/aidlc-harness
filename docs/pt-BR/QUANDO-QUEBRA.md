# Quando o gate reprova

*Tradução de [WHEN-IT-BREAKS.md](../WHEN-IT-BREAKS.md), a versão principal, em inglês. Se as duas divergirem, vale a em inglês.*

O que cada estado significa e o que fazer com ele. A regra de fundo é que **pulado é pendência, não aprovação**, e que enfraquecer um teste para o gate passar é proibido: teste que falhou significa código errado.

## Os quatro estados

```bash
aidlc-gate            # roda os gates da tecnologia detectada
aidlc-gate --list     # o que existe para cada tecnologia
aidlc-gate --json     # a mesma coisa em dado
```

| Estado | O que é | O que fazer |
| --- | --- | --- |
| **PASSOU** | o comando rodou e saiu 0 | nada |
| **FALHOU** | o comando saiu diferente de 0, ou a saída casou o `reject` | conserte o código, nunca o teste |
| **PULADO** | o gate exige outra plataforma, e esta máquina não é ela | reporte como pendente de máquina, jamais como verde |
| **PENDENTE** | é um revisor de stack, e quem dispara subagente é a sessão | rode o subagente e cole o veredito |

O código de saída é sobre **comando**, e só. Um revisor pendente não reprova o binário, porque o binário não lê transcript e não tem como saber se você rodou o subagente. Quem cobra é o `dod-check`, no `Stop`, pela evidência `stack-review`. No CI ele vira `::warning::`, porque runner não dispara subagente.

## O Stop recusou o encerramento

O `dod-check` leu o transcript desde a sua última mensagem, viu que a árvore mudou e não achou a evidência que o manifesto daquela tecnologia exige. Ele lista o que falta.

Isso não é burocracia: é a diferença entre entrega e relatório. Cole a saída do gate sem resumir, o print, o `curl`, o veredito do revisor, o que for que ele pediu.

Salvaguardas, para ele nunca virar prisão:

- Nada foi alterado na árvore: ele libera. Não houve entrega a provar.
- Tecnologia não reconhecida: ele libera.
- Depois de três bloqueios na mesma sessão, ele vira aviso e libera.
- `AIDLC_GATE=0` desliga, e a opção `gate_mode` do plugin aceita `block`, `warn` e `off`.

Use o kill switch quando a evidência for mesmo desnecessária, e diga por quê. Usar por hábito é desligar a única coisa que separa "pronto" de "acho que está pronto".

## Falso vermelho, que é pior que vermelho

Um gate que reprova o que está certo ensina a ignorar o gate. Classes que costumam aparecer:

**O gate mudou o estado do repositório.** Gate escreve em diretório próprio e não suja a árvore.

**O `reject` casou o nome de um teste.** A regex de `reject` mira a linha de resumo, ancorada com `^`, não qualquer lugar da saída.

**A variável do comando não existia.** Manifesto que cita `$VAR` precisa de quem a defina.

**A suíte ficou intermitente.** Se falha sozinha e passa em conjunto, ou o contrário, desconfie de estado compartilhado em `tmp` entre execuções, por exemplo um id de sessão de teste derivado só do `pid`, que o sistema reusa.

## O revisor reprovou

Leia o veredito antes de aceitar. Revisor é ancorado nas regras da stack, e quando a instrução dele diverge da regra, ele reprova código correto.

Se o achado for real, conserte. Se o revisor estiver errado, conserte **o revisor** e diga isso na entrega: revisor errado que ninguém corrige vira revisor que todo mundo ignora.

## Antes do push

```bash
node scripts/install-git-hooks.mjs --check     # só reporta, exit 1 se faltar
node scripts/install-git-hooks.mjs             # instala o pre-push
```

O `pre-push` roda o `aidlc-gate` antes de deixar o push sair. Ele não sobrescreve hook alheio e respeita `core.hooksPath` e husky. Se `aidlc-gate` não está no `PATH`, o hook deixa passar: instalar o kit (`scripts/setup.mjs`) é parte do pré-requisito.

⚠️ **O gancho some sozinho.** `.git/hooks/` não é versionado, então ele desaparece em clone novo e máquina nova, calado. Por isso existe o `--check`.

## Documento contradiz o disco

```bash
node scripts/check-docs-consistency.mjs
```

É **aviso**, não bloqueio, e de propósito. Ele não distingue um inventário do presente de um relato histórico verdadeiro. Se o trecho for história, ele está certo e o aviso é ruído. Se for inventário, corrija na fonte. Para reprovar de verdade, use `--strict`.
