// Explicit, bounded events only: no SDK, autocapture, replay, or DOM inspection.
const SCHEMA = {
    puzzle_started: ['puzzle_id', 'day', 'mode'],
    guess_submitted: ['puzzle_id', 'day', 'mode', 'attempt', 'solved', 'extra_moves'],
    puzzle_finished: ['puzzle_id', 'day', 'mode', 'attempt', 'solved', 'extra_moves'],
    tutorial_started: [], tutorial_finished: [], tutorial_skipped: [],
    mode_changed: ['mode'],
    share_requested: ['day', 'mode', 'method'],
    share_completed: ['day', 'mode', 'method'],
};
const KEY = 'chortle:analytics-v1';
const NOOP = { capture: () => false };

export function createAnalytics({ enabled = false, token = '', region = 'us', location,
    storage, navigator = {}, randomUUID, send = globalThis.fetch?.bind(globalThis), now = () => new Date() } = {}) {
    if (!enabled || !token.startsWith('phc_') || !['us', 'eu'].includes(region)
        || location?.hostname !== 'chortle.charlesblancas.com' || !send || !randomUUID
        || navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return NOOP;
    const query = new URLSearchParams(location.search || '');
    if (['fixture', 'day', 'engine-nodes'].some(key => query.has(key))) return NOOP;
    let memory = {};
    function read() {
        try { return JSON.parse(storage?.getItem(KEY) || 'null') || memory; } catch { return memory; }
    }
    function save(value) {
        memory = value;
        try { storage?.setItem(KEY, JSON.stringify(value)); } catch { /* Optional persistence. */ }
    }
    return { capture(event, properties = {}, once = '') {
        try {
            if (!(event in SCHEMA) || navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return false;
            if (storage?.getItem('chortle:analytics-opt-out') === '1') return false;
            const date = now();
            let state = read();
            if (state.date !== date.toISOString().slice(0, 10)) state = { id: state.id, date: date.toISOString().slice(0, 10), count: 0, seen: [] };
            state.id ||= randomUUID();
            state.seen ||= [];
            if (state.count >= 200 || (once && state.seen.includes(`${event}:${once}`))) return false;
            const clean = { $process_person_profile: false, schema_version: 1 };
            for (const key of SCHEMA[event]) {
                const value = properties[key];
                if (key === 'mode' && ['normal', 'line'].includes(value)) clean[key] = value;
                else if (key === 'method' && ['clipboard', 'native'].includes(value)) clean[key] = value;
                else if (key === 'puzzle_id' && typeof value === 'string' && /^[A-Za-z0-9]{1,20}$/.test(value)) clean[key] = value;
                else if (key === 'solved' && typeof value === 'boolean') clean[key] = value;
                else if (['day', 'attempt', 'extra_moves'].includes(key) && Number.isSafeInteger(value) && value >= 0) clean[key] = value;
            }
            state.count = (state.count || 0) + 1;
            if (once) state.seen.push(`${event}:${once}`);
            save(state);
            // At-most-once attempt: deliberately no retry loop or offline queue.
            Promise.resolve(send(`https://${region}.i.posthog.com/i/v0/e/`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit',
                referrerPolicy: 'no-referrer', keepalive: true,
                body: JSON.stringify({ api_key: token, distinct_id: state.id, uuid: randomUUID(), event, properties: clean, timestamp: date.toISOString() }),
            })).catch(() => {});
            return true;
        } catch { return false; }
    } };
}

let client;
export function track(event, properties, once) {
    try {
        client ||= createAnalytics({ enabled: import.meta.env?.PROD && import.meta.env?.VITE_ANALYTICS_ENABLED === 'true',
            token: import.meta.env?.VITE_POSTHOG_TOKEN || '', region: import.meta.env?.VITE_POSTHOG_REGION || 'us',
            location: globalThis.location, navigator: globalThis.navigator,
            storage: globalThis.localStorage, randomUUID: globalThis.crypto?.randomUUID.bind(globalThis.crypto),
        });
        return client.capture(event, properties, once);
    } catch { return false; }
}
