export const FIXTURES = [
    {
        id: "mixed-entry",
        label: "Mixed entry",
        description: "Start with the canonical E move, then enter G and E from the board. The word should read EGRET.",
        game: {
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
            moves: "e7e5 e2e4 g8f6 g1f3 b8c6 e1e2",
            word: "egret",
        },
        initialGuess: "E",
        initialActions: [{ letter: "E", uci: "e2e4", reply: "g8f6", moveCorrect: true }],
        instructions: "The E tile is preloaded. Make the G move from the board, then type R, make the E move, and finish with T.",
    },
    {
        id: "duplicate-score",
        label: "Duplicate scoring",
        description: "A normal Wordle fixture for checking duplicate-letter colors.",
        game: {
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
            moves: "e7e5 c2c4 d7d6 c4c5",
            word: "civic",
        },
        instructions: "Enter CIVIC and submit. Verify the duplicate I and C colors follow Wordle rules.",
    },
    {
        id: "mate-state",
        label: "Mated state",
        description: "A terminal board fixture for checking the locked board and recovery message.",
        game: {
            fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1",
            moves: "e7e5 f2f3 a7a6 g2g4 d8h4",
            word: "forge",
        },
        initialGuess: "FG",
        initialActions: [
            { letter: "F", uci: "f2f3", reply: "a7a6", moveCorrect: true },
            { letter: "G", uci: "g2g4", reply: "d8h4", moveCorrect: true, mated: true },
        ],
        mated: true,
        instructions: "The line is preloaded through Qh4 mate. Backspace should undo G and reopen the board so you can play another move.",
    },
];

export function fixtureById(id) {
    return FIXTURES.find((fixture) => fixture.id === id) || null;
}
