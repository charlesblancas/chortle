import { writable } from "svelte/store";

// Instructions decide whether to open on first visit after the app mounts.
// Starting closed avoids a visible flash for returning players.
export const showInstructions = writable(false);
export const gameOver = writable(false);
