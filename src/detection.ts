export type Detection = { kind: 'person' | 'plate'; confidence: number; box: { x: number; y: number; width: number; height: number } };
export type Analysis = { channel: number; analyzed_at: string; detections: Detection[] };
export type DetectionSchedule = { channels: number[]; start: string; end: string; enabled: boolean };
export type SchedulePhase = 'paused' | 'waiting' | 'active' | 'finished';

export function validSchedule(value: unknown): value is DetectionSchedule {
  if (!value || typeof value !== 'object') return false;
  const s = value as DetectionSchedule;
  return Array.isArray(s.channels) && s.channels.length > 0 && s.channels.length <= 16
    && s.channels.every(channel => Number.isInteger(channel) && channel >= 1 && channel <= 16)
    && new Set(s.channels).size === s.channels.length && typeof s.enabled === 'boolean'
    && typeof s.start === 'string' && typeof s.end === 'string'
    && Number.isFinite(Date.parse(s.start)) && Date.parse(s.end) > Date.parse(s.start);
}

// Preserve schedules saved before multi-camera selection was introduced.
export function restoreSchedule(value: unknown): DetectionSchedule | null {
  if (validSchedule(value)) return value;
  if (!value || typeof value !== 'object' || 'channels' in value) return null;
  const old = value as Record<string, unknown>;
  const migrated = { channels: [old.channel], start: old.start, end: old.end, enabled: old.enabled };
  return validSchedule(migrated) ? migrated : null;
}

// Oldest attempted camera first: slow/failed cameras never starve their peers.
export function nextCamera(channels: number[], attempts: Record<number, number>, now: number): number | undefined {
  return channels.filter(channel => attempts[channel] === undefined || now - attempts[channel] >= 15_000)
    .sort((a, b) => (attempts[a] ?? -Infinity) - (attempts[b] ?? -Infinity))[0];
}

export function enqueueAlert(queue: Analysis[], result: Analysis): Analysis[] {
  const existing = queue.findIndex(item => item.channel === result.channel);
  if (existing >= 0) return queue.map((item, index) => index === existing ? result : item);
  return [...queue, result].slice(-16);
}

export function schedulePhase(schedule: DetectionSchedule | null, now = Date.now()): SchedulePhase {
  if (!schedule?.enabled) return 'paused';
  if (now >= Date.parse(schedule.end)) return 'finished';
  return now < Date.parse(schedule.start) ? 'waiting' : 'active';
}

export async function analyzeCamera(channel: number, signal: AbortSignal): Promise<Analysis> {
  const response = await fetch('/analyzer-api/api/analysis', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel }), signal,
  });
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'A conexão com o analisador precisa ser configurada pelo administrador.',
      429: 'Analisador ocupado. Aguarde a próxima verificação.',
      502: 'Não foi possível analisar a câmera. Verifique o stream e o motor de detecção.',
      503: 'O motor de detecção está indisponível.',
      504: 'A análise excedeu o tempo de espera.',
    };
    throw new Error(messages[response.status] ?? 'Não foi possível concluir a análise.');
  }
  const result = await response.json() as Analysis;
  if (result.channel !== channel || !Number.isFinite(Date.parse(result.analyzed_at)) || !Array.isArray(result.detections)
    || result.detections.some(d => !d || !['person', 'plate'].includes(d.kind) || !Number.isFinite(d.confidence) || d.confidence < 0 || d.confidence > 1)) {
    throw new Error('O analisador retornou uma resposta inválida.');
  }
  return result;
}
