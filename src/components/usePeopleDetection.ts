import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeCamera, Analysis, DetectionSchedule, schedulePhase, restoreSchedule, nextCamera, enqueueAlert } from '../detection';
import { cameraName } from '../cameras';

const STORAGE_KEY = 'chateauneuf.people-detection.schedule.v1';

function readSchedule(): DetectionSchedule | null {
  try { return restoreSchedule(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); } catch { return null; }
}

export default function usePeopleDetection() {
  const [schedule, setSchedule] = useState<DetectionSchedule | null>(readSchedule);
  const [phase, setPhase] = useState(() => schedulePhase(schedule));
  const [busyChannel, setBusyChannel] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [results, setResults] = useState<Record<number, Analysis>>({});
  const [storageError, setStorageError] = useState('');
  const [lastResult, setLastResult] = useState<Analysis | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [alerts, setAlerts] = useState<Analysis[]>([]);
  const request = useRef<AbortController | null>(null);
  const latestSchedule = useRef(schedule);
  const lastAttempt = useRef<Record<number, number>>({});
  const lastAlert = useRef<Record<number, number>>({});

  const saveSchedule = useCallback((value: DetectionSchedule | null) => {
    request.current?.abort(); request.current = null; setBusyChannel(null);
    latestSchedule.current = value; lastAttempt.current = {}; setSchedule(value); setPhase(schedulePhase(value)); setErrors({});
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); setStorageError(''); }
    catch { setStorageError('Não foi possível salvar neste navegador. O agendamento será perdido ao recarregar.'); }
  }, []);

  const run = useCallback(async (channel: number, scheduled = false) => {
    if (request.current) return;
    const controller = new AbortController(); request.current = controller;
    lastAttempt.current[channel] = Date.now(); setBusyChannel(channel);
    const timeout = window.setTimeout(() => controller.abort(), 35_000);
    try {
      const result = await analyzeCamera(channel, controller.signal);
      if (request.current !== controller) return;
      if (scheduled && schedulePhase(latestSchedule.current) !== 'active') return;
      setLastResult(result);
      setResults(previous => ({ ...previous, [channel]: result }));
      setErrors(previous => { const next = { ...previous }; delete next[channel]; return next; });
      const people = result.detections.filter(d => d.kind === 'person');
      if (people.length) {
        setHistory(rows => [result, ...rows].slice(0, 30));
        if (!scheduled || Date.now() - (lastAlert.current[channel] ?? 0) >= 60_000) {
          lastAlert.current[channel] = Date.now(); setAlerts(queue => enqueueAlert(queue, result));
        }
      }
    } catch (err) {
      if (request.current === controller) setErrors(previous => ({ ...previous, [channel]: controller.signal.aborted ? 'A análise excedeu o tempo de espera.' : err instanceof Error ? err.message : 'Falha na análise.' }));
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setBusyChannel(null); }
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      const time = Date.now();
      const current = latestSchedule.current;
      setPhase(schedulePhase(current, time));
      if (current && schedulePhase(current, time) === 'active' && !request.current) {
        const channel = nextCamera(current.channels, lastAttempt.current, time);
        if (channel !== undefined) void run(channel, true);
      }
    };
    tick(); const timer = window.setInterval(tick, 1000);
    return () => { window.clearInterval(timer); request.current?.abort(); request.current = null; };
  }, [run]);

  const error = Object.entries(errors).map(([channel, message]) => `${cameraName(Number(channel))}: ${message}`).join(' ');
  return { schedule, saveSchedule, phase, busy: busyChannel !== null, busyChannel, error, errors, results, storageError, lastResult, history, alert: alerts[0] ?? null, pendingAlerts: alerts.length, dismissAlert: () => setAlerts(queue => queue.slice(1)), run };
}

export type PeopleDetectionController = ReturnType<typeof usePeopleDetection>;
