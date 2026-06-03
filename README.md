# Chateauneuf Portaria Frontend

Frontend local para controle de acesso da portaria.

## Estrutura validada

- Aplicacao Vite + React em `src`.
- Backend local oficial em `D:\Projects\Chateauneuf\chateauneuf-portaria-backend`.
- O frontend chama exclusivamente a API Go via `/api`.
- O mock Express `server.ts` nao faz parte do fluxo validado.

## Rodar localmente

**Prerequisitos:** Node.js e backend Go em execucao.

1. Inicie o backend:

   ```sh
   cd D:\Projects\Chateauneuf\chateauneuf-portaria-backend
   go run ./cmd/api
   ```

2. Inicie o frontend:

   ```sh
   npm install
   npm run dev
   ```

3. Acesse o endereco mostrado pelo Vite.

Por padrao, o proxy do Vite encaminha `/api` para `http://localhost:8080`.
Para mudar, crie `.env.local` baseado em `.env.example`.

## Rodar com Docker

### Instalacao automatica usando DockerHub

No Windows, depois de copiar `docker-compose.yml`, `.env.docker.example` e `chateauneuf-docker-setup.zip` para a pasta da aplicacao:

```powershell
Expand-Archive .\chateauneuf-docker-setup.zip -DestinationPath . -Force

.\scripts\setup-docker.ps1 `
  -GoogleCredentialsFile ".\secrets\google-service-account.json" `
  -GoogleSheetId "ID_DA_PLANILHA" `
  -Up
```

Esse comando faz automaticamente:

- copia/prepara a credencial em `secrets/google-service-account.json`
- cria o arquivo `.env.docker`
- baixa as imagens `gabrielleite03/...:latest` do DockerHub
- sobe os containers com `docker compose up -d --no-build`

No Linux Mint/Ubuntu:

```sh
unzip chateauneuf-docker-setup.zip
chmod +x ./scripts/setup-docker.sh

./scripts/setup-docker.sh \
  --google-credentials-file "./secrets/google-service-account.json" \
  --google-sheet-id "ID_DA_PLANILHA" \
  --up
```

Para somente baixar as imagens sem iniciar:

```powershell
.\scripts\setup-docker.ps1 `
  -GoogleCredentialsFile ".\secrets\google-service-account.json" `
  -GoogleSheetId "ID_DA_PLANILHA" `
  -Pull
```

No Linux:

```sh
./scripts/setup-docker.sh \
  --google-credentials-file "./secrets/google-service-account.json" \
  --google-sheet-id "ID_DA_PLANILHA" \
  --pull
```

### Preparacao automatica

Use o script:

```powershell
.\scripts\setup-docker.ps1 `
  -GoogleCredentialsFile "C:\Users\AdminUser\Downloads\google-service-account.json" `
  -GoogleSheetId "ID_DA_PLANILHA"
```

Para preparar e ja subir os containers:

```powershell
.\scripts\setup-docker.ps1 `
  -GoogleCredentialsFile "C:\Users\AdminUser\Downloads\google-service-account.json" `
  -GoogleSheetId "ID_DA_PLANILHA" `
  -Up
```

O script cria `.env.docker`, copia a credencial para `secrets/google-service-account.json` e configura as portas.

### Preparacao automatica no Linux

No Linux Mint/Ubuntu, use:

```sh
chmod +x ./scripts/setup-docker.sh

./scripts/setup-docker.sh \
  --google-credentials-file "$HOME/Downloads/google-service-account.json" \
  --google-sheet-id "ID_DA_PLANILHA"
```

Para preparar e ja subir os containers:

```sh
./scripts/setup-docker.sh \
  --google-credentials-file "$HOME/Downloads/google-service-account.json" \
  --google-sheet-id "ID_DA_PLANILHA" \
  --up
```

Com imagens publicadas no DockerHub:

```sh
./scripts/setup-docker.sh \
  --google-credentials-file "$HOME/Downloads/google-service-account.json" \
  --google-sheet-id "ID_DA_PLANILHA" \
  --frontend-image "gabrielleite03/chateauneuf-portaria-frontend:latest" \
  --backend-image "gabrielleite03/chateauneuf-portaria-backend:latest" \
  --up
```

### Preparacao manual

1. Copie `.env.docker.example` para `.env.docker` e preencha `GOOGLE_SHEET_ID`.
2. Coloque a credencial do service account em `secrets/google-service-account.json`.
3. Suba a aplicacao:

   ```sh
   docker compose --env-file .env.docker up --build -d
   ```

4. Acesse:

   ```text
   http://localhost:8081
   ```

O frontend usa Nginx e encaminha `/api` para o servico `backend` dentro do Docker Compose.

## Publicar no DockerHub

Defina as imagens no `.env.docker`, por exemplo:

```env
FRONTEND_IMAGE=gabrielleite03/chateauneuf-portaria-frontend:latest
BACKEND_IMAGE=gabrielleite03/chateauneuf-portaria-backend:latest
```

Depois:

```sh
docker compose --env-file .env.docker build
docker compose --env-file .env.docker push
```

## Instalacao na estacao de trabalho

1. Execute o instalador em uma estacao Windows.

   O script verifica se o Docker esta instalado. Se nao estiver, tenta instalar o Docker Desktop usando `winget`.
   Se o Docker Desktop estiver instalado mas parado, o script tenta iniciar e aguarda o engine ficar pronto.

2. Copie para a estacao estes arquivos:

   ```text
   docker-compose.yml
   .env.docker.example
   chateauneuf-docker-setup.zip
   install-workstation.ps1
   install-workstation.cmd
   install-workstation.sh
   instalar-chateauneuf.sh
   ```

3. Execute o instalador unico a partir da pasta onde os arquivos foram copiados:

   ```powershell
   .\install-workstation.ps1 `
     -GoogleSheetId "ID_DA_SUA_PLANILHA"
   ```

   Por padrao, ele usa:

   ```text
   C:\ChateauneufPortaria
   gabrielleite03/chateauneuf-portaria-frontend:latest
   gabrielleite03/chateauneuf-portaria-backend:latest
   http://localhost:8081
   backend exposto em http://localhost:18080
   ```

   Para informar tudo explicitamente:

   ```powershell
   .\install-workstation.ps1 `
     -GoogleSheetId "ID_DA_SUA_PLANILHA" `
     -InstallDir "C:\ChateauneufPortaria" `
     -FrontendImage "gabrielleite03/chateauneuf-portaria-frontend:latest" `
     -BackendImage "gabrielleite03/chateauneuf-portaria-backend:latest"
   ```

   O script cria a pasta, copia `docker-compose.yml`, `.env.docker.example` e `chateauneuf-docker-setup.zip`, extrai o ZIP, configura `.env.docker`, prepara a credencial e sobe os containers.

   Para nao tentar instalar/iniciar Docker automaticamente:

   ```powershell
   .\install-workstation.ps1 `
     -GoogleSheetId "ID_DA_SUA_PLANILHA" `
     -SkipDockerInstall
   ```

4. Acesse a aplicacao:

   ```text
   http://localhost:8081
   ```

5. Verifique se os containers estao rodando:

   ```powershell
   cd C:\ChateauneufPortaria
   docker compose --env-file .env.docker ps
   ```

6. Ver logs:

   ```powershell
   docker compose --env-file .env.docker logs -f
   ```

7. Parar a aplicacao:

   ```powershell
   docker compose --env-file .env.docker down
   ```

8. Subir novamente:

   ```powershell
   docker compose --env-file .env.docker up -d
   ```

### Instalacao manual na estacao

1. Crie uma pasta para a aplicacao:

   ```powershell
   mkdir C:\ChateauneufPortaria
   cd C:\ChateauneufPortaria
   ```

2. Coloque os arquivos nessa pasta e extraia o ZIP:

   ```powershell
   Expand-Archive .\chateauneuf-docker-setup.zip -DestinationPath . -Force
   ```

3. Execute o script de configuracao:

   ```powershell
   .\scripts\setup-docker.ps1 `
     -GoogleCredentialsFile ".\secrets\google-service-account.json" `
     -GoogleSheetId "ID_DA_SUA_PLANILHA" `
     -FrontendImage "gabrielleite03/chateauneuf-portaria-frontend:latest" `
     -BackendImage "gabrielleite03/chateauneuf-portaria-backend:latest" `
     -Up
   ```

   Troque:

   ```text
   ID_DA_SUA_PLANILHA
   gabrielleite03/chateauneuf-portaria-frontend:latest
   gabrielleite03/chateauneuf-portaria-backend:latest
   ```

   pelos valores reais.

4. Acesse a aplicacao:

   ```text
   http://localhost:8081
   ```

5. Verifique se os containers estao rodando:

   ```powershell
   docker compose --env-file .env.docker ps
   ```

6. Ver logs:

   ```powershell
   docker compose --env-file .env.docker logs -f
   ```

7. Parar a aplicacao:

   ```powershell
   docker compose --env-file .env.docker down
   ```

8. Subir novamente:

    ```powershell
    docker compose --env-file .env.docker up -d
    ```

Importante: compartilhe a planilha Google com o e-mail do service account que esta dentro do `google-service-account.json`. Sem isso, a aplicacao roda, mas nao sincroniza com o Sheets.

### Instalacao no Linux Mint

1. Copie para a estacao Linux estes arquivos:

   ```text
   docker-compose.yml
   .env.docker.example
   chateauneuf-docker-setup.zip
   install-workstation.sh
   ```

2. Execute o instalador unico:

   ```sh
   chmod +x ./install-workstation.sh

   ./install-workstation.sh \
     --google-sheet-id "ID_DA_SUA_PLANILHA"
   ```

   Alternativamente, edite `instalar-chateauneuf.sh`, troque `ID_DA_SUA_PLANILHA` pelo ID real e execute:

   ```sh
   chmod +x ./instalar-chateauneuf.sh
   ./instalar-chateauneuf.sh
   ```

   Por padrao, ele usa:

   ```text
   ~/ChateauneufPortaria
   gabrielleite03/chateauneuf-portaria-frontend:latest
   gabrielleite03/chateauneuf-portaria-backend:latest
   http://localhost:8081
   backend exposto em http://localhost:18080
   ```

   O script verifica se Docker existe. Se nao existir em Linux Mint/Ubuntu, tenta instalar Docker Engine via `apt`.
   Se Docker estiver instalado mas parado, tenta iniciar o servico e aguardar ficar pronto.

   Para nao tentar instalar/iniciar Docker automaticamente:

   ```sh
   ./install-workstation.sh \
     --google-sheet-id "ID_DA_SUA_PLANILHA" \
     --skip-docker-install
   ```

3. Acesse:

   ```text
   http://localhost:8081
   ```

### Instalacao manual no Linux Mint

1. Instale Docker e Docker Compose:

   ```sh
   sudo apt update
   sudo apt install -y ca-certificates curl gnupg
   sudo install -m 0755 -d /etc/apt/keyrings
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
   sudo chmod a+r /etc/apt/keyrings/docker.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$UBUNTU_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   sudo apt update
   sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
   ```

2. Permita executar Docker sem `sudo` e entre novamente na sessao:

   ```sh
   sudo usermod -aG docker "$USER"
   newgrp docker
   ```

3. Crie uma pasta para a aplicacao:

   ```sh
   mkdir -p ~/ChateauneufPortaria
   cd ~/ChateauneufPortaria
   ```

4. Copie para essa pasta:

   ```text
   docker-compose.yml
   .env.docker.example
   chateauneuf-docker-setup.zip
   ```

5. Extraia o ZIP:

   ```sh
   unzip chateauneuf-docker-setup.zip
   chmod +x ./scripts/setup-docker.sh
   ```

6. Configure e suba a aplicacao:

   ```sh
   ./scripts/setup-docker.sh \
     --google-credentials-file "./secrets/google-service-account.json" \
     --google-sheet-id "ID_DA_SUA_PLANILHA" \
     --frontend-image "gabrielleite03/chateauneuf-portaria-frontend:latest" \
     --backend-image "gabrielleite03/chateauneuf-portaria-backend:latest" \
     --up
   ```

7. Acesse:

   ```text
   http://localhost:8081
   ```
