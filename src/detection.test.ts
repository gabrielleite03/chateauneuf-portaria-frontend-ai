import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCamera, schedulePhase, validSchedule } from './detection.ts';

const schedule = { channel: 12, start: '2026-10-01T23:00:00-03:00', end: '2026-10-02T01:00:00-03:00', enabled: true };
test('schedule crosses midnight and stops at the exact end', () => {
  assert.equal(schedulePhase(schedule, Date.parse('2026-10-01T22:59:59-03:00')), 'waiting');
  assert.equal(schedulePhase(schedule, Date.parse(schedule.start)), 'active');
  assert.equal(schedulePhase(schedule, Date.parse('2026-10-02T00:30:00-03:00')), 'active');
  assert.equal(schedulePhase(schedule, Date.parse(schedule.end)), 'finished');
  assert.equal(schedulePhase({ ...schedule, enabled: false }, Date.parse(schedule.start)), 'paused');
});
test('invalid persisted schedules are rejected', () => {
  assert.equal(validSchedule(schedule), true);
  for (const value of [null, {}, { ...schedule, channel: 17 }, { ...schedule, start: 'bad' }, { ...schedule, end: schedule.start }, { ...schedule, enabled: 'yes' }]) assert.equal(validSchedule(value), false);
});
test('analysis sends only the channel, handles errors, and rejects malformed success', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, '/analyzer-api/api/analysis');
      assert.deepEqual(JSON.parse(String(init?.body)), { channel: 12 });
      assert.equal(new Headers(init?.headers).has('Authorization'), false);
      return new Response(JSON.stringify({ channel: 12, analyzed_at: new Date().toISOString(), detections: [] }));
    };
    assert.deepEqual((await analyzeCamera(12, new AbortController().signal)).detections, []);
    globalThis.fetch = async () => new Response('{}', { status: 502 });
    await assert.rejects(analyzeCamera(12, new AbortController().signal), /stream/);
    globalThis.fetch = async () => new Response('{}');
    await assert.rejects(analyzeCamera(12, new AbortController().signal), /inválida/);
  } finally { globalThis.fetch = original; }
});
