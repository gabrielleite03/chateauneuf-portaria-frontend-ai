import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCamera, schedulePhase, validSchedule, restoreSchedule, nextCamera, enqueueAlert, Analysis } from './detection.ts';

const schedule = { channels: [12, 3], start: '2026-10-01T23:00:00-03:00', end: '2026-10-02T01:00:00-03:00', enabled: true };
test('schedule crosses midnight and stops at the exact end', () => {
  assert.equal(schedulePhase(schedule, Date.parse('2026-10-01T22:59:59-03:00')), 'waiting');
  assert.equal(schedulePhase(schedule, Date.parse(schedule.start)), 'active');
  assert.equal(schedulePhase(schedule, Date.parse('2026-10-02T00:30:00-03:00')), 'active');
  assert.equal(schedulePhase(schedule, Date.parse(schedule.end)), 'finished');
  assert.equal(schedulePhase({ ...schedule, enabled: false }, Date.parse(schedule.start)), 'paused');
});
test('invalid persisted schedules are rejected', () => {
  assert.equal(validSchedule(schedule), true);
  for (const value of [null, {}, { ...schedule, channels: [] }, { ...schedule, channels: [12, 12] }, { ...schedule, channels: [17] }, { ...schedule, start: 'bad' }, { ...schedule, end: schedule.start }, { ...schedule, enabled: 'yes' }]) assert.equal(validSchedule(value), false);
});
test('legacy schedules retain their camera and time period', () => {
  const { channels, ...rest } = schedule;
  assert.deepEqual(restoreSchedule({ ...rest, channel: 12 }), { ...rest, channels: [12] });
  assert.deepEqual(restoreSchedule(schedule), schedule);
  assert.equal(restoreSchedule({ ...schedule, channels: [] }), null);
});
test('camera rotation is fair, respects cooldown and includes failures as attempts', () => {
  const attempts = { 12: 100_000, 3: 101_000 };
  assert.equal(nextCamera([12, 3, 6], attempts, 102_000), 6);
  assert.equal(nextCamera([12, 3], attempts, 114_999), undefined);
  assert.equal(nextCamera([3, 12], attempts, 115_000), 12);
  assert.equal(nextCamera([12, 3], { ...attempts, 12: 116_000 }, 117_000), 3);
  assert.equal(nextCamera([6], {}, 0), 6);
});
test('alerts from different cameras are queued instead of replacing one another', () => {
  const first: Analysis = { channel: 12, analyzed_at: '2026-10-01T12:00:00Z', detections: [] };
  const second = { ...first, channel: 3 };
  assert.deepEqual(enqueueAlert([first], second), [first, second]);
  const updated = { ...first, analyzed_at: '2026-10-01T12:01:00Z' };
  assert.deepEqual(enqueueAlert([first, second], updated), [updated, second]);
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
