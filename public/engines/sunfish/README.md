# Sunfish.js engine

Vendored from [foo123/sunfish.js](https://github.com/foo123/sunfish.js), a JavaScript port of [Thomas Ahle's Sunfish](https://github.com/thomasahle/sunfish), on 1 September 2026.

The source is kept in `scripts/fixtures/sunfish.worker.js` solely for historical
benchmarks. Gameplay and replay now use Stockfish Lite. This directory retains
the corresponding license and attribution notice for earlier releases.

Chortle's copy is formatted and modified to:

- accept arbitrary UCI `position fen` positions;
- honor fixed-depth searches instead of returning after the first provisional move.

The historical engine is distributed under GPL-3.0. See `LICENSE` in this directory.
