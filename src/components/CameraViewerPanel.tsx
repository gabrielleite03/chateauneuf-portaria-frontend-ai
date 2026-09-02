import { useEffect, useMemo, useState } from 'react';
import { Camera, ChevronDown, Expand, MonitorPlay, X } from 'lucide-react';

type CameraChannel = {
  id: string;
  label: string;
  url: string;
};

const STREAM_API_BASE = 'http://localhost:18082';

const cameraChannels: CameraChannel[] = [
  { id: '3', label: 'Rampa', url: `${STREAM_API_BASE}/api/camera/frame?channel=3` },
  { id: '1', label: 'Lateral Venezas', url: `${STREAM_API_BASE}/api/camera/frame?channel=1` },
  { id: '2', label: 'Lixeiras', url: `${STREAM_API_BASE}/api/camera/frame?channel=2` },
  { id: '4', label: 'Portão Serviço', url: `${STREAM_API_BASE}/api/camera/frame?channel=4` },
  { id: '5', label: 'Calçada', url: `${STREAM_API_BASE}/api/camera/frame?channel=5` },
  { id: '6', label: 'Portão Social', url: `${STREAM_API_BASE}/api/camera/frame?channel=6` },
  { id: '7', label: 'Entrada Serviço', url: `${STREAM_API_BASE}/api/camera/frame?channel=7` },
  { id: '8', label: 'Portão Garagem', url: `${STREAM_API_BASE}/api/camera/frame?channel=8` },
  { id: '9', label: 'Elevador Serviço', url: `${STREAM_API_BASE}/api/camera/frame?channel=9` },
  { id: '10', label: 'Hall da Entrada', url: `${STREAM_API_BASE}/api/camera/frame?channel=10` },
  { id: '11', label: 'Elevador social', url: `${STREAM_API_BASE}/api/camera/frame?channel=11` },
  { id: '12', label: 'Guarita', url: `${STREAM_API_BASE}/api/camera/frame?channel=12` },
  { id: '13', label: 'Parquinho', url: `${STREAM_API_BASE}/api/camera/frame?channel=13` },
  { id: '14', label: 'Piscina', url: `${STREAM_API_BASE}/api/camera/frame?channel=14` },
  { id: '15', label: 'Garagem S1', url: `${STREAM_API_BASE}/api/camera/frame?channel=15` },
  { id: '16', label: 'Garagem S2', url: `${STREAM_API_BASE}/api/camera/frame?channel=16` },
];

export default function CameraViewerPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isChannelMenuOpen, setIsChannelMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(cameraChannels[0].id);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [displaySrc, setDisplaySrc] = useState('');

  const selectedCamera = useMemo(
    () => cameraChannels.find(channel => channel.id === selectedChannel) ?? cameraChannels[0],
    [selectedChannel],
  );

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const loadFrame = () => {
      const nextUrl = `${selectedCamera.url}?ts=${Date.now()}`;
      const image = new Image();

      image.onload = () => {
        if (cancelled) return;
        setDisplaySrc(nextUrl);
        setHasError(false);
        setIsLoading(false);
      };

      image.onerror = () => {
        if (cancelled) return;
        setHasError(true);
        setIsLoading(false);
      };

      image.src = nextUrl;
    };

    loadFrame();
    const timer = window.setInterval(loadFrame, 800);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isOpen, selectedCamera]);

  const handleChannelChange = (channelId: string) => {
    setSelectedChannel(channelId);
    setIsChannelMenuOpen(false);
  };

  const handleToggleFullscreen = () => {
    if (!displaySrc) return;
    setIsFullscreen(prev => !prev);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-full border border-emerald-500/40 bg-[#0a0d14]/95 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.24em] text-emerald-400 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl transition hover:scale-[1.02] active:scale-95 cursor-pointer"
        aria-label={isOpen ? 'Ocultar câmera' : 'Abrir câmera'}
      >
        <MonitorPlay size={16} className="shrink-0" />
        <span>{isOpen ? 'Ocultar' : 'Câmera'}</span>
      </button>

      {isOpen && (
        <div
          className={
            isFullscreen
              ? 'fixed inset-0 z-[60] overflow-hidden bg-slate-950/95 p-2 backdrop-blur-xl sm:p-3'
              : 'fixed bottom-20 right-0 z-40 w-[min(94vw,620px)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-t-xl border border-slate-200 bg-white/95 text-slate-800 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:right-5 sm:rounded-xl'
          }
        >
          <div className={`flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-3 py-2.5 sm:px-4 sm:py-3 ${isFullscreen ? 'border-slate-800 bg-slate-900/80 text-white' : ''}`}>
            <div className={`flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.22em] sm:text-[10px] ${isFullscreen ? 'text-emerald-300' : 'text-emerald-700'}`}>
              <Camera size={14} />
              Visualização
            </div>
            <div className="flex items-center gap-2">
              {isFullscreen && (
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="rounded-md border border-slate-700 bg-slate-900/80 p-1.5 text-slate-200 transition hover:border-slate-500 hover:text-white cursor-pointer"
                  aria-label="Fechar tela cheia"
                >
                  <X size={13} />
                </button>
              )}
              {!isFullscreen && (
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 cursor-pointer"
                  aria-label="Fechar visão da câmera"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4 p-3 sm:p-4">
            <div className="relative space-y-2">
              <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-slate-500 sm:text-[10px]">Canais</span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsChannelMenuOpen(prev => !prev)}
                  className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-800 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition duration-200 hover:border-emerald-300 hover:shadow-[0_0_0_1px_rgba(16,185,129,0.12)] focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]" />
                    {selectedCamera.label}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${isChannelMenuOpen ? 'rotate-180 text-emerald-600' : ''}`}
                  />
                </button>

                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300/70"
                  aria-label={isFullscreen ? 'Sair da tela cheia' : 'Abrir tela cheia'}
                >
                  <Expand size={16} />
                </button>
              </div>

              {isChannelMenuOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-10 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] ring-1 ring-slate-100">
                  {cameraChannels.map(channel => {
                    const isSelected = selectedChannel === channel.id;

                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => handleChannelChange(channel.id)}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                          isSelected
                            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span>{channel.label}</span>
                        {isSelected && <span className="text-[9px] font-mono uppercase tracking-[0.18em] text-emerald-600">Atual</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={`overflow-hidden rounded-lg border ${isFullscreen ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-100'}`}>
              {isLoading && (
                <div className={`flex items-center justify-center text-[10px] font-mono uppercase tracking-[0.2em] ${isFullscreen ? 'h-[calc(100vh-120px)] bg-slate-900 text-slate-400' : 'h-[360px] bg-slate-100 text-slate-500 sm:h-[420px]'}`}>
                  Carregando...
                </div>
              )}

              {!isLoading && hasError && (
                <div className={`flex flex-col items-center justify-center gap-2 px-4 text-center ${isFullscreen ? 'h-[calc(100vh-120px)] bg-slate-900 text-slate-200' : 'h-[360px] bg-slate-100 text-slate-700 sm:h-[420px]'}`}>
                  <Camera size={24} className="text-amber-500" />
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-600">Câmera indisponível</p>
                  <p className={`text-xs ${isFullscreen ? 'text-slate-300' : 'text-slate-600'}`}>O serviço de stream não respondeu para {selectedCamera.label}.</p>
                </div>
              )}

              {!isLoading && !hasError && displaySrc && (
                <img
                  src={displaySrc}
                  alt={selectedCamera.label}
                  className={`${isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-[360px] sm:h-[420px]'} w-full object-contain bg-slate-950`}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
