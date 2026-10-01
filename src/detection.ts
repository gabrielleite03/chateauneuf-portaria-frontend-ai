export type Detection = { kind: 'person' | 'plate'; confidence: number; box: { x: number; y: number; width: number; height: number } };
export type Analysis = { channel: number; analyzed_at: string; detections: Detection[] };
export type DetectionSchedule = { channel: number; start: string; end: string; enabled: boolean };
export type SchedulePhase = 'paused' | 'waiting' | 'active' | 'finished';

export function validSchedule(value: unknown): value is DetectionSchedule {
  if (!value || typeof value !== 'object') return false;
  const s = value as DetectionSchedule;
  return Number.isInteger(s.channel) && s.channel >= 1 && s.channel <= 16 && typeof s.enabled === 'boolean'
    && typeof s.start === 'string' && typeof s.end === 'string'
    && Number.isFinite(Date.parse(s.start)) && Date.parse(s.end) > Date.parse(s.start);
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
