import { FILE_LETTERS } from "../gameRules.js";

export function placedMoveCount(word) {
    return [...word].filter((letter) => FILE_LETTERS.includes(letter)).length;
}

export function requiredLineMoves(answer) {
    return placedMoveCount(answer.toUpperCase());
}

export function placeQueuedLetter(word, actions, letter) {
    if (word.length >= 5) return null;
    const next = actions[placedMoveCount(word)];
    return next?.letter === letter ? word + letter : null;
}

/** Undo the last board move and its placement, preserving typed letters. */
export function undoQueuedMove(word, actions) {
    if (!actions.length) return { word, actions };
    let nextWord = word;
    if (placedMoveCount(word) === actions.length) {
        const index = [...word].findLastIndex((letter) => FILE_LETTERS.includes(letter));
        nextWord = word.slice(0, index) + word.slice(index + 1);
    }
    return { word: nextWord, actions: actions.slice(0, -1) };
}

export function lineGuessError(word, actions, requiredMoves) {
    if (actions.length !== requiredMoves) return `Play ${requiredMoves} chess moves before submitting.`;
    if (word.length !== 5) return "Not enough letters";
    if ([...word].filter((letter) => FILE_LETTERS.includes(letter)).join("") !== actions.map((action) => action.letter).join("")) {
        return "Use every queued chess letter in order.";
    }
    return "";
}
