import fs from "node:fs";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { Chess } from "chess.js";
import { games } from "../src/games/final_games.js";

const source = fs.readFileSync(new URL("../public/engines/sunfish/sunfish.js", import.meta.url), "utf8");
const context = { module: { exports: {} }, exports: {}, performance, console };
vm.runInNewContext(source, context, { filename: "sunfish.js" });
const sunfish = context.module.exports;

function search(fen, depth) {
    const output = [];
    sunfish.engine(`position fen ${fen}`, (line) => output.push(line));
    const started = performance.now();
    sunfish.engine(`go depth ${depth}`, (line) => output.push(line));
    const elapsed = performance.now() - started;
    const best = output.findLast((line) => line.startsWith("bestmove "))?.split(/\s+/)[1] || "";
    return { best, elapsed };
}

function deviationPosition(game) {
    const chess = new Chess(game.fen);
    const line = game.moves.trim().split(/\s+/);
    chess.move({ from: line[0].slice(0, 2), to: line[0].slice(2, 4), promotion: line[0][4] });
    const canonical = line[1];
    const deviation = chess.moves({ verbose: true })
        .map((move) => `${move.from}${move.to}${move.promotion || ""}`)
        .sort()
        .find((move) => move !== canonical);
    if (!deviation) return null;
    chess.move({ from: deviation.slice(0, 2), to: deviation.slice(2, 4), promotion: deviation[4] });
    return chess.fen();
}

const positions = games.slice(0, 40).map(deviationPosition).filter(Boolean);
for (const depth of [2, 3, 4, 5, 6, 7]) {
    const times = [];
    let illegal = 0;
    let nondeterministic = 0;
    for (const fen of positions) {
        const first = search(fen, depth);
        const second = search(fen, depth);
        if (first.best !== second.best) nondeterministic++;
        const chess = new Chess(fen);
        try {
            if (!chess.move({ from: first.best.slice(0, 2), to: first.best.slice(2, 4), promotion: first.best[4] })) illegal++;
        } catch {
            illegal++;
        }
        times.push(first.elapsed, second.elapsed);
    }
    times.sort((a, b) => a - b);
    const percentile = (value) => times[Math.min(times.length - 1, Math.floor(times.length * value))];
    console.log({ depth, positions: positions.length, medianMs: percentile(0.5).toFixed(2), p95Ms: percentile(0.95).toFixed(2), maxMs: times.at(-1).toFixed(2), illegal, nondeterministic });
}
