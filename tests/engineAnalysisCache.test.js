import test from 'node:test';
import assert from 'node:assert/strict';

test('Stockfish cache ignores old engine scores, persists mates, and bounds stored entries', async () => {
    const originalWindow = globalThis.window;
    const values = new Map([
        ['chortle:sunfish-analysis-v1', JSON.stringify([['position', { depth: 40, move: 'e2e4', score: 999, verified: true }]])],
    ]);
    globalThis.window = { localStorage: {
        getItem: key => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
    } };
    try {
        const cache = await import('../src/lib/engineAnalysisCache.js?cache-isolation');
        assert.equal(cache.getCachedAnalysis('position'), null);
        cache.cacheAnalysis('position', 8, { move: 'e2e4', score: 100000, mate: 3, analysisComplete: true });
        assert.equal(cache.getCachedAnalysis('position').mate, 3);
        const fresh = await import('../src/lib/engineAnalysisCache.js?cache-restoration');
        assert.equal(fresh.getCachedAnalysis('position').mate, 3);
        assert.equal(fresh.getCachedAnalysis('position').analysisComplete, true);
        for (let index = 0; index < 110; index++) cache.cacheAnalysis(`fen-${index}`, 2, { move: 'e2e4', score: index });
        const stored = JSON.parse(values.get('chortle:stockfish-19-analysis-v1'));
        assert.equal(stored.length, 96);
        assert.equal(cache.getCachedAnalysis('fen-0'), null);
        assert.equal(cache.getCachedAnalysis('fen-109').score, 109);
    } finally { globalThis.window = originalWindow; }
});

test('malformed optional cache entries are skipped instead of breaking analysis', async () => {
    const originalWindow = globalThis.window;
    globalThis.window = { localStorage: {
        getItem: () => JSON.stringify([null, {}, ['bad', null], ['valid', { depth: 3, move: 'e2e4', score: 20, verified: true }]]),
    } };
    try {
        const cache = await import('../src/lib/engineAnalysisCache.js?malformed-cache');
        assert.equal(cache.getCachedAnalysis('valid').score, 20);
    } finally { globalThis.window = originalWindow; }
});
