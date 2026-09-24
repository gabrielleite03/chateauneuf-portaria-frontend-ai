# Deploy da portaria

`deploy.py` atualiza somente o frontend e o backend usando um manifesto versionado
em `releases/<versao>/release.json`. Execute no servidor Linux com Python 3,
Docker Compose e acesso ao banco SQLite da portaria.

Antes do deploy, publique os commits e imagens e registre no manifesto a versao,
os commits, as tags das imagens e seus digests completos. Baixe ambas as imagens
no servidor com `docker pull <imagem>:<versao>`.

O manifesto pode incluir `checks.frontend_markers` (textos esperados no bundle)
e `checks.resident_vehicles: true` para validar a API de veiculos de cada apartamento.
`checks.inventory: true` valida a API de estoque, os saldos contra as movimentacoes,
os totais das compras e o responsavel de cada saida, sem criar registros de teste.

Confira o ambiente sem alterar arquivos ou containers:

```sh
python3 scripts/deploy/deploy.py \
  --manifest releases/2026.09.22.1/release.json \
  --project /home/chateauneuf/ChateauneufPortaria \
  --release-dir /home/chateauneuf/releases/2026.09.22.1 \
  --check-only
```

Para aplicar a versao, execute o mesmo comando sem `--check-only`.
O parametro opcional `--base-url` tem valor padrao `http://127.0.0.1:8081`.
O banco esperado fica em `<project>/data/portaria.db`.

Se a API nao iniciar apos uma tentativa de deploy, `--baseline-backup` pode
apontar para um backup existente em `<project>/backups/before-<versao>`.
Nesse modo, a comparacao dos registros usa os arquivos `access-logs.json` e
`reservations.json` daquele backup. O script ainda cria um novo backup do banco
atual antes de aplicar as imagens corrigidas e executa todas as validacoes finais.
Esse parametro nao restaura o banco nem descarta registros.

O script verifica os digests locais, cria um backup consistente do SQLite e das
configuracoes em `<project>/backups/before-<versao>` e atualiza as imagens no
`.env.docker`. A existencia desse backup impede repetir a mesma operacao.
O arquivo `docker-compose.override.yml` e opcional.

A validacao verifica versao e commit do backend, identificacao do frontend,
conclusao da importacao inicial, preservacao dos registros de acesso e reservas,
sincronizacao das reservas e resposta da API de convidados. Ela exige que a
integracao de sincronizacao esteja disponivel. Se falhar, o script restaura o
`.env.docker` e reinicia as imagens anteriores; o banco nao e restaurado
automaticamente, para evitar perder registros criados durante o deploy.
As migracoes devem ser compativeis com as imagens anteriores para esse rollback.

O relatorio `deployment-report.json` fica em `--release-dir`. Backups, bancos,
relatorios operacionais e arquivos de imagens permanecem fora do Git. O manifesto
da versao e o script sao os arquivos versionados.
