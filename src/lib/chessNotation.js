export function isUciMove(move) {
    return typeof move === "string" && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move);
}

export function formatUciMove(uci = "") {
    if (!isUciMove(uci)) return "";
    const promotion = uci[4] ? `=${uci[4].toUpperCase()}` : "";
    return `${uci.slice(0, 2).toUpperCase()}→${uci.slice(2, 4).toUpperCase()}${promotion}`;
}
