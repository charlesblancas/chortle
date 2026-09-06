import { writable } from "svelte/store";

export const chessDone = writable(false);
export const chessMove = writable("");
// Instructions decide whether to open on first visit after the app mounts.
// Starting closed avoids a visible flash for returning players.
export const showInstructions = writable(false);
export const gameOver = writable(false);
export const gameWon = writable(false);
export const finalWordStatus = writable([-1, -1, -1, -1, -1]);
export const finalChessStatus = writable([-1, -1, -1, -1, -1]);
