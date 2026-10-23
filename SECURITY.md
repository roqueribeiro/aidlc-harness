# Segurança

## Como reportar

**Não abra issue pública** para falha de segurança. Use o relato privado do GitHub: aba *Security* do repositório, *Report a vulnerability*. Se isso não estiver disponível, escreva para **contato@levelhard.com.br** com o assunto "aidlc-harness: segurança".

Inclua o que for possível: versão ou commit, passos para reproduzir, o efeito, e se há exposição de dado. Você receberá uma confirmação de recebimento; este é um projeto mantido por voluntários, então não prometemos prazo de correção, mas tratamos relato de segurança antes de qualquer outra coisa.

## O que está no escopo

O kit executa código na máquina de quem o usa (hooks, executáveis, scripts), então os relatos que mais importam são:

- um hook ou executável que **executa comando arbitrário** a partir de entrada controlada por terceiro (nome de arquivo, conteúdo de repositório, mensagem de commit, saída de ferramenta);
- **vazamento de segredo**: o `secret-guard` ou o `aidlc-secrets` imprimindo, gravando ou registrando um valor;
- **contorno** de um controle que o kit promete: `aidlc-phase` aceitando uma aprovação de IA, `aidlc-identity` deixando passar um formato que ele diz pegar, `aidlc-init --check` aprovando cópias divergentes;
- escrita ou remoção de arquivo **fora** do projeto (`setup`, `aidlc-limpeza`, `aidlc-init`, `install-git-hooks`);
- o workflow de CI gerado (`aidlc-gate.yml`) permitindo que código de um fork alcance segredo ou escrita.

## O que está fora do escopo

- Limitações já documentadas em "Limites conhecidos" do README e em `docs/ADAPTADORES.md` (por exemplo, hooks só existirem no Claude Code).
- Falhas nas ferramentas de IA que o kit orquestra (Claude Code, Kiro, Copilot): reporte ao fornecedor.
- O scanner de identidade não achar um **nome** que não esteja na sua lista de termos: ele acha formatos, e isso é dito na própria saída.

## Versões suportadas

Enquanto o projeto estiver na série 0.x, só a versão mais recente recebe correção.

## Proteções que o projeto adota

- Sem dependências de execução: não há `node_modules` para envenenar.
- O CI do kit e o modelo de CI que ele gera rodam em `pull_request`, nunca em `pull_request_target`, e com permissão de leitura.
- O modelo de CI fixa a versão do kit numa tag; não use `main`.
