export function isUciMove(move) {
    return typeof move === "string" && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move);
}
