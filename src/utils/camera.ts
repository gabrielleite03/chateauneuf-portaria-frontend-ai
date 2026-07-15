export function cameraAccessErrorMessage(error: unknown): string {
  if (!window.isSecureContext) {
    return 'A camera foi bloqueada pelo Chrome porque a pagina nao esta em uma conexao segura. Abra a aplicacao neste computador usando http://localhost:8081. Se estiver acessando por IP ou nome da maquina com http, o Chrome bloqueia a webcam; nesse caso use a instalacao local ou configure HTTPS confiavel.';
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Este navegador nao permite acesso a camera neste endereco. Abra em http://localhost:8081 pelo Chrome ou Edge atualizado.';
  }

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Permissao da camera negada pelo navegador. Clique no icone ao lado do endereco, libere a camera para este site e tente novamente.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'Nenhuma camera foi encontrada neste dispositivo. Verifique se a webcam esta conectada e ativa.';
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'A camera foi encontrada, mas esta ocupada ou indisponivel. Feche outros programas que usam a webcam e tente novamente.';
    }
  }

  return 'Nao foi possivel acessar a webcam. Verifique se o dispositivo possui camera ativa e se as permissoes foram concedidas.';
}
