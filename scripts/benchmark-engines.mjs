import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium, webkit } from '@playwright/test';
import { Chess } from 'chess.js';
import { games } from '../src/games/final_games.js';

// Experimental engines stay outside the production bundle and dependencies.
const cache = path.resolve('node_modules/.cache/chortle-engine-benchmark');
await fs.mkdir(cache, { recursive: true });
const sources = {
    'lozza.js': 'https://raw.githubusercontent.com/namanthanki/lozza/35b11d6ba9f04af38f2af0b5853b6de1a7aef26d/lozza.js',
    'lozza-LICENSE': 'https://raw.githubusercontent.com/namanthanki/lozza/35b11d6ba9f04af38f2af0b5853b6de1a7aef26d/LICENSE',
    'stockfish-19-lite-single.js': 'https://unpkg.com/stockfish@19.0.0/bin/stockfish-19-lite-single.js',
    'stockfish-19-lite-single.wasm': 'https://unpkg.com/stockfish@19.0.0/bin/stockfish-19-lite-single.wasm',
    'stockfish-Copying.txt': 'https://unpkg.com/stockfish@19.0.0/Copying.txt',
};
for (const [file, url] of Object.entries(sources)) {
    try { await fs.access(path.join(cache, file)); }
    catch {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`${url}: ${response.status}`);
        await fs.writeFile(path.join(cache, file), Buffer.from(await response.arrayBuffer()));
    }
}
const uci = m => `${m.from}${m.to}${m.promotion || ''}`;
const play = (chess, move) => chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
const positions = [];
for (const game of games.slice(0, 16)) {
    const chess = new Chess(game.fen);
    const line = game.moves.split(' ');
    play(chess, line[0]);
    positions.push({ name: `${game.puzzleId}:puzzle`, fen: chess.fen() });
    const alternatives = chess.moves({ verbose: true }).map(uci).sort().filter(m => m !== line[1]);
    for (const move of alternatives.slice(0, 2)) {
        const child = new Chess(chess.fen());
        play(child, move);
        if (!child.isGameOver()) positions.push({ name: `${game.puzzleId}:after-${move}`, fen: child.fen() });
    }
}
const server = http.createServer(async (req, res) => {
    try {
        const file = req.url.slice(1);
        if (!file) { res.end('<!doctype html><title>Engine benchmark</title>'); return; }
        const source = file === 'sunfish.js' ? path.resolve('scripts/fixtures/sunfish.worker.js') : path.join(cache, path.basename(file));
        res.setHeader('Content-Type', file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.end(await fs.readFile(source));
    } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const report = { sources, positions, runs: [], note: 'Desktop host, real browser workers. No physical phone timing. Two searches per FEN, fresh UCI game state. Reference agreement is not a correctness score.' };
try {
    for (const [browserName, launcher] of Object.entries({ chromium, webkit })) {
        const browser = await launcher.launch();
        try {
            const page = await browser.newPage();
            await page.goto(`http://127.0.0.1:${server.address().port}`);
            for (const config of [
                { name: 'Sunfish depth 2', file: 'sunfish.js', command: 'go depth 2' },
                ...['lozza.js', 'stockfish-19-lite-single.js'].flatMap(file => (file.startsWith('stockfish') ? [1000, 5000, 20000, 100000] : [1000, 5000, 20000]).map(nodes => ({ name: `${file.split('.')[0]} ${nodes} nodes`, file, command: `go nodes ${nodes}` }))),
            ]) {
                const run = await page.evaluate(async ({ config, positions }) => {
                    const started = performance.now();
                    const worker = new Worker(config.file);
                    let lines = [], resolveLine, rejectLine, matcher;
                    worker.onmessage = e => {
                        for (const line of String(e.data).split('\n')) {
                            lines.push(line);
                            if (matcher?.(line)) { matcher = null; resolveLine(line); }
                        }
                    };
                    worker.onerror = e => rejectLine?.(new Error(e.message));
                    async function send(command, pattern) {
                        lines = [];
                        let timer;
                        const result = new Promise((resolve, reject) => {
                            resolveLine = resolve; rejectLine = reject; matcher = s => pattern.test(s);
                            timer = setTimeout(() => reject(new Error(`Timeout: ${config.name} ${command}`)), 15000);
                        });
                        worker.postMessage(command);
                        try { return await result; } finally { clearTimeout(timer); }
                    }
                    try {
                        await send('uci', /^uciok/);
                        await send('isready', /^readyok/);
                        const startupMs = performance.now() - started;
                        const results = [];
                        for (const position of positions) {
                            for (let repeat = 0; repeat < 2; repeat++) {
                                worker.postMessage('ucinewgame');
                                await send('isready', /^readyok/);
                                worker.postMessage(`position fen ${position.fen}`);
                                const start = performance.now();
                                const best = await send(config.command, /^bestmove /);
                                results.push({ name: position.name, repeat, ms: performance.now() - start, move: best.split(/\s+/)[1], info: lines.filter(s => s.startsWith('info depth')).at(-1) });
                            }
                        }
                        return { startupMs, results };
                    } finally { worker.terminate(); }
                }, { config, positions });
                const times = run.results.map(r => r.ms).sort((a, b) => a - b);
                const summary = { browserName, name: config.name, startupMs: Math.round(run.startupMs), medianMs: Math.round(times[Math.floor(times.length / 2)]), p95Ms: Math.round(times[Math.floor(times.length * .95)]), maxMs: Math.round(times.at(-1)), repeatDifferences: run.results.filter((r, i) => i % 2 && r.move !== run.results[i - 1].move).length };
                report.runs.push({ ...summary, results: run.results });
                console.log(JSON.stringify(summary));
                await fs.writeFile(path.join(cache, 'results.json'), JSON.stringify(report, null, 2));
            }
        } finally { await browser.close(); }
    }
} finally { server.close(); }

// Exact one-ply mate checks, independent of any engine evaluation.
function allowsMate(fen, move) {
    const chess = new Chess(fen);
    try { play(chess, move); } catch { return null; }
    if (chess.isGameOver()) return false;
    return chess.moves({ verbose: true }).some(reply => {
        chess.move(reply); const mate = chess.isCheckmate(); chess.undo(); return mate;
    });
}
for (const run of report.runs) {
    run.illegal = 0; run.avoidableMateInOne = 0;
    for (let i = 0; i < positions.length; i++) {
        const position = positions[i], move = run.results[i * 2].move;
        const danger = allowsMate(position.fen, move);
        if (danger === null) run.illegal++;
        if (danger && new Chess(position.fen).moves({ verbose: true }).some(m => allowsMate(position.fen, uci(m)) === false)) run.avoidableMateInOne++;
    }
    const reference = report.runs.find(r => r.browserName === run.browserName && r.name === 'stockfish-19-lite-single 100000 nodes');
    run.referenceAgreement = run.results.filter((r, i) => i % 2 === 0 && r.move === reference.results[i].move).length;
    console.log(JSON.stringify({ name: run.name, browser: run.browserName, illegal: run.illegal, avoidableMateInOne: run.avoidableMateInOne, referenceAgreement: run.referenceAgreement, positions: positions.length }));
}
report.fallbackAvoidableMates = positions.filter(p => {
    const moves = new Chess(p.fen).moves({ verbose: true }).map(uci).sort();
    return allowsMate(p.fen, moves[0]) && moves.some(move => allowsMate(p.fen, move) === false);
}).map(p => p.name);
report.crossBrowserDifferences = report.runs.filter(r => r.browserName === 'chromium').map(run => {
    const other = report.runs.find(r => r.browserName === 'webkit' && r.name === run.name);
    return { name: run.name, differences: run.results.filter((r, i) => i % 2 === 0 && r.move !== other.results[i].move).length };
});
console.log(JSON.stringify({ fallbackAvoidableMates: report.fallbackAvoidableMates, crossBrowserDifferences: report.crossBrowserDifferences }));
await fs.writeFile(path.join(cache, 'results.json'), JSON.stringify(report, null, 2));
console.log(`Detailed report: ${path.join(cache, 'results.json')}`);
