# Teste: o que "pronto" quer dizer

Código novo nasce com o teste ao lado, no mesmo diff. Teste que nunca reprovou não prova nada: antes de declarar um teste ou um check pronto, quebre o código de propósito (teste de mutação) e confirme que a suíte fica vermelha. `aidlc-mutation` faz isso de forma mecânica.

Evidência é a saída crua do comando, colada no chat, com o que foi medido e quando. Resumo da saída não vale: é o resumo que esconde o teste pulado.

Quem executa esta regra: o gate `test` do manifesto da tecnologia (comando e rejeição por padrão de saída) e o hook de Stop `dod-check`, que recusa o encerramento sem a evidência.
