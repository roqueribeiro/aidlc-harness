# RoqueShield e o aidlc-harness

*Tradução de [ROQUESHIELD.md](../ROQUESHIELD.md), a versão principal, em inglês. Se as duas divergirem, vale a em inglês.*

> O RoqueShield é uma plataforma de testes de segurança contínuos, de código aberto (Apache-2.0), que o kit sabe ler. Este documento diz **o que é essa relação, o que ela não é e em que estado está**. Resumo: o kit **não depende** do RoqueShield; o RoqueShield é **uma** das plataformas que entram pelo mesmo contrato de varredura. Qualquer outra entra no mesmo lugar ([INTEGRACOES.md](INTEGRACOES.md)).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../assets/diagramas/roqueshield.escuro.svg">
  <img alt="O laço de varredura: RoqueShield acha, o kit cobra, o agente corrige" src="../assets/diagramas/roqueshield.claro.svg">
</picture>

## 1. Duas peças, uma ideia

O RoqueShield ([repositório](https://github.com/roqueribeiro/roqueos-shield), Apache-2.0, **alfa**) é um orquestrador de varredura: vários scanners atrás de um contrato de adaptador (SAST, segredos, CVE de dependência, IaC, DAST, rede, OSINT), triagem por modelo de linguagem sobre evidência já higienizada, um agente que tenta confirmar achados dentro de um contêiner Kali sob coleira, e um **AI Fix Bundle**: um JSON versionado que outro agente consome para propor o patch.

O `aidlc-harness` é o que cobra, no ciclo de desenvolvimento, que o critério de aceite tenha rodado.

Os dois projetos nasceram separados e chegaram à mesma regra por caminhos diferentes. A do RoqueShield, em tradução livre do README dele: *"zero achados aqui significa limpo, ou significa que não rodou? Se não há como distinguir, falta um sinal."* A do kit: **um scan que não rodou não é um scan limpo.** É por isso que a ligação é natural: o `coverage_complete` e o `scanners_skipped` de um são a matéria-prima do código de saída 2 do outro.

| | RoqueShield | aidlc-harness |
| --- | --- | --- |
| O que é | Plataforma que **executa** varreduras | Kit que **cobra** que o critério de aceite tenha rodado |
| Roda scanner? | Sim (15 adaptadores) | Não (só o Trivy embutido, para CVE de dependência) |
| Fala com o alvo? | Sim: é o que ele faz | Nunca |
| Saída que interessa ao outro | AI Fix Bundle (JSON, schema 1.0.0) | Código de saída 0, 1 ou 2 |
| Licença | Apache-2.0 | MIT |
| Depende do outro? | **Não** | **Não** |

## 2. A dependência, dita com exatidão

O que o kit **precisa** do RoqueShield: **um arquivo JSON** no formato do AI Fix Bundle. Nada mais. Não há cliente de API, credencial, biblioteca nem serviço do RoqueShield dentro do kit.

O que o RoqueShield **precisa** do kit: nada. Ele funciona sozinho, e o kit funciona sem ele (com outra plataforma, com o Trivy embutido, ou sem varredura nenhuma).

Isso é de propósito. Uma dependência de plataforma dentro de um kit de qualidade é um ponto único de falha com o nome de "qualidade". O contrato é um **leitor de relatório**: se a plataforma muda ou cai, o relatório não existe, e a saída é **2 (não rodou)**, nunca um verde.

## 3. Como ligar

Os caminhos abaixo vêm da documentação do RoqueShield (`docs/integrations.md` e `docs/ai-fix-bundle-spec.md` dele). **Não foram executados contra uma instância real neste repositório**: a integração do kit foi validada contra a especificação do bundle e contra os exemplos desta pasta, não contra uma instalação rodando. Confira os comandos na versão que você instalou.

### 3.1 Pelo CLI, em qualquer pipeline com shell

```bash
# o RoqueShield varre e exporta o bundle (comandos da documentação dele)
cai scan git@exemplo.com:org/app-exemplo.git --asset-type repo
cai bundle <scan_id> --out reports/seguranca.json

# o kit cobra
aidlc-scan reports/seguranca.json --format roqueshield --require-scanners semgrep,trivy
```

### 3.2 Pela API REST

O bundle fica em `GET /reports/{scan_id}/ai-bundle`. Baixe-o para `reports/seguranca.json` no passo anterior ao `aidlc-gate`; a autenticação é do seu pipeline, e o kit nunca vê a credencial.

### 3.3 Como gate do manifesto

```json
{ "id": "scan", "label": "Varredura de segurança (RoqueShield)", "blocking": true,
  "cmd": "aidlc-scan reports/seguranca.json --format roqueshield --fail-on high --require-scanners semgrep,trivy" }
```

Se o passo que gera `reports/seguranca.json` for removido, o gate dá **2** e reprova. Veja a receita completa de CI em [INTEGRACOES.md](INTEGRACOES.md#6-ci).

## 4. Como o kit lê o bundle

`lib/scan.mjs` (`lerRoqueShield`) traduz o bundle para a forma única do kit.

| Bundle do RoqueShield | No kit |
| --- | --- |
| `vulnerabilities[]` (especificação) **ou** `findings[]` (guia de integração) | achados |
| `deduped_key` (ou `id`) | chave estável do achado (usada por `--baseline`) |
| `severity` | severidade. É a **severidade ajustada pela triagem**; a do scanner fica em `severity_original` e o kit não a usa |
| `instances[0].location` | local do achado |
| `scan.scanners_executed` (ou `scanners_ran`) | scanners que rodaram |
| `coverage_complete`, quando existe; senão `scan.scanners_failed` vazio **e** `scanners_executed` não vazio | cobertura completa |
| nenhum dos sinais acima | cobertura **desconhecida**: saída 2 |

Três decisões de leitura que valem conhecer:

- **Severidade desconhecida é erro**, não "média". Adivinhar severidade é o jeito de deixar passar um crítico.
- **Provável falso positivo continua contando.** O bundle manda esse achado para `patch_priority` 5 sem tirá-lo da lista, e o próprio RoqueShield o trata como "candidato a descarte, não verdade". O kit é conservador: o achado conta até alguém decidir, na plataforma, que ele sai.
- **Lista vazia com cobertura completa é limpo; lista vazia sem cobertura é "não rodou".** Os exemplos [`roqueshield-bundle.json`](../exemplos/scan/roqueshield-bundle.json) (saída 1) e [`roqueshield-scanner-falhou.json`](../exemplos/scan/roqueshield-scanner-falhou.json) (saída 2, com `scanners_failed: ["trivy"]` e nenhum achado) mostram a diferença, e os testes do repositório os executam.

## 5. O laço: varrer, corrigir, varrer de novo

O RoqueShield descreve o laço em que um agente lê o bundle, corrige o código e **varre de novo**. O kit fornece a condição de parada que a documentação dele pede, e que não é "o agente disse que acabou":

1. O agente lê o bundle por `patch_priority` e corrige.
2. Roda uma nova varredura do mesmo alvo e gera outro relatório.
3. `aidlc-scan novo.json --baseline antigo.json` compara por chave estável: o que sumiu foi corrigido, o que ficou volta ao passo 1, e o que é **novo** é regressão que o patch introduziu.
4. O laço termina quando o scan **limpa e a cobertura continua completa**. Se um scanner deixou de rodar entre as rodadas, o `--baseline` responde 2 em vez de declarar vitória sobre uma ferramenta quebrada.

Esse último ponto é a razão de existir do contrato: sem checar a cobertura, "o agente corrigiu tudo" e "o scanner parou de funcionar" são indistinguíveis.

## 6. Estado honesto

- **O RoqueShield é alfa.** O README dele diz isso e lista o que ainda é esboço (por exemplo, o contêiner do agente Kali é um *stub* declarado). O kit herda esse estado: não trate a ligação como mais madura que a plataforma.
- **Validado contra a documentação, não contra uma instância.** Os testes do kit usam bundles sintéticos escritos a partir da especificação. Falta rodar o laço completo contra um RoqueShield de verdade. É uma contribuição bem-vinda (veja [CONTRIBUTING.md](CONTRIBUTING.md)).
- **A documentação do RoqueShield é inconsistente em três pontos**, e o leitor do kit foi escrito para tolerá-los em vez de depender de um deles:
  1. A lista de achados se chama `vulnerabilities` na especificação do bundle e `findings` no guia de integração.
  2. A cobertura é `scan.scanners_executed` e `scan.scanners_failed` na especificação, e `coverage_complete` e `scanners_ran` no guia.
  3. O campo `generator` do bundle aparece como `cai-orchestrator` na especificação e como `cai` (versão 0.3.0) no guia, que reconhece a própria divergência de versão entre o bundle, a aplicação e o `pyproject`.

  Se o formato real for outro, o kit responde **2**, não 0: um relatório que ele não entende nunca vira verde.
- **O MCP e a GitHub Action do RoqueShield são propostas** no repositório dele (a documentação diz que não estão implementadas). O kit não depende de nenhuma das duas; o CLI e o bundle bastam.

## 7. Autorização e escopo

Varrer um alvo que não é seu tem peso legal. O kit **não inicia varreduras e nunca fala com o alvo**: ele lê o resultado de uma que **você** decidiu e autorizou. A coleira do agente, o modo de laboratório e o registro de auditoria são do RoqueShield, e a leitura do README dele antes de apontá-lo para qualquer coisa real é recomendação dele, que vale repetir aqui.

## 8. E se a minha plataforma é outra?

Funciona do mesmo jeito, e é o caso comum:

| A plataforma exporta | Faça |
| --- | --- |
| SARIF 2.1.0 | `aidlc-scan relatorio.sarif --format sarif` (ou `auto`) |
| Um JSON próprio | converter para o formato neutro (receita com `jq` em [INTEGRACOES.md](INTEGRACOES.md#5-receitas-por-plataforma)) |
| Nada utilizável | tratar como "não rodou" até haver um relatório; nunca como limpo |

A integração com o RoqueShield não tem nenhum tratamento especial no gate: o único código específico dele é o leitor do formato, e o resto (cobertura, `--require-scanners`, `--baseline`, `--fail-on`, saída 2) é o mesmo para todos.
