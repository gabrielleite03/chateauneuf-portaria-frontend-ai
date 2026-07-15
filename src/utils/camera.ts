type FacingMode = 'user' | 'environment';

const retryableCameraErrors = new Set([
  'AbortError',
  'NotReadableError',
  'OverconstrainedError',
  'TrackStartError',
]);

export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach(track => track.stop());
}

export async function openCameraStream(facingMode: FacingMode = 'user'): Promise<MediaStream> {
  const constraints: MediaStreamConstraints[] = [
    {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: { ideal: facingMode },
      },
    },
    {
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: { ideal: facingMode },
      },
    },
    {
      video: {
        width: { ideal: 320 },
        height: { ideal: 240 },
      },
    },
    { video: true },
  ];

  let lastError: unknown;

  for (const constraint of constraints) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraint);
    } catch (error) {
      lastError = error;
      if (!(error instanceof DOMException) || !retryableCameraErrors.has(error.name)) {
        throw error;
      }
      await new Promise(resolve => window.setTimeout(resolve, 250));
    }
  }

  throw lastError;
}

export function cameraAccessErrorMessage(error: unknown): string {
  if (!window.isSecureContext) {
    return 'A camera foi bloqueada pelo Chrome porque a pagina nao esta em uma conexao segura. Abra a aplicacao neste computador usando https://localhost:8443.';
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Este navegador nao permite acesso a camera neste endereco. Abra em https://localhost:8443 pelo Chrome ou Edge atualizado.';
  }

  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Permissao da camera negada pelo navegador. Clique no icone ao lado do endereco, libere a camera para este site e tente novamente.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'Nenhuma camera foi encontrada neste dispositivo. Verifique se a webcam esta conectada e ativa.';
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return 'A camera foi encontrada, mas esta ocupada ou indisponivel. Feche outros programas que usam a webcam, feche outras abas da portaria, recarregue a pagina e tente novamente.';
    }
    if (error.name === 'AbortError') {
      return 'A camera respondeu, mas o navegador interrompeu a inicializacao. Recarregue a pagina e tente novamente.';
    }
    if (error.name === 'OverconstrainedError') {
      return 'A camera nao aceitou a resolucao solicitada. Recarregue a pagina e tente novamente.';
    }
  }

  return 'Nao foi possivel acessar a webcam. Verifique se o dispositivo possui camera ativa e se as permissoes foram concedidas.';
}
