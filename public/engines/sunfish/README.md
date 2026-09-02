# Sunfish.js engine

Vendored from [foo123/sunfish.js](https://github.com/foo123/sunfish.js), a JavaScript port of [Thomas Ahle's Sunfish](https://github.com/thomasahle/sunfish), on 1 September 2026.

Chortle's copy is formatted and modified to:

- accept arbitrary UCI `position fen` positions;
- honor fixed-depth searches instead of returning after the first provisional move.

The engine is distributed under GPL-3.0. See `LICENSE` in this directory. Chortle runs the classic piece-square-table engine in a Web Worker; the optional NNUE version and model are not included.
