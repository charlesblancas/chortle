<script>
    import Chess from "./Chess.svelte";
    import Guess from "./Guess.svelte";
    import Instructions from "./Instructions.svelte";
    import GameOver from "./GameOver.svelte";
    import Keyboard from "./Keyboard.svelte";
    import GameError from "./GameError.svelte";
    import SolutionViewer from "./SolutionViewer.svelte";
    import { games } from "../games/final_games";
    import { possibilities } from "../games/possibilities";
    import { gameOver, showInstructions } from "../stores";
    import { dailyPuzzleIndex, isSolvedGuess, playerMoves, scoreWord, shouldHandleWordGameKey } from "../gameRules";
    import { gameStorageKey, readSavedGame, removeSavedGame, safeStorage, writeSavedGame } from "./gameStorage";
    import { onMount, tick } from "svelte";

    const FILE_LETTERS = "ABCDEFGH";
    export let fixture = null;
    export let dayOverride = NaN;
    export let pieceSet = "cburnett";
    const storage = safeStorage();
    const ROWS = 5;
    let guesses = Array(ROWS).fill("");
    if (fixture?.initialGuess) guesses[0] = fixture.initialGuess.toUpperCase();
    let statuses = Array.from({ length: ROWS }, () => Array(5).fill(-1));
    let currentRow = 0;
    let actions = fixture?.initialActions ? [...fixture.initialActions] : [];
    let actionHistory = Array.from({ length: ROWS }, () => []);
    let solved = Boolean(fixture?.autoSubmit);
    if (fixture?.autoSubmit) {
        statuses[0] = scoreWord(guesses[0], fixture.game.word.toUpperCase());
        actionHistory[0] = actions.map((action) => ({ ...action }));
    }
    let previewLetter = "";
    let keyStatuses = {};
    let message = "";
    let highlightFile = "";
    let engineThinking = false;
    let messageTimer;
    const day = dailyPuzzleIndex();
    const selectedDay = Number.isFinite(dayOverride) ? Math.max(1, Math.floor(dayOverride)) : day;
    const dailyGame = games[(selectedDay - 1) % games.length];
    $: game = fixture?.game || dailyGame;
    $: answer = game.word.toUpperCase();
    $: solutionMoves = playerMoves(game.moves);
    let mated = fixture?.mated || false;
    let terminal = fixture?.terminal || fixture?.mated || false;
    let promotionPending = false;
    let solutionViewing = false;
    let hydrated = false;
    let autoResultSubscription;
    const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
    $: storageKey = gameStorageKey(selectedDay, game);

    function saveGame(completed = $gameOver) {
        if (!hydrated || fixture) return;
        writeSavedGame(storage, storageKey, { guesses, statuses, currentRow, actions, actionHistory, keyStatuses, mated, terminal, solved, completed });
    }

    onMount(() => {
        if (!fixture) {
            const saved = readSavedGame(storage, storageKey);
            if (saved) {
                guesses = saved.guesses;
                statuses = saved.statuses;
                currentRow = saved.currentRow;
                actions = saved.actions;
                actionHistory = saved.actionHistory;
                keyStatuses = saved.keyStatuses;
                mated = saved.mated;
                terminal = saved.terminal || saved.mated;
                solved = saved.solved;
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
            if (fixture?.autoSubmit) {
                // Let the first-use instructions claim the first modal slot.
                // The solved result appears after those instructions close.
                tick().then(() => {
                    if ($showInstructions) {
                        autoResultSubscription = showInstructions.subscribe((visible) => {
                            if (!visible) {
                                gameOver.set(true);
                                autoResultSubscription?.();
                                autoResultSubscription = undefined;
                            }
                        });
                    } else {
                        gameOver.set(true);
                    }
                });
            } else {
                gameOver.set(false);
            }
        }
        hydrated = true;
        return () => autoResultSubscription?.();
    });

    function clearGuidance() {
        message = "";
        highlightFile = "";
        clearTimeout(messageTimer);
    }

    function input(key) {
        if ($showInstructions || $gameOver || engineThinking || promotionPending) return;
        if ((mated || terminal) && key !== "Backspace") {
            clearGuidance();
            message = "Position ended. Press Backspace to revise your last move.";
            return;
        }
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
        // Let open dialogs own Tab, Escape, Enter, and button shortcuts.  In
        // particular, preventing these here breaks the modal focus trap and
        // can make the promotion chooser impossible to cancel.
        if ($showInstructions || $gameOver || promotionPending) return;
        if (!shouldHandleWordGameKey(event)) return;
        event.preventDefault();
        input(event.key);
    }

    function chessLetter(event) {
        if (guesses[currentRow].length >= 5) return;
        previewLetter = "";
        actions = [...actions, event.detail];
        mated = event.detail.mated || false;
        terminal = event.detail.terminal || false;
        guesses[currentRow] += event.detail.letter;
        guesses = guesses;
        if (!event.detail.pending) saveGame();
    }

    function resolveChessMove(event) {
        const action = actions[event.detail.index];
        if (!action) return;
        actions = actions.map((item, index) => index === event.detail.index
            ? { ...item, reply: event.detail.reply, mated: event.detail.mated, terminal: event.detail.terminal, pending: false }
            : item);
        mated = event.detail.mated || false;
        terminal = event.detail.terminal || false;
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
            mated = false;
            terminal = false;
        }
        guesses = guesses;
        saveGame();
    }

    function submit() {
        const guess = guesses[currentRow];
        if (guess.length < 5) { message = "Not enough letters"; return; }
        if (!possibilities.includes(guess.toLowerCase())) { message = `${guess} not in word list`; return; }
        const result = scoreWord(guess, answer);
        actionHistory[currentRow] = actions.map((action) => ({ ...action }));
        actionHistory = actionHistory;
        statuses[currentRow] = result; statuses = statuses;
        const nextKeyStatuses = { ...keyStatuses };
        for (let i = 0; i < guess.length; i++) {
            const letter = guess[i];
            nextKeyStatuses[letter] = Math.max(nextKeyStatuses[letter] ?? -1, result[i]);
        }
        keyStatuses = nextKeyStatuses;
        solved = isSolvedGuess(result, guess, actions);
        if (solved || currentRow === ROWS - 1) { showInstructions.set(false); gameOver.set(true); saveGame(true); return; }
        if (result.every((x) => x === 2)) message = "Word right. Replay it with the right board moves.";
        currentRow += 1;
        actions = [];
        // A reply can checkmate the player.  That only locks the current
        // board row; the next guess starts from the puzzle position again.
        mated = false;
        terminal = false;
        promotionPending = false;
        saveGame(false);
    }

    function resetDebugGame() {
        if (!fixture) removeSavedGame(storage, storageKey);
        window.location.reload();
    }

    function openSolution() {
        solutionViewing = true;
    }

    function closeSolution() {
        solutionViewing = false;
    }
</script>

<Instructions />
<div class="meta"><span>Puzzle {String(selectedDay).padStart(4, "0")}</span><span>{dateLabel}</span><span>Attempt {currentRow + 1}/{ROWS}</span></div>
<GameOver word={answer} {statuses} {guesses} {actionHistory} {solutionMoves} {solved} day={selectedDay} attempts={currentRow + 1} {solutionViewing} on:viewSolution={openSolution} on:reset={resetDebugGame} />
<div class="guesses">
    {#each guesses as guess, index}
        <Guess status={statuses[index]} word={guess} active={index === currentRow} previewLetter={index === currentRow ? previewLetter : ""} actions={index === currentRow ? actions : actionHistory[index]} {solutionMoves} />
    {/each}
</div>
<GameError {message} />
{#if $gameOver && solved}
    <SolutionViewer fen={game.fen} movesString={game.moves} {pieceSet} interactive={solutionViewing} on:close={closeSolution} />
{:else}
    <Chess fen={game.fen} movesString={game.moves} {actions} {mated} {terminal} {pieceSet} disabled={mated || terminal || engineThinking || promotionPending || guesses[currentRow].length >= 5} {highlightFile} on:move={chessLetter} on:resolve={resolveChessMove} on:thinking={(event) => engineThinking = event.detail.active} on:promotion={handlePromotion} on:preview={(event) => previewLetter = event.detail.letter} />
    {#if guesses[currentRow].length >= 5 && !$gameOver}<p class="row-ready">Row complete · press Enter to submit or Backspace to revise.</p>{/if}
    <p class="rule">A–H are played from the board.</p>
    <Keyboard {keyStatuses} on:key={(event) => input(event.detail.key)} />
{/if}
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
        .guesses { gap: 0.18rem; margin-top: 0.25rem; }
        :global(.keyboard) { margin-top: 0; }
    }
    @media (max-width: 420px) and (max-height: 760px) {
        .guesses { gap: 0.18rem; margin-top: 0.25rem; }
        :global(.keyboard) { margin-top: 0.15rem; }
    }
</style>
