import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics } from '../src/lib/analytics.js';
import { createDailyPuzzleSession } from '../src/lib/dailyPuzzleSession.js';
import { FIXTURES } from '../src/fixtures.js';

function setup(overrides = {}) {
    const values = new Map();
    const requests = [];
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const config = { enabled: true, token: 'phc_test', region: 'us',
        location: { hostname: 'chortle.charlesblancas.com', search: '' }, storage,
        randomUUID: () => '550e8400-e29b-41d4-a716-446655440000',
        send: (url, options) => { requests.push({ url, options, payload: JSON.parse(options.body) }); return Promise.resolve({ ok: true }); },
        now: () => new Date('2026-10-18T12:00:00Z'), ...overrides };
    return { client: createAnalytics(config), requests, storage, config };
}

test('analytics is disabled without production configuration and on debug/preview/privacy-sensitive visits', () => {
    for (const overrides of [{ enabled: false }, { token: '' }, { token: 'personal-secret' }, { region: 'bad' },
        { location: { hostname: 'localhost' } }, { location: { hostname: 'preview.pages.dev' } },
        ...['?day=1', '?fixture=mixed-entry', '?engine-nodes=20000'].map(search => ({ location: { hostname: 'chortle.charlesblancas.com', search } })),
        { navigator: { doNotTrack: '1' } }, { navigator: { globalPrivacyControl: true } }]) {
        const { client, requests } = setup(overrides);
        assert.equal(client.capture('tutorial_started'), false);
        assert.equal(requests.length, 0);
    }
});

test('only explicit events and allowlisted scalar properties reach the correct region', () => {
    const { client, requests } = setup({ region: 'eu' });
    client.capture('guess_submitted', { puzzle_id: 'Ab123', day: 48, mode: 'line', attempt: 2, solved: false, extra_moves: 3,
        word: 'STAFF', fen: 'secret', moves: ['a1a2'], email: 'private@example.com', url: 'https://private.example' });
    assert.equal(client.capture('$pageview'), false);
    assert.equal(client.capture('$snapshot'), false);
    assert.equal(requests.length, 1);
    const { url, options, payload } = requests[0];
    assert.equal(url, 'https://eu.i.posthog.com/i/v0/e/');
    assert.equal(options.credentials, 'omit'); assert.equal(options.referrerPolicy, 'no-referrer');
    assert.equal(payload.properties.$process_person_profile, false);
    assert.equal(payload.properties.attempt, 2);
    assert.doesNotMatch(options.body, /STAFF|secret|private|a1a2/);
    assert.equal(client.capture('mode_changed', { mode: 'invalid' }), false);
    assert.equal(payload.properties.mode, undefined);
});

test('deduplication survives reload; event attempts are bounded and failed delivery is not retried', async () => {
    const { client, requests, config } = setup();
    assert.equal(client.capture('puzzle_finished', {}, 'daily:48'), true);
    assert.equal(createAnalytics(config).capture('puzzle_finished', {}, 'daily:48'), false);
    for (let i = 0; i < 300; i++) client.capture('share_requested');
    assert.equal(requests.length, 200);
    const failing = setup({ send: () => Promise.reject(new Error('offline')) }).client;
    assert.doesNotThrow(() => failing.capture('tutorial_started'));
    await new Promise(resolve => setImmediate(resolve));
    const throwing = setup({ send: () => { throw Error('blocked'); } }).client;
    assert.doesNotThrow(() => throwing.capture('tutorial_started'));
});

test('opt-out suppresses events and blocked storage cannot interfere with gameplay', () => {
    const { client, storage, requests } = setup();
    storage.setItem('chortle:analytics-opt-out', '1');
    assert.equal(client.capture('tutorial_started'), false);
    assert.equal(requests.length, 0);
    const blocked = setup({ storage: { getItem() { throw Error('blocked'); } } }).client;
    assert.equal(blocked.capture('tutorial_started'), false);
});

test('daily session emits one start, guess and finish attempt; restored results emit nothing', async () => {
    const { client, requests } = setup();
    const data = new Map();
    const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
    const game = FIXTURES.find(f => f.id === 'player-mate-entry').game;
    const options = { game, storage, storageKey: 'daily:48', day: 48, isWord: word => word === 'fizzy', analytics: (...args) => client.capture(...args) };
    const session = createDailyPuzzleSession(options);
    assert.equal(requests.length, 0);
    await session.play('f7g7');
    for (const key of 'FIZZY') session.input(key);
    session.input('Enter');
    assert.deepEqual(requests.map(r => r.payload.event), ['puzzle_started', 'guess_submitted', 'puzzle_finished']);
    assert.equal(requests.at(-1).payload.properties.solved, true);
    const restored = createDailyPuzzleSession(options);
    restored.input('Enter');
    assert.equal(requests.length, 3);
    session.destroy(); restored.destroy();
});

test('broken analytics adapters and fixture sessions do not affect gameplay', async () => {
    const fixture = FIXTURES.find(f => f.id === 'player-mate-entry');
    const session = createDailyPuzzleSession({ game: fixture.game, isWord: () => true, analytics: () => { throw Error('unavailable'); } });
    await session.play('f7g7');
    for (const key of 'FIZZY') session.input(key);
    session.input('Enter');
    assert.equal(session.snapshot().solved, true);
    session.destroy();
    let events = 0;
    const practice = createDailyPuzzleSession({ game: fixture.game, fixture, isWord: () => true, analytics: () => events++ });
    await practice.play('f7g7');
    assert.equal(events, 0); practice.destroy();
});
