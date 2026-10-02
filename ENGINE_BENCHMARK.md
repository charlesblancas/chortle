# Browser engine comparison — 2026-10-02

Run `node scripts/benchmark-engines.mjs` from the repository root. Experimental engines and detailed JSON results are saved under ignored `node_modules/.cache/chortle-engine-benchmark/`. Nothing is added to the production app or dependency manifest.

Environment: Windows desktop, AMD Ryzen 5 5600G, Playwright Chromium and WebKit. These are desktop timings, not physical iPhone measurements. Startup uses locally served downloaded assets and does not measure internet download time. WebKit is a useful second browser implementation but is not an iPhone hardware benchmark.

Corpus: 48 positions from the first 16 shipped puzzles: the initial player position and the positions after the first two alphabetically selected legal deviations. This is a small, reproducible convenience sample, not a balanced chess-strength suite. Each position was searched twice after `ucinewgame` and `isready`, in a worker. Search timings include message transport; startup is separate. Fixed node budgets can overshoot (particularly Lozza, which checks periodically).

| Engine / budget | Chromium median / p95 ms | WebKit median / p95 ms | Deeper-reference agreement |
| --- | --- | --- | --- |
| Current Sunfish depth 2 | 5 / 12 | 16 / 17 | 31/48 |
| Lozza 1,000 nodes | 2 / 4 | 16 / 37 | 38/48 |
| Lozza 5,000 nodes | 8 / 15 | 18 / 32 | 40/48 |
| Lozza 20,000 nodes | 34 / 55 | 36 / 60 | 43/48 |
| Stockfish Lite 1,000 nodes | 2 / 3 | 17 / 19 | 42/48 |
| Stockfish Lite 5,000 nodes | 7 / 9 | 17 / 45 | 43/48 |
| Stockfish Lite 20,000 nodes | 24 / 31 | 38 / 80 | 47/48 |
| Stockfish Lite 100,000 nodes (reference) | 120 / 155 | 177 / 218 | 48/48 |

Reference is Stockfish Lite at 100,000 nodes. Move agreement is not a correctness percentage: different moves can be equally good, the reference can be wrong, and this comparison naturally favors the same engine. Do not infer Elo or guarantees against deeper forced mates from these results.

All searched moves were legal. Every configuration repeated identically within a browser and across both browsers on this corpus. This is evidence for reproducibility with these versions and reset conditions, not proof for every position/platform or a persistent warm search history.

Exact chess.js checks found no avoidable mate-in-one concessions among the searched replies. The alphabetical fallback conceded avoidable mate in three positions: `5Ac55:after-a2a1`, `Wb9dk:puzzle`, and `S3ZhS:after-a4a5`. This isolates a concrete fallback hazard but does not reproduce the user's unspecified failing position.

Local worker startup ranges: Sunfish 7–15 ms; Lozza 16–36 ms; Stockfish Lite 98–136 ms. Asset sizes: Lozza JS 655,137 bytes; Stockfish Lite JS 21,415 bytes plus WASM 1,787,571 bytes. Preloading can move startup before the player's first move.

Versions: Lozza commit `35b11d6ba9f04af38f2af0b5853b6de1a7aef26d` (MIT); stockfish npm `19.0.0`, lite single-threaded (GPLv3). Download source URLs and original licenses are retained by the script. Current Lozza includes a neural evaluation network and does not support UCI stop; cancellation requires worker termination. Pin engine/version/settings and reset search state for gameplay reproducibility; keep analysis state separate.

Recommendation: Stockfish Lite at 5,000 nodes is the strongest candidate from this limited comparison; Lozza at 5,000–20,000 nodes is the permissively licensed alternative. Next validate physical phone latency, broader defensive tactics, timeout behavior, and cold startup before selecting a production budget. Replace alphabetical move recovery as part of integration. No production changes or deployment were made.
