// Lichess puzzle 0ZZvz (rating 860), Black to play after Rxd7.
// https://lichess.org/training/0ZZvz — source verified in TUTORIAL_PUZZLE_SOURCE.md.
const move = (uci, reply, text) => ({ kind: "move", uci, reply, text });
const key = (letter, text) => ({ kind: "key", key: letter, text });
const submit = (text) => ({ kind: "submit", text });
const explain = (text, tile) => ({ kind: "explain", text, tile });
const nextRow = (text) => ({ kind: "new-row", text });
const shortcut = (uci, reply, text) => ({ kind: "shortcut", key: uci[0].toUpperCase(), uci, reply, text });

export const tutorialLesson = {
    answer: "BLEEP",
    puzzleId: "0ZZvz",
    rating: 860,
    fen: "8/3n1pkp/bq2p1p1/p7/Pp1Rn3/1P2PP2/2Q3PP/3R2K1 w - - 0 33",
    moves: "d4d7 b6e3 g1h1 e4f2 c2f2 e3f2",
    steps: [
        move("b6e3", "g1h1", "Move your queen B6 → E3 to enter B. White replies automatically."),
        move("e4f2", "c2f2", "Move your knight E4 → F2 to enter E."),
        key("V", "Type V. Letters outside A–H use the keyboard."),
        move("e3f2", "", "Move your queen E3 → F2 to enter another E."),
        key("L", "Type L to finish BEVEL."),
        submit("Press Enter or ↵ to check your guess."),
        explain("Full green: right letter, right move. Top = letter; bottom = chess move.", 0),
        explain("Yellow top, green bottom: E belongs elsewhere in the word; the move is correct.", 1),
        explain("Gray: V isn't in the word. Typed letters only have word feedback.", 2),
        nextRow("Try BLEEP with a different move order. Each guess resets the board."),
        move("b6e3", "c2f2", "Press B to replay your confirmed move, or move the queen B6 → E3."),
        key("L", "Type L."),
        move("e3f2", "g1h1", "Move your queen E3 → F2. We're playing this move too early."),
        move("e4d6", "d7d8", "Move your knight E4 → D6 to enter E."),
        move("d6c4", "", "Move your knight D6 → C4 to make BLEED."),
        { kind: "undo", text: "Press Backspace or Undo to remove D and undo the move." },
        key("P", "Type P instead to make BLEEP."),
        submit("Press Enter or ↵ to check the word and moves."),
        explain("Green top, yellow bottom: right letter; this move belongs later in the line.", 2),
        explain("Green top, gray bottom: right letter; this move isn't in the line.", 3),
        nextRow("Now solve BLEEP. Type confirmed chess letters to replay their moves in order."),
        shortcut("b6e3", "g1h1", "Press B to replay the queen capture."),
        key("L", "Type L."),
        shortcut("e4f2", "c2f2", "Press E to replay the knight move—even in a different word column."),
        shortcut("e3f2", "", "Press E again to replay the next move: the queen capture."),
        key("P", "Type P to finish BLEEP."),
        submit("Press Enter or ↵ to submit BLEEP."),
        { kind: "complete", text: "Word and moves solved! You can replay the tutorial anytime from the ? at the top right." },
    ],
};
