<script>
    import Chess from "./Chess.svelte";
    import Guess from "./Guess.svelte";
    import Instructions from "./Instructions.svelte";
    import GameOver from "./GameOver.svelte";
    import Keyboard from "./Keyboard.svelte";
    import GameError from "./GameError.svelte";
    import { games } from "../games/final_games";
    import { possibilities } from "../games/possibilities";
    import { gameOver, showInstructions } from "../stores";
    import { scoreWord } from "../gameRules";
    import { gameStorageKey, readSavedGame, writeSavedGame } from "./gameStorage";
    import { onMount, tick } from "svelte";

    const FILE_LETTERS = "ABCDEFGH";
    export let fixture = null;
    export let dayOverride = NaN;
    export let pieceSet = "cburnett";
    const ROWS = 5;
    let guesses = Array(ROWS).fill("");
    if (fixture?.initialGuess) guesses[0] = fixture.initialGuess.toUpperCase();
    let statuses = Array.from({ length: ROWS }, () => Array(5).fill(-1));
    let currentRow = 0;
    let actions = fixture?.initialActions ? [...fixture.initialActions] : [];
    let previewLetter = "";
    let keyStatuses = {};
    let message = "";
    let highlightFile = "";
    let engineThinking = false;
    let messageTimer;
    const dailyStart = new Date("2026-09-01T00:00:00");
    const today = new Date(new Date().toDateString());
    const day = Math.max(1, Math.floor((today - dailyStart) / 86400000) + 1);
    const selectedDay = Number.isFinite(dayOverride) ? Math.max(1, Math.floor(dayOverride)) : day;
    const dailyGame = games[(selectedDay - 1) % games.length];
    $: game = fixture?.game || dailyGame;
    $: answer = game.word.toUpperCase();
    let mated = fixture?.mated || false;
    let promotionPending = false;
    let hydrated = false;
    const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
    $: storageKey = gameStorageKey(selectedDay, game);

    function saveGame(completed = $gameOver) {
        if (!hydrated || fixture) return;
        writeSavedGame(localStorage, storageKey, { guesses, statuses, currentRow, actions, keyStatuses, mated, completed });
    }

    onMount(() => {
        if (!fixture) {
            const saved = readSavedGame(localStorage, storageKey);
            if (saved) {
                guesses = saved.guesses;
                statuses = saved.statuses;
                currentRow = saved.currentRow;
                actions = saved.actions;
                keyStatuses = saved.keyStatuses;
                mated = saved.mated;
                // Let child components receive the restored rows before the
                // result modal subscribes to the completed state.  This keeps
                // a completed game visible, including its result grid, after
                // a refresh.
                tick().then(() => {
                    gameOver.set(saved.completed);
                    if (saved.completed) showInstructions.set(false);
                });
            } else {
                gameOver.set(false);
            }
        } else {
            gameOver.set(false);
        }
        hydrated = true;
    });

    function clearGuidance() {
        message = "";
        highlightFile = "";
        clearTimeout(messageTimer);
    }

    function input(key) {
        if ($showInstructions || $gameOver || engineThinking || promotionPending) return;
        clearGuidance();
        previewLetter = "";
        if (/^[A-Za-z]$/.test(key)) {
            key = key.toUpperCase();
            if (FILE_LETTERS.includes(key)) {
                message = `${key} comes from a move starting on the ${key}-file.`;
                highlightFile = key;
                messageTimer = setTimeout(clearGuidance, 1500);
                return;
            }
            if (guesses[currentRow].length < 5) { guesses[currentRow] += key; guesses = guesses; saveGame(); }
        } else if (key === "Backspace") undo();
        else if (key === "Enter") submit();
    }

    function handleWindowKeydown(event) {
        if ($showInstructions || $gameOver || promotionPending) {
            event.preventDefault();
            return;
        }
        input(event.key);
    }

    function chessLetter(event) {
        if (guesses[currentRow].length >= 5) return;
        previewLetter = "";
        actions = [...actions, event.detail];
        mated = event.detail.mated || false;
        guesses[currentRow] += event.detail.letter;
        guesses = guesses;
        if (!event.detail.pending) saveGame();
    }

    function resolveChessMove(event) {
        const action = actions[event.detail.index];
        if (!action) return;
        actions = actions.map((item, index) => index === event.detail.index
            ? { ...item, reply: event.detail.reply, mated: event.detail.mated, pending: false }
            : item);
        mated = event.detail.mated || false;
        saveGame();
    }

    function handlePromotion(event) {
        promotionPending = event.detail.active;
    }

    function undo() {
        previewLetter = "";
        const guess = guesses[currentRow];
        if (!guess) return;
        const letter = guess.at(-1);
        guesses[currentRow] = guess.slice(0, -1);
        if (FILE_LETTERS.includes(letter)) {
            actions = actions.slice(0, -1);
            if (mated) mated = false;
        }
        guesses = guesses;
        saveGame();
    }

    function submit() {
        const guess = guesses[currentRow];
        if (guess.length < 5) { message = "Not enough letters"; return; }
        if (!possibilities.includes(guess.toLowerCase())) { message = `${guess} not in word list`; return; }
        const result = scoreWord(guess, answer);
        let chessIndex = 0;
        for (let i = 0; i < guess.length; i++) {
            if (!FILE_LETTERS.includes(guess[i])) continue;
            const action = actions[chessIndex++];
            if (action && action.moveCorrect === false && result[i] === 2) result[i] = 1;
        }
        statuses[currentRow] = result; statuses = statuses;
        const nextKeyStatuses = { ...keyStatuses };
        for (let i = 0; i < guess.length; i++) {
            const letter = guess[i];
            nextKeyStatuses[letter] = Math.max(nextKeyStatuses[letter] ?? -1, result[i]);
        }
        keyStatuses = nextKeyStatuses;
        if (result.every((x) => x === 2) || currentRow === ROWS - 1) { showInstructions.set(false); gameOver.set(true); saveGame(true); return; }
        currentRow += 1;
        actions = [];
        saveGame(false);
    }
</script>

<GameError {message} />
<Instructions />
<div class="meta"><span>Puzzle {String(selectedDay).padStart(4, "0")}</span><span>{dateLabel}</span><span>Attempt {currentRow + 1}/{ROWS}</span></div>
<GameOver word={answer} {statuses} day={selectedDay} attempts={currentRow + 1} />
<div class="guesses">
    {#each guesses as guess, index}
        <Guess status={statuses[index]} word={guess} active={index === currentRow} compact={index !== currentRow} previewLetter={index === currentRow ? previewLetter : ""} />
    {/each}
</div>
<Chess fen={game.fen} movesString={game.moves} {actions} {mated} {pieceSet} disabled={mated || engineThinking || promotionPending || guesses[currentRow].length >= 5} {highlightFile} on:move={chessLetter} on:resolve={resolveChessMove} on:thinking={(event) => engineThinking = event.detail.active} on:promotion={handlePromotion} on:preview={(event) => previewLetter = event.detail.letter} />
{#if guesses[currentRow].length >= 5 && !$gameOver}<p class="row-ready">Row complete · press Enter to submit or Backspace to revise.</p>{/if}
<p class="rule">A–H are played from the board.</p>
<Keyboard {keyStatuses} on:key={(event) => input(event.detail.key)} />
<svelte:window on:keydown={handleWindowKeydown} on:click={clearGuidance} />

<style>
    .meta { display: flex; justify-content: center; gap: 0.55rem; padding: 0.5rem 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); color: var(--muted); font: 700 0.68rem/1 var(--mono); font-variant-numeric: tabular-nums; letter-spacing: 0.04em; text-align: center; text-transform: uppercase; }
    .meta span + span::before { content: "·"; margin-right: 0.55rem; color: var(--burgundy); }
    .rule { max-width: 30rem; margin: 0.9rem auto 0; padding-top: 0.65rem; border-top: 1px solid var(--line); text-align: center; color: var(--muted); font: 700 0.7rem/1 var(--sans); letter-spacing: 0.08em; text-transform: uppercase; }
    .row-ready { margin: 0.55rem auto -0.3rem; color: var(--burgundy); text-align: center; font: 700 0.7rem/1.25 var(--sans); letter-spacing: 0.04em; }
    .guesses { display: flex; flex-direction: column; align-items: center; gap: .25rem; margin: 0.4rem 0 0; }
    @media (max-width: 510px) {
        .meta { gap: 0.2rem; font-size: 0.56rem; }
        .meta span + span::before { margin-right: 0.2rem; }
        .rule { display: none; }
        .row-ready { margin: 0.45rem auto 0; font-size: 0.64rem; }
        :global(.keyboard) { margin-top: 1rem; }
    }
    @media (max-width: 420px) and (max-height: 760px) {
        .guesses { gap: 0.18rem; margin-top: 0.25rem; }
        :global(.keyboard) { margin-top: 0.15rem; }
    }
</style>
