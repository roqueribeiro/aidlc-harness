# Security

## How to report

**Do not open a public issue** for a security flaw. Use GitHub's private reporting: the repository's *Security* tab, *Report a vulnerability*. If that is not available, write to **contato@levelhard.com.br** with the subject "aidlc-harness: security".

Include whatever you can: version or commit, steps to reproduce, the effect, and whether data is exposed. You will get an acknowledgment of receipt; this is a volunteer-maintained project, so we do not promise a fix deadline, but we handle security reports before anything else.

## What is in scope

The kit runs code on the machine of whoever uses it (hooks, executables, scripts), so the reports that matter most are:

- a hook or executable that **runs an arbitrary command** from third-party-controlled input (file name, repository content, commit message, tool output);
- **secret leakage**: `secret-guard` or `aidlc-secrets` printing, writing or logging a value;
- **bypass** of a control the kit promises: `aidlc-phase` accepting an AI approval, `aidlc-identity` letting through a format it says it catches, `aidlc-init --check` approving diverging copies;
- writing or removing files **outside** the project (`setup`, `aidlc-limpeza`, `aidlc-init`, `install-git-hooks`);
- the generated CI workflow (`aidlc-gate.yml`) letting code from a fork reach a secret or write access.

## What is out of scope

- Limitations already documented in the README's "Known limits" section and in [`docs/ADAPTERS.md`](docs/ADAPTERS.md) (for example, hooks existing only in Claude Code).
- Flaws in the AI tools the kit orchestrates (Claude Code, Kiro, Copilot): report them to the vendor.
- The identity scanner not finding a **name** that is not in your term list: it finds formats, and the output itself says so.

## Supported versions

While the project is in the 0.x series, only the latest version receives fixes.

## Protections the project adopts

- No runtime dependencies: there is no `node_modules` to poison.
- The kit's CI and the CI template it generates run on `pull_request`, never on `pull_request_target`, and with read permission.
- The CI template pins the kit version to a tag; do not use `main`.

---

## Português

*Tradução do texto em inglês acima. Se divergirem, vale o inglês.*

### Como reportar

**Não abra issue pública** para falha de segurança. Use o relato privado do GitHub: aba *Security* do repositório, *Report a vulnerability*. Se isso não estiver disponível, escreva para **contato@levelhard.com.br** com o assunto "aidlc-harness: segurança".

Inclua o que for possível: versão ou commit, passos para reproduzir, o efeito, e se há exposição de dado. Você receberá uma confirmação de recebimento; este é um projeto mantido por voluntários, então não prometemos prazo de correção, mas tratamos relato de segurança antes de qualquer outra coisa.

### O que está no escopo

O kit executa código na máquina de quem o usa (hooks, executáveis, scripts), então os relatos que mais importam são:

- um hook ou executável que **executa comando arbitrário** a partir de entrada controlada por terceiro (nome de arquivo, conteúdo de repositório, mensagem de commit, saída de ferramenta);
- **vazamento de segredo**: o `secret-guard` ou o `aidlc-secrets` imprimindo, gravando ou registrando um valor;
- **contorno** de um controle que o kit promete: `aidlc-phase` aceitando uma aprovação de IA, `aidlc-identity` deixando passar um formato que ele diz pegar, `aidlc-init --check` aprovando cópias divergentes;
- escrita ou remoção de arquivo **fora** do projeto (`setup`, `aidlc-limpeza`, `aidlc-init`, `install-git-hooks`);
- o workflow de CI gerado (`aidlc-gate.yml`) permitindo que código de um fork alcance segredo ou escrita.

### O que está fora do escopo

- Limitações já documentadas em "Limites conhecidos" do [README em português](README.pt-BR.md) e em [`docs/pt-BR/ADAPTADORES.md`](docs/pt-BR/ADAPTADORES.md) (por exemplo, hooks só existirem no Claude Code).
- Falhas nas ferramentas de IA que o kit orquestra (Claude Code, Kiro, Copilot): reporte ao fornecedor.
- O scanner de identidade não achar um **nome** que não esteja na sua lista de termos: ele acha formatos, e isso é dito na própria saída.

### Versões suportadas

Enquanto o projeto estiver na série 0.x, só a versão mais recente recebe correção.

### Proteções que o projeto adota

- Sem dependências de execução: não há `node_modules` para envenenar.
- O CI do kit e o modelo de CI que ele gera rodam em `pull_request`, nunca em `pull_request_target`, e com permissão de leitura.
- O modelo de CI fixa a versão do kit numa tag; não use `main`.
