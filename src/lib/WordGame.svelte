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
    import { dailyPuzzleIndex, playerMoves, shouldHandleWordGameKey } from "../gameRules";
    import { browserStorage, gameStorageKey, removeSavedGame, safeStorage } from "./gameStorage";
    import { onMount, onDestroy, tick } from "svelte";
    import { createDailyPuzzleSession } from "./dailyPuzzleSession.js";
    import QueuedChessBoard from "./QueuedChessBoard.svelte";
    import { fitGameplayViewport } from "./fitGameplayViewport.js";

    export let fixture = null;
    export let dayOverride = NaN;
    export let pieceSet = "cburnett";
    const storage = safeStorage();
    let previewLetter = "";
    let gameBoard;
    let lineStatus;
    const day = dailyPuzzleIndex();
    const selectedDay = Number.isFinite(dayOverride) ? Math.max(1, Math.floor(dayOverride)) : day;
    const dailyGame = games[(selectedDay - 1) % games.length];
    const game = fixture?.game || dailyGame;
    const answer = game.word.toUpperCase();
    const solutionMoves = playerMoves(game.moves);
    // Keep the existing queue-game namespace; legacy direct-entry saves stay intact.
    const storageKey = gameStorageKey(selectedDay, game) + ":line";
    const session = createDailyPuzzleSession({ game, storage, storageKey, legacyStorageKey: gameStorageKey(selectedDay, game), fixture, day: selectedDay, isWord: word => possibilities.includes(word) });
    $: ({ guesses, statuses, currentRow, actions, actionHistory, keyStatuses, mated, terminal, solved, extraMoves,
        message, highlightFile, thinking: engineThinking, promotionPending, requiredMoves, restoredCompleted } = $session);
    $: ROWS = guesses.length;
    let solutionViewing = false;
    let hydrated = false;
    let autoResultSubscription;
    const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(new Date());
    $: replayStateKey = `chortle:replay-state:${fixture?.id || storageKey}`;
    $: solutionViewKey = `chortle:replay-open:${fixture?.id || storageKey}`;

    function replaySessionStorage() {
        // Keep the replay open/position across an app switch that causes the
        // browser to discard and recreate the page.  localStorage is still
        // scoped to this origin, and safeStorage gracefully falls back to a
        // no-op in private/blocked-storage contexts.
        return browserStorage("localStorage");
    }

    function legacyReplaySessionStorage() {
        return browserStorage("sessionStorage");
    }

    function restoreSolutionView() {
        const saved = replaySessionStorage().getItem(solutionViewKey)
            || legacyReplaySessionStorage().getItem(solutionViewKey);
        solutionViewing = saved === "open";
    }

    onMount(() => {
        restoreSolutionView();
        if (!fixture) {
            if (restoredCompleted) {
                // Let child components receive the restored rows before the
                // result modal opens for the completed state. This keeps
                // a completed game visible, including its result grid, after
                // a refresh.
                tick().then(() => {
                    gameOver.set(true);
                    showInstructions.set(false);
                });
            } else {
                gameOver.set(false);
                closeSolution();
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
                closeSolution();
            }
        }
        hydrated = true;
        return () => autoResultSubscription?.();
    });

    onDestroy(() => session.destroy());
    let completionPresented = false;
    $: if (hydrated && $session.completed && !fixture?.autoSubmit && !completionPresented) {
        completionPresented = true;
        showInstructions.set(false);
        gameOver.set(true);
    }
    function clearGuidance() { session.clearGuidance(); }
    function input(key) {
        if ($showInstructions || $gameOver || engineThinking || promotionPending) return;
        previewLetter = "";
        gameBoard?.clearSelection();
        session.input(key);
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

    function focusLineInput(event) {
        // Keep DOM focus concerns outside the session.
        if (event?.detail.keyboard || document.activeElement?.closest('.square-controls')) tick().then(() => lineStatus?.focus());
    }
    function undoBoardMove() {
        if ($showInstructions || $gameOver) return;
        previewLetter = "";
        session.undoMove();
    }

    function resetDebugGame() {
        if (!fixture) removeSavedGame(storage, storageKey);
        replaySessionStorage().removeItem(solutionViewKey);
        replaySessionStorage().removeItem(replayStateKey);
        legacyReplaySessionStorage().removeItem(solutionViewKey);
        legacyReplaySessionStorage().removeItem(replayStateKey);
        window.location.reload();
    }

    function openSolution() {
        solutionViewing = true;
        replaySessionStorage().setItem(solutionViewKey, "open");
        legacyReplaySessionStorage().removeItem(solutionViewKey);
    }

    function closeSolution() {
        solutionViewing = false;
        replaySessionStorage().removeItem(solutionViewKey);
        legacyReplaySessionStorage().removeItem(solutionViewKey);
    }
</script>

<Instructions {pieceSet} />
<div class="meta"><span>Puzzle {String(selectedDay).padStart(4, "0")}</span><span>{dateLabel}</span><span>Attempt {currentRow + 1}/{ROWS}</span></div>
<GameOver word={answer} {statuses} {guesses} {actionHistory} {solutionMoves} {solved} {extraMoves} day={selectedDay} attempts={currentRow + 1} maxAttempts={ROWS} {solutionViewing} on:viewSolution={openSolution} on:reset={resetDebugGame} />
<div class="game-play" use:fitGameplayViewport class:history-compact={currentRow > 0} class:four-guesses={ROWS === 4} class:solution-board={$gameOver}>
    <div class="guesses">
        {#each guesses as guess, index}
            <div class="guess-row" class:active-row={index === currentRow} class:history-row={index < currentRow} class:unused-row={index > currentRow}>
                <Guess status={statuses[index]} word={guess} active={index === currentRow} previewLetter={index === currentRow ? previewLetter : ""} actions={index === currentRow ? actions : actionHistory[index]} {solutionMoves} />
            </div>
        {/each}
    </div>
    <GameError {message} />
    {#if $gameOver}
        <SolutionViewer fen={game.fen} movesString={game.moves} {pieceSet} {replayStateKey} interactive={solutionViewing && !$showInstructions} on:close={closeSolution} />
    {:else}
        <div class="live-play">
            <QueuedChessBoard {actions} {requiredMoves} placedMoves={$session.placedMoves} disabled={guesses[currentRow].length >= 5 || engineThinking || promotionPending || $showInstructions} undoDisabled={engineThinking || promotionPending || $showInstructions} bind:statusElement={lineStatus} on:place={(event) => input(event.detail)} on:undo={undoBoardMove}>
            <Chess bind:this={gameBoard} fen={game.fen} {session} position={$session} {mated} {terminal} {pieceSet} disabled={$showInstructions || $session.boardDisabled} {highlightFile} on:commit={focusLineInput} on:promotion={(event) => session.setPromotionPending(event.detail.active)} />
            </QueuedChessBoard>
            <Keyboard {keyStatuses} on:key={(event) => input(event.detail.key)} />
        </div>
    {/if}
</div>
<svelte:window on:keydown={handleWindowKeydown} on:click={clearGuidance} />

<style>
    .game-play :global(.chess), .game-play :global(.replay-board) { max-width: min(100%, var(--viewport-board-limit, 100vw)); }
    .game-play:global(.viewport-compact) .guess-row.history-row,
    .game-play:global(.viewport-compact) .guess-row.unused-row {
        --guess-tile-height: 1.35rem !important;
        --guess-letter-size: 0.78rem !important;
        --guess-move-size: 0.36rem !important;
    }
    .meta { display: flex; justify-content: center; gap: 0.55rem; padding: 0.5rem 0; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); color: var(--muted); font: 700 0.68rem/1 var(--mono); font-variant-numeric: tabular-nums; letter-spacing: 0.04em; text-align: center; text-transform: uppercase; }
    .meta span + span::before { content: "·"; margin-right: 0.55rem; color: var(--burgundy); }
    .game-play { --mobile-chess-width: 32rem; }
    .guesses { display: flex; flex-direction: column; align-items: center; gap: .25rem; margin: 0.4rem 0 0; }
    @media (max-width: 510px) {
        .meta { gap: 0.2rem; font-size: 0.56rem; }
        .meta span + span::before { margin-right: 0.2rem; }
        .guesses { gap: 0.18rem; margin-top: 0.4rem; }
        :global(.keyboard) { margin-top: 0; }
        /* Keep all rows in the grid.  Non-active rows are compressed
            vertically, but retain the active row's column width and gaps so
            every letter stays aligned with its position above/below it. */
        .game-play { --mobile-chess-width: 16rem; --mobile-key-height: 2.1rem; }
        .game-play .guess-row.history-row,
        .game-play .guess-row.unused-row {
            --guess-tile-width: clamp(2.15rem, 13vw, 2.75rem);
            --guess-tile-height: 1.42rem;
            --guess-letter-size: 0.78rem;
            --guess-row-gap: 0.5rem;
            --guess-tile-gap: 0.3rem;
        }
        /* Keep the chess hint in submitted rows even when the phone layout
           compresses the tiles. Empty future rows have no hint to show. */
        .game-play .guess-row.history-row { --guess-move-size: 0.36rem; }
        .game-play .guess-row.unused-row { --guess-move-size: 0px; }
    }
    @media (max-width: 420px) {
        .guesses { gap: 0.05rem; margin-top: 0.4rem; }
    }
    @media (max-width: 420px) and (max-height: 760px) {
        :global(.keyboard) { margin-top: 0.15rem; }
        .game-play { --mobile-chess-width: 14rem; --mobile-key-height: 2rem; }
        .game-play .guess-row.history-row,
        .game-play .guess-row.unused-row { --guess-tile-height: 1.35rem; }
    }
    @media (max-width: 420px) and (max-height: 600px) {
        /* Leave room for the two-line row-complete hint on short phones. */
        .game-play { --mobile-chess-width: 13.25rem; }
    }
    /* Four square rows fit on taller phones. Use available height rather
       than width alone, so browser chrome and short phones retain the compact
       layout. Older saved five-guess games still use their existing layout. */
    @media (max-width: 420px) and (min-height: 655px) {
        .game-play.four-guesses:not(.solution-board) .guess-row.history-row,
        .game-play.four-guesses:not(.solution-board) .guess-row.unused-row {
            --guess-tile-height: clamp(2.15rem, 13vw, 2.75rem);
            --guess-letter-size: clamp(0.95rem, 4.5vw, 1.25rem);
            --guess-move-size: clamp(0.36rem, 1.7vw, 0.48rem);
        }
    }
    @media (min-width: 421px) and (max-width: 510px) and (min-height: 800px) {
        .game-play.four-guesses:not(.solution-board) .guess-row.history-row,
        .game-play.four-guesses:not(.solution-board) .guess-row.unused-row {
            --guess-tile-width: clamp(2.7rem, 10vw, 3.35rem);
            --guess-tile-height: clamp(2.7rem, 10vw, 3.35rem);
            --guess-letter-size: clamp(1.15rem, 4vw, 1.45rem);
            --guess-move-size: clamp(0.42rem, 1.5vw, 0.52rem);
        }
    }
    /* A 100%-zoom desktop browser is often only 1080px tall once its
       chrome is accounted for. Preserve full-size tiles and board at that
       width, but tighten the editorial spacing before the compact mobile
       treatment is needed. */
    @media (min-width: 511px) and (max-height: 1151px) {
        .meta { padding: 0.25rem 0; }
        .guesses { gap: 0.1rem; margin-top: 0.2rem; }
        :global(.chess) { margin-top: 0.5rem; }
        :global(.keyboard) { margin-top: 0.25rem; }
    }
    @media (min-width: 511px) and (max-height: 900px) {
        .game-play {
            --mobile-chess-width: min(32rem, 39vh);
            --guess-tile-size: clamp(1.9rem, 4.8vh, 3.1rem);
            --guess-row-gap: 0.2rem;
            --guess-tile-gap: 0.2rem;
        }
        .guesses { margin-top: 0.1rem; }
    }
    @media (min-width: 511px) and (max-height: 600px) {
        .game-play {
            --mobile-chess-width: min(32rem, 26vh);
            --guess-tile-size: clamp(1.25rem, 3.3vh, 1.5rem);
            --guess-row-gap: 0.08rem;
            --guess-tile-gap: 0.12rem;
        }
        .meta { padding: 0.08rem 0; font-size: 0.58rem; }
    }
</style>
