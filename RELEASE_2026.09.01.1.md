# Chateauneuf 2026.09.01.1

## Imagens

- `gabrielleite03/chateauneuf-portaria-frontend:2026.09.01.1`
- `gabrielleite03/chateauneuf-auth:2026.09.01.1`
- backend da portaria mantido em `gabrielleite03/chateauneuf-portaria-backend:2026.08.08.2`

## Atualizacao

1. Copie `docker-compose.yml` e `.env.docker.example` para o servidor.
2. Preserve uma copia do `.env.docker` atual.
3. Acrescente ao `.env.docker` as variaveis novas presentes no exemplo.
4. Gere `AUTH_ADMIN_TOKEN` com pelo menos 32 bytes aleatorios.
5. Configure as credenciais reais do Omada e mantenha `OMADA_MOCK=false`.
6. Confirme `OMADA_REVOCATION_PATH` para a versao instalada do Controller.
7. Execute:

   ```sh
   docker compose --env-file .env.docker pull
   docker compose --env-file .env.docker up -d --remove-orphans
   docker compose --env-file .env.docker ps
   ```

## Verificacao

- Abra a portaria e acesse a aba `Internet`.
- Verifique se os moradores existentes aparecem para ativacao.
- Cadastre um funcionario usando a senha administrativa definida em
  `EMPLOYEE_ENROLLMENT_PASSWORD`.
- Verifique os logs com `docker compose --env-file .env.docker logs --tail=100`.

Os dados de autenticacao ficam persistidos em `LOCAL_AUTH_DATA_DIR`, cujo valor
padrao e `./auth-data`. Nao remova essa pasta durante atualizacoes.
