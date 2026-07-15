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

export async function resizeImageDataUrl(dataUrl: string, maxBytes = 350000): Promise<string> {
  const image = await loadImage(dataUrl);
  const maxSides = [900, 720, 560, 420];
  const qualities = [0.78, 0.68, 0.58, 0.48];
  let lastCandidate = dataUrl;

  for (const maxSide of maxSides) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    for (const quality of qualities) {
      const resized = canvas.toDataURL('image/jpeg', quality);
      lastCandidate = resized;
      if (resized.length <= maxBytes) {
        return resized;
      }
    }
  }

  return lastCandidate;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image load failed'));
    image.src = dataUrl;
  });
}
