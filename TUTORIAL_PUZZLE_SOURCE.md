# Beginner tutorial puzzle source

Verified 2026-10-04 against the [official puzzle database](https://database.lichess.org/lichess_db_puzzle.csv.zst) and [live puzzle API](https://lichess.org/api/puzzle/0ZZvz). Puzzle [0ZZvz](https://lichess.org/training/0ZZvz) has rating **860**, 52 plays, and themes `endgame master crushing fork long`. Its source is [TriniCupid–KB60615](https://lichess.org/poRAP0aS#65), a rated 3+0 blitz game.

Database setup FEN: `8/3n1pkp/bq2p1p1/p7/Pp1Rn3/1P2PP2/2Q3PP/3R2K1 w - - 0 33`.

The preceding White move is `d4d7` (`33. Rxd7`). The actual Black puzzle starts afterward. The API confirms `lastMove: d4d7`, `initialPly: 64`, and solution `b6e3 g1h1 e4f2 c2f2 e3f2`. The canonical line is **33...Qxe3+ 34.Kh1 Nf2+ 35.Qxf2 Qxf2**. These are exactly three Black moves, with source files **B E E**. `BLEEP` is a valid five-letter target with chess slots 0, 2, and 3.

Replaying every canonical move with the repo's chess.js gives final FEN `8/3R1pkp/b3p1p1/p7/Pp6/1P3P2/5qPP/3R3K w - - 0 36`. This position is nonterminal; White has 27 legal moves. The lesson ends the puzzle, not the chess game.

## Legal out-of-order practice branch (second guess)

The following branch is legal in chess.js and supplies genuine move identity feedback. Only the canonical solution above is a sourced winning line; the alternate White replies below are tutorial scripting choices.

1. White trigger `d4d7` (`Rxd7`).
2. Black `b6e3` (`Qxe3+`), canonical first move.
3. White `c2f2` (`Qf2`), a legal response to the check.
4. Black `e3f2` (`Qxf2+`), the exact canonical third move, played early by the same queen.
5. White `g1h1` (`Kh1`), the only legal reply.
6. Black `e4d6` (`Nd6`), a legal knight move absent from the canonical line.
7. White `d7d8` (`Rd8`).
8. Black `d6c4` (`Nc4`), giving BLEED. Undo this move to restore BLEE, then type P.

For second guess `BLEEP`, assembled as chess/type/chess/chess/type, the B cell is fully green. The first E has green letter feedback and yellow move feedback because the exact third move was played second. The second E has green letter feedback and gray move feedback because `e4d6` is absent from the canonical sequence. Typed L and P have ordinary word feedback, not independent chess feedback. Extra-move counting is not part of this lesson.

The first real guess, BEVEL, follows the canonical B/E/E line: its first E has yellow letter / green move feedback, and V is gray. The final BLEEP guess follows the canonical line using confirmed-move keyboard shortcuts and wins. All feedback and shortcuts use the shared game rules.

## Search evidence

Streamed the current official compressed CSV with Python urllib and zstandard, filtering Black-to-play puzzles with exactly six database plies (trigger plus five solution plies), rating below 1000, three source files that can fit a dictionary word, and repeated second/third source files. Candidate legality and nonterminal outcomes were checked with chess.js. The live API independently confirmed the selected record and rating. No reference to `0ZZvz` was found in the app's source JS, JSON, or Svelte files during this check; database inclusion alone is not daily-puzzle reuse.
