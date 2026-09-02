import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, Expand, MonitorPlay, X } from 'lucide-react';

type CameraChannel = {
  id: string;
  label: string;
  url: string;
};

const STREAM_API_BASE = '/stream-api';

const cameraChannels: CameraChannel[] = [
  { id: '3', label: 'Rampa', url: `${STREAM_API_BASE}/api/camera/live?channel=3` },
  { id: '1', label: 'Lateral Venezas', url: `${STREAM_API_BASE}/api/camera/live?channel=1` },
  { id: '2', label: 'Lixeiras', url: `${STREAM_API_BASE}/api/camera/live?channel=2` },
  { id: '4', label: 'Portão Serviço', url: `${STREAM_API_BASE}/api/camera/live?channel=4` },
  { id: '5', label: 'Calçada', url: `${STREAM_API_BASE}/api/camera/live?channel=5` },
  { id: '6', label: 'Portão Social', url: `${STREAM_API_BASE}/api/camera/live?channel=6` },
  { id: '7', label: 'Entrada Serviço', url: `${STREAM_API_BASE}/api/camera/live?channel=7` },
  { id: '8', label: 'Portão Garagem', url: `${STREAM_API_BASE}/api/camera/live?channel=8` },
  { id: '9', label: 'Elevador Serviço', url: `${STREAM_API_BASE}/api/camera/live?channel=9` },
  { id: '10', label: 'Hall da Entrada', url: `${STREAM_API_BASE}/api/camera/live?channel=10` },
  { id: '11', label: 'Elevador social', url: `${STREAM_API_BASE}/api/camera/live?channel=11` },
  { id: '12', label: 'Guarita', url: `${STREAM_API_BASE}/api/camera/live?channel=12` },
  { id: '13', label: 'Parquinho', url: `${STREAM_API_BASE}/api/camera/live?channel=13` },
  { id: '14', label: 'Piscina', url: `${STREAM_API_BASE}/api/camera/live?channel=14` },
  { id: '15', label: 'Garagem S1', url: `${STREAM_API_BASE}/api/camera/live?channel=15` },
  { id: '16', label: 'Garagem S2', url: `${STREAM_API_BASE}/api/camera/live?channel=16` },
];

export default function CameraViewerPanel() {
  const videoContainerRef = useRef<HTMLDivElement>(null);
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

    setIsLoading(true);
    setHasError(false);
    setDisplaySrc(`${selectedCamera.url}&ts=${Date.now()}`);
  }, [isOpen, selectedCamera]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === videoContainerRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleChannelChange = (channelId: string) => {
    setSelectedChannel(channelId);
    setIsChannelMenuOpen(false);
  };

  const handleToggleFullscreen = async () => {
    if (!displaySrc) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await videoContainerRef.current?.requestFullscreen();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="fixed bottom-5 left-5 z-50 flex items-center gap-3 rounded-full border border-emerald-500/40 bg-[#0a0d14]/95 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.24em] text-emerald-400 shadow-2xl shadow-emerald-950/30 backdrop-blur-xl transition hover:scale-[1.02] active:scale-95 cursor-pointer"
        aria-label={isOpen ? 'Ocultar câmera' : 'Abrir câmera'}
      >
        <MonitorPlay size={16} className="shrink-0" />
        <span>{isOpen ? 'Ocultar' : 'Câmera'}</span>
      </button>

      {isOpen && (
        <div className="fixed bottom-20 left-0 z-40 w-[min(94vw,620px)] max-w-[calc(100vw-1rem)] overflow-hidden rounded-t-xl border border-slate-200 bg-white/95 text-slate-800 shadow-[0_20px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:left-5 sm:rounded-xl">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[0.22em] text-emerald-700 sm:text-[10px]">
              <Camera size={14} />
              Visualização
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:border-slate-300 hover:text-slate-900 cursor-pointer"
                aria-label="Fechar visão da câmera"
              >
                <X size={13} />
              </button>
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
                <div className="absolute left-0 right-0 top-[calc(100%+0.55rem)] z-30 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.12)] ring-1 ring-slate-100">
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

            <div
              ref={videoContainerRef}
              className={`relative overflow-hidden bg-slate-950 ${isFullscreen ? 'h-screen w-screen' : 'h-[360px] rounded-lg border border-slate-200 sm:h-[420px]'}`}
            >
              {isFullscreen && (
                <button
                  type="button"
                  onClick={handleToggleFullscreen}
                  className="absolute right-3 top-3 z-20 rounded-md border border-slate-700 bg-slate-900/80 p-2 text-slate-200 transition hover:border-slate-500 hover:text-white cursor-pointer"
                  aria-label="Sair da tela cheia"
                >
                  <X size={18} />
                </button>
              )}
              {isLoading && (
                <div className={`absolute inset-0 z-10 flex items-center justify-center text-[10px] font-mono uppercase tracking-[0.2em] ${isFullscreen ? 'bg-slate-900 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                  Carregando...
                </div>
              )}

              {!isLoading && hasError && (
                <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-4 text-center ${isFullscreen ? 'bg-slate-900 text-slate-200' : 'bg-slate-100 text-slate-700'}`}>
                  <Camera size={24} className="text-amber-500" />
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-amber-600">Câmera indisponível</p>
                  <p className={`text-xs ${isFullscreen ? 'text-slate-300' : 'text-slate-600'}`}>O serviço de stream não respondeu para {selectedCamera.label}.</p>
                </div>
              )}

              {!hasError && displaySrc && (
                <img
                  src={displaySrc}
                  alt={selectedCamera.label}
                  onLoad={() => setIsLoading(false)}
                  onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                  className="h-full w-full bg-slate-950 object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
