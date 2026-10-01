import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeCamera, Analysis, DetectionSchedule, schedulePhase, validSchedule } from '../detection';

const STORAGE_KEY = 'chateauneuf.people-detection.schedule.v1';
const INTERVAL = 15_000;

function readSchedule(): DetectionSchedule | null {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'); return validSchedule(value) ? value : null; } catch { return null; }
}

export default function usePeopleDetection() {
  const [schedule, setSchedule] = useState<DetectionSchedule | null>(readSchedule);
  const [phase, setPhase] = useState(() => schedulePhase(schedule));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [lastResult, setLastResult] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [alert, setAlert] = useState<Analysis | null>(null);
  const request = useRef<AbortController | null>(null);
  const latestSchedule = useRef(schedule);
  const lastAttempt = useRef(0);
  const lastAlert = useRef<Record<number, number>>({});

  const saveSchedule = useCallback((value: DetectionSchedule | null) => {
    request.current?.abort(); request.current = null; setBusy(false);
    latestSchedule.current = value; lastAttempt.current = 0; setSchedule(value); setPhase(schedulePhase(value)); setError('');
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); setStorageError(''); }
    catch { setStorageError('Não foi possível salvar neste navegador. O agendamento será perdido ao recarregar.'); }
  }, []);

  const run = useCallback(async (channel: number, scheduled = false) => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    lastAttempt.current = Date.now(); setBusy(true); setError('');
    const timeout = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const result = await analyzeCamera(channel, controller.signal);
      if (request.current !== controller) return;
      if (scheduled && schedulePhase(latestSchedule.current) !== 'active') return;
      setLastResult(result);
      const people = result.detections.filter(d => d.kind === 'person');
      if (people.length) {
        setHistory(rows => [result, ...rows].slice(0, 30));
        if (!scheduled || Date.now() - (lastAlert.current[channel] ?? 0) >= 60_000) {
          lastAlert.current[channel] = Date.now(); setAlert(result);
        }
      }
    } catch (err) {
      if (request.current === controller) setError(controller.signal.aborted ? 'A análise excedeu o tempo de espera.' : err instanceof Error ? err.message : 'Falha na análise.');
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      const time = Date.now();
      const current = latestSchedule.current;
      setPhase(schedulePhase(current, time));
      if (current && schedulePhase(current, time) === 'active' && time - lastAttempt.current >= INTERVAL) void run(current.channel, true);
    };
    tick(); const timer = window.setInterval(tick, 1000);
    return () => { window.clearInterval(timer); request.current?.abort(); request.current = null; };
  }, [run]);

  return { schedule, saveSchedule, phase, busy, error, storageError, lastResult, history, alert, dismissAlert: () => setAlert(null), run };
}

export type PeopleDetectionController = ReturnType<typeof usePeopleDetection>;
