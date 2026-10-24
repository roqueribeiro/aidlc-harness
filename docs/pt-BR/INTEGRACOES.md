# Integrações

*Tradução de [INTEGRATIONS.md](../INTEGRATIONS.md), a versão principal, em inglês. Se as duas divergirem, vale a em inglês.*

> Como ligar o kit a uma plataforma de segurança, a um pipeline de CI e a uma ferramenta de IA. A ideia central: o kit **não embute um scanner e não conhece a sua plataforma**. Ele lê o relatório que ela produz e cobra o resultado, com uma regra que não muda: **um scan que não rodou não é um scan limpo**.

Para o caso do RoqueShield em detalhe, veja [ROQUESHIELD.md](ROQUESHIELD.md). Para o desenho, [ARQUITETURA.md](ARQUITETURA.md#9-segurança-o-contrato-de-varredura).

![Contrato de varredura](../assets/diagramas/varredura.claro.svg)

## 1. O contrato em três linhas

1. A plataforma (qualquer uma) roda e **exporta um relatório JSON**.
2. `aidlc-scan <relatorio.json>` o normaliza e responde com **0 limpo**, **1 reprovado** ou **2 não rodou**.
3. No manifesto, isso é um gate comum, e o hook de `Stop` e o CI tratam como qualquer outro.

```json
{ "id": "scan", "label": "Varredura de segurança", "blocking": true,
  "cmd": "aidlc-scan reports/seguranca.json --fail-on high --require-scanners semgrep,trivy" }
```

O modelo completo está em `plugins/aidlc-harness/templates/security/node-yarn-com-scan.json`.

## 2. Os formatos

`aidlc-scan` detecta o formato pelo conteúdo (`--format auto`, o padrão) ou aceita `--format neutro|sarif|roqueshield`.

### Neutro (o contrato do kit)

O formato mais simples; é o alvo de qualquer conversão.

```json
{
  "coverage_complete": true,
  "scanners_ran": ["semgrep", "trivy"],
  "findings": [
    { "key": "sqli-001", "severity": "high", "title": "Consulta SQL montada por concatenação", "location": "src/db/usuarios.js:41" }
  ]
}
```

| Campo | Regra |
| --- | --- |
| `coverage_complete` | **Booleano obrigatório na prática.** Ausente ou não booleano vale como "o relatório não diz" e dá saída 2 |
| `scanners_ran` | Lista de nomes. Necessária para `--require-scanners` e para comparar com `--baseline` |
| `findings[]` | `severity` (obrigatória), `title`, `location`, e `key` (ou `id`) |
| `key` | Chave **estável** do achado: o que `--baseline` usa para dizer o que mudou. Sem ela, vale `título@local`, que quebra se a linha mudar |

Severidades aceitas: `info`, `low`, `medium`, `high`, `critical`, e sinônimos comuns (`error`, `warning`, `note`, `moderate`, `important`…), normalizados. No formato neutro e no bundle do RoqueShield, severidade que o kit não conhece é erro de relatório (saída 2), não "média": adivinhar severidade é o jeito de deixar passar um crítico. No SARIF, resultado sem nota nem `level` reconhecível cai em `medium`, porque o formato permite omitir a severidade; se a sua ferramenta faz isso com achado grave, ajuste a configuração dela para emitir `security-severity`.

### SARIF 2.1.0

O padrão que muitas ferramentas exportam. O leitor usa `runs[].tool.driver.name` como nome do scanner, `results[]` como achados e a severidade de `properties.security-severity` (nota CVSS, mapeada: 9 ou mais crítico, 7 ou mais alto, 4 ou mais médio, acima de 0 baixo) ou, na falta dela, de `level`.

A cobertura vem de duas regras, e é bom saber onde ela é fraca:

- Sem nenhuma `run`, é **não rodou** (nunca limpo).
- `invocations[].executionSuccessful: false` em qualquer `run` é **não rodou**.
- **Fraqueza:** um SARIF de uma ferramenta que caiu sem registrar a invocação lê como cobertura completa. Compense com `--require-scanners`, que exige o nome do scanner no relatório.

### RoqueShield AI Fix Bundle

O leitor aceita as duas formas que a documentação do RoqueShield descreve para a lista (`vulnerabilities` ou `findings`) e deduz a cobertura de `coverage_complete`, quando existe, ou de `scan.scanners_failed` vazio com `scan.scanners_executed` não vazio. Detalhes e limites em [ROQUESHIELD.md](ROQUESHIELD.md).

## 3. Opções do `aidlc-scan`

| Opção | Efeito |
| --- | --- |
| `--fail-on <severidade>` | Limite de reprovação (padrão `high`: `high` e `critical` reprovam) |
| `--require-scanners a,b` | Saída 2 se algum nome não consta no relatório (sem diferenciar maiúsculas) |
| `--baseline <anterior.json>` | Compara por `key`: mostra resolvidos, restantes e novos. O baseline precisa ter cobertura completa, e um scanner que rodou nele e sumiu agora é "não rodou" |
| `--format` | Força o formato quando a detecção automática não serve |
| `--json` | Saída para encadear |

Com `--baseline`, o bloqueio continua valendo para **todo** achado no limite, novo ou antigo: o baseline informa o que mudou, não perdoa o que ficou. Para aceitar um achado antigo de forma explícita, use o fluxo da sua plataforma (supressão com motivo e prazo) e deixe-o fora do relatório.

## 4. Exemplos que o CI executa

Os relatórios em [`docs/exemplos/scan/`](../exemplos/scan/) são executados pelos testes do repositório, com o código de saída conferido. Se um deles deixar de produzir o resultado abaixo, a documentação está mentindo e o CI reprova.

| Arquivo | Resultado |
| --- | --- |
| `neutro-limpo.json` | `0`: cobertura completa, só um achado baixo |
| `neutro-reprovado.json` | `1`: um achado alto |
| `neutro-nao-rodou.json` | `2`: `coverage_complete: false`, e a lista de achados vazia **não** conta como limpa |
| `sarif.json` | `1`: um achado alto lido do SARIF |
| `roqueshield-bundle.json` | `1`: um achado alto lido do bundle |
| `roqueshield-scanner-falhou.json` | `2`: `scanners_failed` com o Trivy |

```bash
aidlc-scan docs/exemplos/scan/neutro-nao-rodou.json; echo $?
# aidlc-scan  ...  (neutro; scanners: semgrep)
# NAO RODOU: cobertura incompleta: algum scanner nao rodou ou falhou
# 2
```

## 5. Receitas por plataforma

> **Honestidade sobre a verificação.** As receitas abaixo usam o formato de exportação documentado publicamente por cada ferramenta e **não foram executadas neste repositório** (o ambiente de desenvolvimento do kit não tem essas ferramentas instaladas). O leitor de SARIF e do formato neutro é testado com os exemplos da seção anterior; a invocação de cada scanner, não. Confira a flag na versão que você usa.

### Qualquer ferramenta que exporte SARIF

```bash
# exemplo com o Semgrep: a flag de SARIF é --sarif
semgrep scan --config auto --sarif --output reports/seguranca.json .
aidlc-scan reports/seguranca.json --require-scanners semgrep
```

O mesmo vale para outras ferramentas que escrevem SARIF (CodeQL, Trivy com `--format sarif`, entre outras): a única coisa que muda é o comando que gera o arquivo e o nome do scanner em `--require-scanners`, que é o `tool.driver.name` que ela grava.

### Uma plataforma sem SARIF: converter para o neutro

Qualquer JSON vira o formato neutro com algumas linhas. Exemplo com `jq` (testado com um relatório sintético):

```bash
jq '{coverage_complete: .ok, scanners_ran: .tools,
     findings: [.items[] | {key: .id, severity: .level, title: .msg, location: "\(.file):\(.line)"}]}' \
   saida-da-plataforma.json > reports/seguranca.json
aidlc-scan reports/seguranca.json
```

O que **importa** na conversão é o `coverage_complete`: ele precisa vir de um sinal real da plataforma (o scan terminou, nenhum scanner falhou), nunca de um `true` fixo. Um `true` escrito à mão desfaz a única garantia do contrato.

### Trivy embutido (`aidlc-secscan`)

Para CVE de dependência, o kit traz o `aidlc-secscan`, que roda o Trivy e reprova só o que é acionável (em manifesto do projeto, com correção publicada, fora do allowlist com prazo). Sem o `trivy` instalado, a saída é "não rodou", nunca limpo. É um gate à parte, que pode conviver com o `aidlc-scan`.

## 6. CI

O `aidlc-init` gera `.github/workflows/aidlc-gate.yml`, que roda `aidlc-init --check` e `aidlc-gate` no pull request, **sem segredo em PR de fork**, com o kit fixado em `AIDLC_REF`.

Para a varredura, acrescente a geração do relatório **antes** do `aidlc-gate`, para o gate `scan` ter o que ler:

```yaml
      - name: Varredura (gera o relatório que o gate lê)
        run: |
          mkdir -p reports
          semgrep scan --config auto --sarif --output reports/seguranca.json .
      - name: Critério de aceite
        run: node "$RUNNER_TEMP/aidlc/plugins/aidlc-harness/tools/aidlc-gate"
```

O passo de instalar o kit (`git clone` e `checkout` de `AIDLC_REF`) é o do workflow gerado. O `aidlc-gate` coloca a pasta dos executáveis do kit na frente do `PATH` dos comandos dos gates, então um gate `aidlc-scan ...` ou `aidlc-lockcheck` funciona num runner limpo sem instalação à parte.

Duas decisões importantes, que o kit toma por você e vale conhecer:

- **Se o relatório não existir, o gate dá 2** (não rodou) e reprova. Passo de varredura que foi removido do pipeline sem querer não vira verde.
- **Fixe `AIDLC_REF`** numa tag ou commit que você revisou. Apontar para `main` aceitaria, a cada execução, o que quer que tenha sido publicado.

## 7. Ferramentas de IA

| | Instruções | Hooks que bloqueiam | O que cobra o "pronto" |
| --- | --- | --- | --- |
| **Claude Code** | `CLAUDE.md` importa `AGENTS.md` | sim, pelo plugin | hook de `Stop` + CI |
| **Kiro** | `AGENTS.md`, `.kiro/steering/aidlc.md` | não | CI + revisão humana |
| **GitHub Copilot** | `.github/copilot-instructions.md` | não | CI + revisão humana |

Qualquer outra ferramenta que leia `AGENTS.md` já recebe as regras; o que ela não tem é o bloqueio. O contrato é o mesmo: os executáveis `aidlc-*` são programas de linha de comando, então funcionam em qualquer ambiente com Node e `git`. Um adaptador novo (por exemplo, para outra ferramenta com formato próprio de instrução) é uma cópia derivada do `AGENTS.md`; veja [ADAPTADORES.md](ADAPTADORES.md) e [ESTENDER.md](ESTENDER.md).

## 8. O que ainda não existe

Dito aqui para ninguém descobrir em produção:

- **Não há cliente de API de plataforma.** O kit lê arquivo. Chamar a API da sua plataforma, baixar o relatório e guardá-lo em `reports/` é um passo do seu pipeline.
- **Não há servidor MCP nem GitHub Action do kit.** Os executáveis são o contrato.
- **Não há formato para "achado aceito com prazo" no `aidlc-scan`.** Hoje o prazo existe no `aidlc-secscan` (allowlist com `# expira:`); para o `aidlc-scan`, a supressão é da plataforma.
- **Conversão para o neutro é por sua conta**, com a atenção que a seção 5 pede à cobertura.
