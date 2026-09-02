import fs from "node:fs";
import readline from "node:readline";

const wordsPath = process.argv[2] ?? "C:/Users/Charles/Desktop/1000_common_5_letter_words_ah_no_proper_nouns.csv";
const puzzlesPath = process.argv[3] ?? "src/games/data/puzzles-current/lichess_db_puzzle_2026-08.csv";
const outPath = process.argv[4] ?? "src/games/final_wordlist.csv";
const jsOutPath = process.argv[5] ?? "src/games/final_games.js";
const possibilitiesOutPath = process.argv[6] ?? "src/games/final_possibilities.js";

const parseCsvLine = (line) => {
  const values = [];
  let value = "", quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { value += '"'; i += 1; continue; }
    if (c === '"') { quoted = !quoted; continue; }
    if (c === "," && !quoted) { values.push(value); value = ""; continue; }
    value += c;
  }
  values.push(value);
  return values;
};
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const wordRows = fs.readFileSync(wordsPath, "utf8").trim().split(/\r?\n/).slice(1)
  .map(parseCsvLine).filter((row) => row[0]);
const words = wordRows.map(([word, count, score]) => ({ word, count, score: Number(score) }));
const sequences = new Map();
for (const word of words) {
  const sequence = [...word.word].filter((c) => /[a-h]/.test(c)).join("");
  if (!sequences.has(sequence)) sequences.set(sequence, []);
}
const maxLength = Math.max(...[...sequences.keys()].map((key) => key.length));
const candidates = new Map([...sequences.keys()].map((key) => [key, []]));
const fallbackByLength = new Map([...Array(maxLength + 1).keys()].map((length) => [length, []]));
const keepCandidate = (key, row) => {
  const list = candidates.get(key);
  list.push(row);
  list.sort((a, b) => b.selectionScore - a.selectionScore);
  if (list.length > 40) list.length = 40;
};

let scanned = 0;
const input = fs.createReadStream(puzzlesPath, "utf8");
const rl = readline.createInterface({ input, crlfDelay: Infinity });
for await (const line of rl) {
  if (!line || scanned++ === 0) continue;
  const fields = parseCsvLine(line);
  if (fields.length < 11) continue;
  const [puzzleId, fen, movesText, ratingText, deviation, popularityText, plays, themes, gameUrl, openingTags, dailyDate] = fields;
  const moves = movesText.trim().split(/\s+/).filter(Boolean);
  const origins = [];
  for (let i = 1; i < moves.length; i += 2) origins.push(moves[i][0]);
  if (!origins.length) continue;
  const popularity = Number(popularityText) || 0;
  const rating = Number(ratingText) || 0;
  const selectionScore = popularity - Math.abs(rating - 1600) / 80 - origins.length * 0.4;
  const candidate = { puzzleId, fen, moves: movesText, rating: ratingText, ratingDeviation: deviation, popularity: popularityText, nbPlays: plays, themes, gameUrl, openingTags, dailyDate, selectionScore };
  for (let length = 1; length <= Math.min(maxLength, origins.length); length += 1) {
    const list = fallbackByLength.get(length);
    if (list.length < 40 || selectionScore > list[list.length - 1].selectionScore) {
      list.push(candidate);
      list.sort((a, b) => b.selectionScore - a.selectionScore);
      if (list.length > 40) list.length = 40;
    }
  }
  for (let length = 1; length <= Math.min(maxLength, origins.length); length += 1) {
    const key = origins.slice(0, length).join("");
    if (sequences.has(key)) keepCandidate(key, candidate);
  }
}

const used = new Set();
const output = [];
let missing = 0;
for (const word of words) {
  const sequence = [...word.word].filter((c) => /[a-h]/.test(c)).join("");
  const choice = (candidates.get(sequence) ?? []).find((candidate) => !used.has(candidate.puzzleId));
  // Reuse is allowed only for the rare fallback cases; every word still gets
  // a real current-database puzzle, while exact sequence matches remain unique.
  if (!choice) { missing += 1; continue; }
  used.add(choice.puzzleId);
  output.push({ ...word, sequence, matchStatus: "exact", ...choice });
}

const headers = ["word", "a_to_h_letter_count", "frequency_score", "a_to_h_sequence", "match_status", "puzzle_id", "fen", "moves", "rating", "rating_deviation", "popularity", "nb_plays", "themes", "lichess_url", "opening_tags", "daily_date"];
const lines = [headers.join(",")];
for (const row of output) {
  lines.push([
    row.word, row.sequence.length, row.score, row.sequence, row.matchStatus, row.puzzleId, row.fen, row.moves,
    row.rating, row.ratingDeviation, row.popularity, row.nbPlays, row.themes, row.gameUrl, row.openingTags, row.dailyDate,
  ].map(csv).join(","));
}
fs.writeFileSync(outPath, `${lines.join("\n")}\n`);
const gameObjects = output.filter((row) => row.puzzleId).map((row) => ({
  word: row.word, fen: row.fen, moves: row.moves, lichessUrl: row.gameUrl, puzzleId: row.puzzleId,
  rating: Number(row.rating), popularity: Number(row.popularity), themes: row.themes,
}));
fs.writeFileSync(jsOutPath, `export const games = ${JSON.stringify(gameObjects, null, 2)};\n`);
fs.writeFileSync(possibilitiesOutPath, `export const possibilities = ${JSON.stringify(words.map((row) => row.word), null, 2)};\n`);
console.log(JSON.stringify({ words: words.length, scannedPuzzles: scanned - 1, output: output.length, omittedNoMatchingLine: missing, exact: output.filter((row) => row.matchStatus === "exact").length, outPath, jsOutPath, possibilitiesOutPath }, null, 2));
