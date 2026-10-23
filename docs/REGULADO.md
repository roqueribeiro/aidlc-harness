# Perfil para organizações reguladas

Para equipes em bancos, seguradoras, saúde, governo e outras organizações com auditoria, segregação de funções e dados sensíveis. Este documento é genérico de propósito: **nada aqui é específico de uma empresa**, e o kit não traz política de nenhuma. A política da sua organização mora num repositório interno que estende este (veja a última seção).

Este documento não é aconselhamento jurídico nem de conformidade, e o kit não certifica nada. Ele diz onde os controles do kit ajudam, onde não ajudam, e o que a sua organização precisa acrescentar.

## Controles: o que o kit cobre e o que falta

| Preocupação | O que o kit oferece | Lacuna, que é sua |
| --- | --- | --- |
| **Rastro de decisão** | `aidlc/` versionado: requisitos, desenho e plano de testes com `Aprovado por:` e `Data:`; `aidlc/decisions.md` | A assinatura é um nome em texto. Para valer como evidência, comite por pull request com revisão obrigatória e use commits assinados |
| **Segregação de funções** (quem escreve não aprova) | `aidlc-phase` reprova aprovação com nome de IA | Que o aprovador seja outra pessoa que não o autor: `CODEOWNERS` + proteção de branch exigindo revisão do dono. O kit não verifica isso |
| **Registro do gate** | O hook de Stop grava cada decisão em `.claude/audit/<dia>.jsonl`; `aidlc-cycle` lê | O registro é local e editável. Para auditoria, envie para o seu sistema de logs; retenção e imutabilidade são da sua infraestrutura |
| **Dado sensível fora do repositório** | `aidlc-identity` acha IP, e-mail, caminho de home, hostname, segredo e os **termos que você listar** | Classificação de dados e o que conta como sensível são seus. O scanner acha formato, não significado |
| **Segredos** | `secret-guard` (Claude Code) bloqueia comando que exibe valor; `aidlc-secrets exec` injeta sem imprimir | O cofre do kit é o chaveiro do macOS ou arquivos locais. Em uma organização regulada, use o cofre corporativo e trate `aidlc-secrets` como exemplo |
| **Cadeia de suprimento** | `aidlc-secscan`, `aidlc-lockcheck`, `supply-chain-reviewer`, `pkg-manager` | Registro interno espelhado, lista de pacotes aprovados e SBOM não vêm no kit |
| **Dados na conversa com a IA** | A regra de `AGENTS.md`: nada de dado pessoal ou de infraestrutura | É uma instrução, não um bloqueio. Quais dados podem sair para qual modelo é decisão da sua política e do contrato do seu fornecedor de IA |
| **Gestão de mudança** | O gate no CI e as fases dão a evidência de teste | Vínculo com o seu processo de mudança (ticket, janela, aprovação de risco) é seu |

## Configuração sugerida de partida

Em `.aidlc/config.json`: `"dco": true` se a organização exige certificação de origem das contribuições. No plugin, `gate_mode: block` (padrão) em vez de `warn`.

No CI, torne a fase obrigatória em vez de informativa. O workflow gerado usa `aidlc-phase status` (informativo) porque projeto recém-criado ainda tem a Inception por preencher; quando o projeto entrar em Construction, troque para:

```bash
aidlc-phase check inception
aidlc-phase check construction
```

Ative a lista de termos proibidos no CI (`AIDLC_IDENTITY_TERMS` apontando para um arquivo mantido fora do repositório público, ou dentro de um repositório interno privado) com os nomes de sistemas, clientes, unidades e pessoas que não podem aparecer.

Declare `scratchDir` em `.aidlc/config.json` se quiser que o `scratch-guard` mantenha o agente longe de espalhar arquivos pelo diretório pessoal.

## Aprovações que merecem mais que um nome

O `Aprovado por:` é uma declaração. Três reforços baratos:

1. **Pull request com revisão obrigatória do `CODEOWNERS`** para qualquer mudança em `aidlc/**`. O histórico do repositório passa a mostrar quem aprovou e quando, por um mecanismo que a sua plataforma já audita.
2. **Commits assinados** nos arquivos de aprovação.
3. **Aprovador diferente do autor**, verificado pela proteção de branch, não pela confiança.

## O que **não** colocar neste repositório público

Se você usar este kit como base: nomes de sistemas internos, endpoints, políticas, padrões de arquitetura proprietários, classificação de dados, nomes de pessoas e áreas. Tudo isso vai no repositório interno (próxima seção). Rode `aidlc-identity` com a sua lista de termos antes de qualquer contribuição de volta para o kit.

## Estendendo o kit sem forkar

Recomendado: **um repositório interno privado** que depende do kit em vez de copiá-lo.

```
interno-aidlc/                      (privado)
├── .aidlc/quality/*.json           tecnologias e gates da organização (mesmo `tech` sobrescreve o do kit)
├── context/product.md              (por projeto)
├── rules/                          padrões de arquitetura, segurança, dados
├── identity-terms.txt              termos proibidos (nomes de sistemas, áreas, clientes)
└── templates/                      AGENTS.md da organização, com as regras internas
```

Manifestos em `.aidlc/quality/` do projeto se somam aos do kit; um com o mesmo `tech` o sobrescreve, e um inválido é ignorado **e reportado** (veja [ESTENDER.md](ESTENDER.md)). Assim a política da organização evolui sem tocar neste repositório, e as atualizações do kit chegam por uma atualização de versão, não por merge.

Fixe a versão do kit que você adotou (tag ou commit revisado), no plugin e no CI. Atualizar é uma mudança como qualquer outra: revisada, testada, registrada.

## Antes de adotar, pergunte

1. A área de segurança e de risco de tecnologia aprovou o uso da ferramenta de IA e o fluxo de dados para o fornecedor?
2. Há política sobre código gerado por IA (revisão, propriedade, licenciamento)?
3. O plugin e os executáveis do kit passaram pela revisão que a organização exige para software de terceiros? O código está aqui, é pequeno e tem testes, mas a revisão é sua.
4. Quem é o dono do repositório interno que estende o kit, e como ele recebe as atualizações?
