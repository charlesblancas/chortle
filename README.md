# Chortle
## Inspiration
I've been enjoying the short daily games, the "dles" as many people like to call them, and I wanted to make my own. I enjoy that it takes so quick to complete one game, but I still love that it stretches my brain a little. 

## What it does
You play two games at once: a chess puzzle and Wordle. Every turn, you guess a word and a chess move. Both letters in the chess move are in the secret word, but they can appear in any order. For example, if the word is “DREAM” and the move is e4d3, they share the letter D and E.

## How we built it
It was built with Svelte and deployed on Netlify.

## Development tests

Run the standalone word/move pipeline tests with:

```sh
npm run test:pipeline
```

When the Vite dev server is running, visual fixtures are available from the
development-only fixture selector at the top of the page. They can also be
loaded directly with `/?fixture=mixed-entry`, `/?fixture=duplicate-score`, or
`/?fixture=mate-state`. The selector and query fixtures are disabled in
production builds.

## Word-frequency candidates

`src/games/data/unigram_freq.csv` is the downloaded source snapshot from the
[Kaggle English Word Frequency dataset](https://www.kaggle.com/datasets/rtatman/english-word-frequency).
Run `src/games/generate_frequency_candidates.py` to regenerate the separate
`frequency_candidates.csv` and `frequency_candidates.txt` review lists. They
contain five-letter alphabetic words with at least one A–H, sorted by descending
frequency, with a `wordle_answer` flag showing membership in the existing
`answerlist.txt`. The existing Wordle-valid list remains unchanged.

The current review cutoff is rank **32,780**: the last Wordle answer-list
match is rank 31,780 (`elate`), plus 1,000 additional frequency ranks. The
bounded review files are `frequency_candidates_cutoff.csv` and
`frequency_candidates_cutoff.txt`; this cutoff is provisional until the list
is manually reviewed.

## Dictionary words

`src/games/data/english-words-alpha.txt` is the lowercase source snapshot from
[dwyl/english-words](https://github.com/dwyl/english-words). The generated
`english_words_5.csv` and `english_words_5.txt` files contain every five-letter
lowercase entry plus a `wordle_valid` boolean. This list is alphabetical, not
frequency-ranked; regenerate it with `generate_dictionary_words.py`.

## Current Lichess wordlist

`src/games/answerlist_ah.csv` starts with the 2,122 Wordle answers containing
at least one A-H. `src/games/final_wordlist.csv` is the valid 1,644-word
subset for which the current Lichess export (updated 2026-08-02) has a matching
solution-origin sequence. Each row keeps the word,
frequency score, A-H sequence, FEN, UCI line, puzzle metadata, and a direct
Lichess URL. `src/games/final_games.js` and `src/games/final_possibilities.js`
are the runtime-friendly versions. The
generator is `src/games/generate_final_wordlist.js`; it prefers puzzles whose
solution move origins match the word's A-H sequence and marks the few
length-compatible fallbacks explicitly. No mismatched fallback puzzles are
included in the final answer pool.

The original Wordle guess list remains `src/games/possibilities.js`. The
deduplicated review unions are `wordlist_union_curated_wordle.csv` (and
`.txt`) and `full_valid_union_new_words.csv` (and `.txt`), with source labels
and `wordlist_union_audit.json` for structural checks. All 997 curated words
are present in both source dictionaries.

## Challenges we ran into
Doing this project solo was challenging. I had to conceive of the idea and look for people such as mentors or my fellow hackers to validate/critique them and to playtest the product at different stages. Coding it all by myself was also an interesting challenge, as I had all the control of the project architecture.

## Accomplishments that we're proud of
I am really proud that I was able to take an idea from conception to completion. I am also happy that it is something I enjoy and would love to actually use.

## What we learned
This was mostly a refresher in Svelte, and I can see that I can work faster and have improved. As for something new, it's a bit niche, but I can now set up a chessboard in Svelte.

## What's next for Chortle
Right now, it's randomly creating games to streamline the demo process, but I will make it function like the other dles, where it resets every day, as that is how I enjoy these types of games.
