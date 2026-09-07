<script>
    import { createEventDispatcher, onMount, tick } from "svelte";
    import { Chess, SQUARES } from "chess.js";
    import { Chessground } from "svelte-chessground";
    import { isCanonicalPlayerMove, isPlayerMatedAfterReply } from "../gameRules";
    import { firstLegalReply, isUciMove } from "./fastChessEngine";
    import { sunfishReply, warmSunfish } from "./sunfishEngine";

    export let fen;
    export let movesString;
    export let actions = [];
    export let pieceSet = "cburnett";
    export let disabled = false;
    export let mated = false;
    // A terminal position can be a self-mate, checkmate of the opponent, or
    // a draw. Keep it separate from `mated` so an off-line move that ends the
    // game does not display the wrong banner or leave the row half-live.
    export let terminal = false;
    export let highlightFile = "";
    export let readOnly = false;
    export let replay = false;
    export let replayFen = "";
    export let replayMove = "";
    export let replayArrow = null;
    export let replayArrows = [];
    // Replay boards can be used as a small analysis board after the result
    // dialog closes. In that mode either side may make legal local moves;
    // those moves never enter the word-game action history.
    export let playable = false;
    const IMAGE_PIECE_SETS = new Set(["chessnut", "cburnett", "merida", "mono"]);
    const PIECE_CODES = ["P", "N", "B", "R", "Q", "K"];
    const dispatch = createEventDispatcher();
    const chess = new Chess();
    const line = movesString.split(" ");
    let chessground;
    let last = "";
    let selectedLetter = "";
    let selectedSquare = "";
    let engineThinking = false;
    let promotionPending = null;
    let promotionFirstButton;
    let boardVersion = 0;
    let pointerStart = null;
    let pointerMoved = false;
    const PROMOTION_CHOICES = [
        { role: "q", label: "Queen", shortLabel: "Q", white: "♕", black: "♛" },
        { role: "r", label: "Rook", shortLabel: "R", white: "♖", black: "♜" },
        { role: "b", label: "Bishop", shortLabel: "B", white: "♗", black: "♝" },
        { role: "n", label: "Knight", shortLabel: "N", white: "♘", black: "♞" },
    ];
    $: promotionChoices = PROMOTION_CHOICES.map((choice) => ({
        ...choice,
        symbol: promotionPending?.color === "b" ? choice.black : choice.white,
    }));
    $: boardFen = replay ? replayFen : fen;
    $: orientation = fen.split(" ")[1] === "w" ? "black" : "white";
    $: playerColor = orientation;
    $: files = orientation === "white" ? "ABCDEFGH".split("") : "HGFEDCBA".split("");
    $: ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    $: boardSquares = ranks.flatMap((rank) => files.map((file) => `${file.toLowerCase()}${rank}`));
    $: selectedDestinations = selectedSquare
        ? chess.moves({ square: selectedSquare, verbose: true }).map((move) => move.to)
        : [];
    $: highlightIndex = files.indexOf(highlightFile);
    $: pieceAssetStyle = IMAGE_PIECE_SETS.has(pieceSet)
        ? PIECE_CODES.flatMap((code) => [`--piece-w${code}: url('/pieces/${pieceSet}/w${code}.svg')`, `--piece-b${code}: url('/pieces/${pieceSet}/b${code}.svg')`]).join(";")
        : "";
    $: replayShapes = replayArrows.length ? replayArrows : replayArrow ? [replayArrow] : [];

    function destinations() {
        const result = new Map();
        SQUARES.forEach((square) => {
            const legal = chess.moves({ square, verbose: true });
            if (legal.length) result.set(square, legal.map((move) => move.to));
        });
        return result;
    }
    function apply(uci) {
        if (!isUciMove(uci)) return false;
        try {
            const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
            if (move) chessground.move(move.from, move.to);
            return Boolean(move);
        } catch {
            return false;
        }
    }
    function setup() {
        const turnColor = chess.turn() === "w" ? "white" : "black";
        const playerTurn = turnColor === playerColor;
        const canMove = !readOnly && !disabled && !terminal && !engineThinking && !promotionPending && (playable || playerTurn) && !chess.isGameOver();
        const config = {
            movable: { enabled: canMove, color: playable ? turnColor : playerColor, dests: destinations(), free: false },
            turnColor,
            viewOnly: readOnly || disabled || terminal || engineThinking || (!playable && !playerTurn) || Boolean(promotionPending),
        };
        if (replay) config.lastMove = replayMove ? [replayMove.slice(0, 2), replayMove.slice(2, 4)] : undefined;
        if (replay) config.drawable = { enabled: false, visible: true, autoShapes: replayShapes };
        // Chessground has already animated the pawn to its final rank when
        // the promotion chooser opens. Keep that visual move in place until
        // the player picks a piece; all other setup calls render the logic
        // board as usual.
        if (!promotionPending) config.fen = chess.fen();
        chessground.set(config);
    }
    function rebuild() {
        if (!chessground) return;
        const currentFen = replay ? replayFen : fen;
        if (promotionPending) {
            promotionPending = null;
            dispatch("promotion", { active: false });
        }
        chess.load(currentFen);
        boardVersion += 1;
        selectedLetter = "";
        selectedSquare = "";
        dispatch("preview", { letter: "" });
        chessground.set({
            fen: currentFen,
            orientation,
            coordinates: false,
            ...(replay ? { lastMove: replayMove ? [replayMove.slice(0, 2), replayMove.slice(2, 4)] : undefined } : {}),
            ...(replay ? { drawable: { enabled: false, visible: true, autoShapes: replayShapes } } : {}),
        });
        if (!replay) {
            apply(line[0]);
            actions.forEach((action) => { apply(action.uci); apply(action.reply); });
        }
        setup();
    }
    function beginPromotion(from, to) {
        const piece = chess.get(from);
        const promotionRank = to[1] === "1" || to[1] === "8";
        const legal = chess.moves({ square: from, verbose: true }).some((move) => move.to === to);
        if (!piece || piece.type !== "p" || !promotionRank || !legal) return false;
        promotionPending = { from, to, color: piece.color };
        selectedLetter = "";
        selectedSquare = "";
        dispatch("preview", { letter: "" });
        dispatch("promotion", { active: true });
        setup();
        return true;
    }
    async function commitMove(from, to, promotion = "", allowDisabled = false) {
        // The parent intentionally disables normal input while the chooser is
        // open. A selected promotion is the one move that must still be
        // committed before that prop has flushed back down to this component.
        if ((disabled && !allowDisabled) || (terminal && !allowDisabled) || engineThinking) return;
        const playerColor = chess.turn();
        let move;
        try {
            move = chess.move({ from, to, promotion });
        } catch {
            // A click handler and Chessground's own pointer handler can both
            // observe the same destination. The second observation is stale
            // after the first move has been applied, so ignore it safely.
            return;
        }
        if (!move) return;
        const uci = `${move.from}${move.to}${move.promotion || ""}`;
        if (replay && playable) {
            selectedLetter = "";
            selectedSquare = "";
            dispatch("preview", { letter: "" });
            dispatch("replayMove", { uci, san: move.san || move.lan || uci, fen: chess.fen() });
            setup();
            return;
        }
        const actionIndex = actions.length;
        // Once a player leaves the puzzle line, the position has diverged even
        // if they later happen to play the same UCI move as the canonical
        // continuation. Treat that move as off-line too so the engine keeps
        // replying and the letter receives the intended yellow semantics.
        const moveCorrect = isCanonicalPlayerMove(movesString, actions, uci);
        let reply = line[2 + actionIndex * 2];

        selectedLetter = "";
        selectedSquare = "";
        dispatch("preview", { letter: "" });
        // A few puzzle records intentionally end on the player's move. If
        // that move leaves a live position, we still need a reply so the board
        // returns to the player's turn instead of looking frozen. A genuinely
        // terminal position has no reply and can resolve immediately.
        const terminalAfterMove = chess.isGameOver();
        dispatch("move", {
            letter: move.from[0].toUpperCase(),
            uci,
            reply: "",
            moveCorrect,
            mated: false,
            terminal: terminalAfterMove,
            pending: !terminalAfterMove,
        });

        // No engine reply is possible once the player's move has ended the
        // position. This also covers an off-line checkmate/stalemate: waiting
        // for a reply that can never exist leaves the board looking frozen.
        if (terminalAfterMove) {
            // The move itself may have ended the position (for example a
            // puzzle line whose final move is checkmate).  Refresh
            // Chessground so it observes the terminal turn and cannot leave
            // stale destinations that look like a frozen board.
            setup();
            return;
        }

        engineThinking = true;
        setup();
        dispatch("thinking", { active: true });
        try {
            if (!moveCorrect) {
                try {
                    // Sunfish gives stronger tactical replies while running
                    // off the UI thread. Its deterministic search is seeded
                    // only by the current position, so the same mistake
                    // always receives the same response.
                    reply = await sunfishReply(chess.fen(), 2);
                } catch {
                    reply = "";
                }
            }
            // Never unlock the board until the reply has actually been
            // applied. A malformed or stale engine response must not leave
            // the side-to-move on the opponent, which looks like the player
            // can move black pieces next.
            let replyApplied = reply ? apply(reply) : false;
            if (!replyApplied) {
                // Sunfish can time out, a saved line can contain a stale reply,
                // or a correct line can simply end before the opponent reply.
                // Always recover with a legal deterministic move when one
                // exists, so the board returns to the player's turn.
                const fallbackReply = firstLegalReply(chess.fen());
                replyApplied = Boolean(fallbackReply && apply(fallbackReply));
                reply = replyApplied ? fallbackReply : "";
            }
            const matedAfterReply = isPlayerMatedAfterReply(chess, playerColor, reply);
            dispatch("resolve", { index: actionIndex, reply, mated: matedAfterReply, terminal: chess.isGameOver() });
        } finally {
            engineThinking = false;
            dispatch("thinking", { active: false });
            setup();
        }
    }
    async function after(from, to) {
        if (readOnly || disabled || engineThinking || promotionPending) return;
        if (beginPromotion(from, to)) return;
        commitMove(from, to);
    }
    function choosePromotion(role) {
        if (!promotionPending) return;
        const pending = promotionPending;
        // Restore the logic position before asking Chessground to animate the
        // now-valid promoted move. The pawn was only moved visually so far.
        chessground.set({ fen: chess.fen(), orientation, coordinates: false });
        promotionPending = null;
        dispatch("promotion", { active: false });
        commitMove(pending.from, pending.to, role, true);
    }
    function cancelPromotion() {
        if (!promotionPending) return;
        promotionPending = null;
        dispatch("promotion", { active: false });
        chessground.set({ fen: chess.fen(), orientation, coordinates: false });
        setup();
    }
    function focusPromotionButton(node, enabled) {
        if (!enabled) return {};
        promotionFirstButton = node;
        tick().then(() => node.focus());
        return {
            destroy: () => {
                if (promotionFirstButton === node) promotionFirstButton = null;
            },
        };
    }
    function handlePromotionKeydown(event) {
        if (!promotionPending || event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        cancelPromotion();
    }
    function showFile(event) {
        if (!event.clientX || !event.clientY) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const column = Math.min(7, Math.floor((event.clientX - rect.left) / rect.width * 8));
        const row = Math.min(7, Math.floor((event.clientY - rect.top) / rect.height * 8));
        const file = files[column].toLowerCase();
        const rank = String(ranks[row]);
        const square = `${file}${rank}`;
        if (selectedSquare === square) {
            selectedLetter = "";
            selectedSquare = "";
            dispatch("preview", { letter: "" });
            return;
        }
        const isLegalOrigin = chess.moves({ square, verbose: true }).length > 0;
        selectedLetter = isLegalOrigin ? file.toUpperCase() : "";
        selectedSquare = isLegalOrigin ? square : "";
        dispatch("preview", { letter: selectedLetter });
    }
    function clearSquareSelection() {
        selectedLetter = "";
        selectedSquare = "";
        dispatch("preview", { letter: "" });
    }
    function squarePieceLabel(square) {
        const piece = chess.get(square);
        if (!piece) return "empty square";
        const names = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };
        return `${piece.color === "w" ? "white" : "black"} ${names[piece.type]}`;
    }
    function squareLabel(square, stateSignature) {
        if (!stateSignature) return square.toUpperCase();
        const coordinate = square.toUpperCase();
        const piece = squarePieceLabel(square);
        if (selectedSquare === square) return `${coordinate}, ${piece}; selected starting square, activate again to clear`;
        if (selectedSquare) return `${coordinate}, ${piece}; ${selectedDestinations.includes(square) ? "legal destination" : "not a legal destination"}`;
        return `${coordinate}, ${piece}; ${chess.moves({ square, verbose: true }).length ? "select to choose a move" : "no legal move"}`;
    }
    function squareDisabled(square, stateSignature) {
        if (!stateSignature) return true;
        if (readOnly || disabled || engineThinking || promotionPending) return true;
        if (selectedSquare) return selectedSquare !== square && !selectedDestinations.includes(square);
        return chess.moves({ square, verbose: true }).length === 0;
    }
    function chooseSquare(square) {
        if (squareDisabled(square, squareStateSignature)) return;
        if (selectedSquare === square) {
            clearSquareSelection();
            return;
        }
        if (selectedSquare) {
            if (selectedDestinations.includes(square)) after(selectedSquare, square);
            return;
        }
        selectedSquare = square;
        selectedLetter = square[0].toUpperCase();
        dispatch("preview", { letter: selectedLetter });
    }
    function fileHint(node) {
        const clear = () => {
            selectedLetter = "";
            selectedSquare = "";
            dispatch("preview", { letter: "" });
        };
        const onBoardClick = () => {
            requestAnimationFrame(() => {
                if (!selectedSquare && !node.querySelector("square.selected")) clear();
            });
        };
        const clearPreview = (event) => {
            if (event.type === "keydown" ? event.key === "Escape" : !node.contains(event.target)) {
                clear();
            }
        };
        node.addEventListener("click", onBoardClick);
        document.addEventListener("click", clearPreview);
        document.addEventListener("keydown", clearPreview);
        return {
            destroy: () => {
                node.removeEventListener("click", onBoardClick);
                document.removeEventListener("click", clearPreview);
                document.removeEventListener("keydown", clearPreview);
            },
        };
    }
    function rememberPointer(event) {
        pointerStart = { x: event.clientX, y: event.clientY };
        pointerMoved = false;
    }
    function trackPointer(event) {
        if (!pointerStart) return;
        pointerMoved ||= Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6;
    }
    function handleBoardClick(event) {
        if (pointerMoved) {
            pointerStart = null;
            pointerMoved = false;
            return;
        }
        pointerStart = null;
        const rect = event.currentTarget.getBoundingClientRect();
        const column = Math.floor(((event.clientX - rect.left) / rect.width) * 8);
        const row = Math.floor(((event.clientY - rect.top) / rect.height) * 8);
        if (column < 0 || column > 7 || row < 0 || row > 7) return;
        chooseSquare(`${files[column].toLowerCase()}${ranks[row]}`);
    }
    // Replaying the whole position is only necessary when the move history
    // changes.  `disabled` changes as a guess fills up (especially between
    // letters four and five), and rebuilding on that transition made the
    // board visibly jump/reset even though no chess move had happened.
    $: signature = JSON.stringify({ actions, replay, replayFen, replayMove, replayArrow, replayArrows });
    $: if (chessground && signature !== last) { last = signature; rebuild(); }
    $: interactionSignature = `${disabled}:${readOnly}:${playable}:${engineThinking}:${Boolean(promotionPending)}`;
    $: squareStateSignature = `${boardVersion}:${boardFen}:${interactionSignature}:${selectedSquare}:${selectedDestinations.join(",")}`;
    $: if (chessground && last === signature && interactionSignature) setup();
    onMount(() => {
        rebuild();
        last = signature;
        if (!readOnly) warmSunfish();
    });
</script>

<section class="chess" aria-labelledby="chess-title" aria-describedby="chess-help">
    <h2 id="chess-title" class="sr-only">Chess board</h2>
    <p id="chess-help" class="sr-only">Select a legal piece and then its destination. Mouse and touch users can move directly on the board. Keyboard users can use the labelled square controls after the board.</p>
    <div class="board-grid">
        <div class="rank-labels" aria-hidden="true">{#each ranks as rank}<span>{rank}</span>{/each}</div>
        <div class="board" class:piece-set-glyph={pieceSet === "glyph"} class:piece-set-image={IMAGE_PIECE_SETS.has(pieceSet)} class:piece-set-cburnett={pieceSet === "cburnett"} style={pieceAssetStyle} use:fileHint>
            {#if highlightIndex >= 0}<div class="file-highlight" style={`left: ${highlightIndex * 12.5}%`}></div>{/if}
            <div class="board-visual" aria-hidden="true" on:pointerdown={rememberPointer} on:pointermove={trackPointer} on:click={handleBoardClick}><Chessground bind:this={chessground} coordinates={false} config={{ movable: { events: { after } } }} /></div>
            {#if mated}<div class="mate-banner" role="status">You are mated.</div>
            {:else if terminal}<div class="mate-banner" role="status">Position ended.</div>{/if}
            {#if promotionPending}
                <div class="promotion-layer" role="presentation" on:click|stopPropagation>
                    <div class="promotion-dialog" role="dialog" aria-modal="true" aria-labelledby="promotion-title" tabindex="-1">
                        <p id="promotion-title" class="promotion-title">Choose a piece</p>
                        <p class="promotion-move">{promotionPending.from.toUpperCase()} → {promotionPending.to.toUpperCase()}</p>
                        <div class="promotion-options">
                            {#each promotionChoices as choice, index}
                                <button type="button" class="promotion-choice" aria-label={`Promote to ${choice.label}`} use:focusPromotionButton={index === 0} on:click|stopPropagation={() => choosePromotion(choice.role)}>
                                    {#if pieceSet === "glyph"}
                                        <span class="promotion-piece" aria-hidden="true">{choice.symbol}</span>
                                    {:else if pieceSet === "cburnett"}
                                        <span class="promotion-piece promotion-piece-image" aria-hidden="true"><img src={`/pieces/cburnett/${promotionPending.color === "b" ? "b" : "w"}${choice.shortLabel}.svg`} alt="" /></span>
                                    {:else}
                                        <span class="promotion-piece promotion-piece-image" aria-hidden="true"><img src={`/pieces/${pieceSet}/${promotionPending.color === "b" ? "b" : "w"}${choice.shortLabel}.svg`} alt="" /></span>
                                    {/if}
                                    <span class="promotion-label" aria-hidden="true">{choice.shortLabel}</span>
                                </button>
                            {/each}
                        </div>
                        <button type="button" class="promotion-cancel" on:click|stopPropagation={cancelPromotion}>Cancel move</button>
                    </div>
                </div>
            {/if}
        </div>
        <div class="file-labels" aria-hidden="true">{#each files as file}<span>{file}</span>{/each}</div>
    </div>
    <div class="square-controls sr-only" aria-label="Keyboard chess move controls">
        {#each boardSquares as square}
            <button class="square-control" type="button" aria-label={squareLabel(square, squareStateSignature)} disabled={squareDisabled(square, squareStateSignature)} on:click={() => chooseSquare(square)}>{square.toUpperCase()}</button>
        {/each}
    </div>
    <span class="sr-only" aria-live="polite">{selectedLetter ? `This move writes ${selectedLetter}` : ""}</span>
</section>
<svelte:window on:keydown={handlePromotionKeydown} />

<style>
    .chess { width: min(100%, 32rem); margin: clamp(0.65rem, 4vw, 1.75rem) auto 0; }
    .board-grid { position: relative; display: block; padding-bottom: 1.55rem; }
    .board { position: relative; width: 100%; aspect-ratio: 1; overflow: hidden; background: #e9e5db; container-type: inline-size; }
    .file-highlight { position: absolute; z-index: 2; top: 0; bottom: 0; width: 12.5%; pointer-events: none; background: rgba(112, 45, 49, 0.1); box-shadow: inset 0 0 0 2px rgba(112, 45, 49, 0.55); }
    .mate-banner { position: absolute; z-index: 4; top: 50%; left: 50%; width: min(82%, 18rem); box-sizing: border-box; transform: translate(-50%, -50%); padding: 1rem 0.8rem; background: rgba(239, 236, 226, 0.9); border-block: 2px solid var(--burgundy); color: var(--burgundy); text-align: center; font: 700 1.05rem/1.1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; pointer-events: none; }
    .promotion-layer { position: absolute; z-index: 6; inset: 0; display: grid; place-items: center; padding: 0.7rem; background: rgba(38, 50, 56, 0.34); }
    .promotion-dialog { width: min(100%, 19rem); padding: 0.8rem 0.75rem 0.65rem; border: 1px solid var(--ink); border-top: 3px solid var(--burgundy); background: var(--panel); color: var(--ink); text-align: center; }
    .promotion-title { margin: 0; font: 700 0.86rem/1 var(--sans); letter-spacing: 0.1em; text-transform: uppercase; }
    .promotion-move { margin: 0.35rem 0 0.7rem; color: var(--muted); font: 700 0.68rem/1 var(--mono); letter-spacing: 0.08em; }
    .promotion-options { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3rem; }
    .promotion-choice { display: flex; min-width: 0; min-height: 4.1rem; flex-direction: column; align-items: center; justify-content: center; gap: 0.18rem; padding: 0.25rem 0.1rem; border-color: var(--line); background: var(--main); text-transform: none; }
    .promotion-piece { display: grid; width: 2.35rem; height: 2.35rem; place-items: center; font: 2rem/0.95 Georgia, "Times New Roman", serif; }
    .promotion-piece-image img { width: 100%; height: 100%; object-fit: contain; }
    .promotion-label { font: 700 0.58rem/1 var(--mono); letter-spacing: 0.08em; }
    .promotion-cancel { margin-top: 0.55rem; padding: 0.25rem 0.45rem; border-color: transparent; color: var(--muted); font-size: 0.62rem; text-transform: none; text-decoration: underline; }
    @media (hover: hover) {
        .promotion-choice:hover { border-color: var(--burgundy); background: var(--burgundy); color: var(--panel); }
        .promotion-cancel:hover { border-color: transparent; background: transparent; color: var(--burgundy); }
    }
    .rank-labels { position: absolute; top: 0; bottom: 1.55rem; left: -1.65rem; display: grid; grid-template-rows: repeat(8, 1fr); align-items: center; justify-items: end; width: 1.1rem; color: var(--burgundy); font: 700 0.72rem/1 var(--mono); font-variant-numeric: tabular-nums; }
    .file-labels { position: absolute; right: 0; bottom: 0; left: 0; height: 1.55rem; display: grid; grid-template-columns: repeat(8, 1fr); place-items: center; color: var(--burgundy); font: 700 0.72rem/1 var(--mono); letter-spacing: 0.03em; }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
    .board-visual, .board-visual :global(.cg-wrap) { width: 100%; height: 100%; }
    .board :global(cg-board) { background-color: #e9e5db !important; background-image: url('/board-diagram.svg?v=problem-diagram') !important; background-position: center !important; background-size: cover !important; }
    .board :global(cg-board square.last-move) { background: rgba(112, 45, 49, 0.16); }
    .board :global(cg-board square.selected) { background: rgba(112, 45, 49, 0.28); box-shadow: inset 0 0 0 2px var(--burgundy); }
    .board :global(cg-board square.move-dest) {
        background-color: transparent !important;
        background-image: radial-gradient(circle at center, rgba(112, 45, 49, 0.82) 0 10%, transparent 11%) !important;
    }
    .board :global(cg-board square.move-dest.oc) {
        background-image: radial-gradient(circle at center, transparent 0 48%, rgba(112, 45, 49, 0.86) 50% 55%, transparent 57%) !important;
    }
    .board :global(cg-board square.move-dest:hover) { background-color: rgba(112, 45, 49, 0.12) !important; }
    .board :global(.cg-wrap piece) { opacity: 0.96; background-position: center !important; background-repeat: no-repeat !important; background-size: 92% !important; }
    /* Use the same typographic pieces in the chooser and on the board. This
       keeps the set visually coherent and avoids a second, unrelated sprite
       style for regular play. */
    .board.piece-set-glyph :global(.cg-wrap piece) { display: grid; place-items: center; background-image: none !important; color: var(--ink); font: 400 3rem/1 Georgia, "Times New Roman", serif; font-size: 12cqw; }
    .board.piece-set-glyph :global(.cg-wrap piece::before) { display: block; line-height: 1; }
    .board.piece-set-glyph :global(.cg-wrap piece.king.white::before) { content: "♔"; }
    .board.piece-set-glyph :global(.cg-wrap piece.queen.white::before) { content: "♕"; }
    .board.piece-set-glyph :global(.cg-wrap piece.rook.white::before) { content: "♖"; }
    .board.piece-set-glyph :global(.cg-wrap piece.bishop.white::before) { content: "♗"; }
    .board.piece-set-glyph :global(.cg-wrap piece.knight.white::before) { content: "♘"; }
    .board.piece-set-glyph :global(.cg-wrap piece.pawn.white::before) { content: "♙"; }
    .board.piece-set-glyph :global(.cg-wrap piece.king.black::before) { content: "♚"; }
    .board.piece-set-glyph :global(.cg-wrap piece.queen.black::before) { content: "♛"; }
    .board.piece-set-glyph :global(.cg-wrap piece.rook.black::before) { content: "♜"; }
    .board.piece-set-glyph :global(.cg-wrap piece.bishop.black::before) { content: "♝"; }
    .board.piece-set-glyph :global(.cg-wrap piece.knight.black::before) { content: "♞"; }
    .board.piece-set-glyph :global(.cg-wrap piece.pawn.black::before) { content: "♟"; }
    .board.piece-set-image :global(.cg-wrap piece.pawn.white) { background-image: var(--piece-wP) !important; }
    .board.piece-set-image :global(.cg-wrap piece.knight.white) { background-image: var(--piece-wN) !important; }
    .board.piece-set-image :global(.cg-wrap piece.bishop.white) { background-image: var(--piece-wB) !important; }
    .board.piece-set-image :global(.cg-wrap piece.rook.white) { background-image: var(--piece-wR) !important; }
    .board.piece-set-image :global(.cg-wrap piece.queen.white) { background-image: var(--piece-wQ) !important; }
    .board.piece-set-image :global(.cg-wrap piece.king.white) { background-image: var(--piece-wK) !important; }
    .board.piece-set-image :global(.cg-wrap piece.pawn.black) { background-image: var(--piece-bP) !important; }
    .board.piece-set-image :global(.cg-wrap piece.knight.black) { background-image: var(--piece-bN) !important; }
    .board.piece-set-image :global(.cg-wrap piece.bishop.black) { background-image: var(--piece-bB) !important; }
    .board.piece-set-image :global(.cg-wrap piece.rook.black) { background-image: var(--piece-bR) !important; }
    .board.piece-set-image :global(.cg-wrap piece.queen.black) { background-image: var(--piece-bQ) !important; }
    .board.piece-set-image :global(.cg-wrap piece.king.black) { background-image: var(--piece-bK) !important; }
    /* Keep the Cburnett class explicit so switching away from glyphs never
       leaves a pseudo-element behind; its exact SVGs are supplied locally. */
    .board.piece-set-cburnett :global(.cg-wrap piece) { display: block; color: transparent; }
    .board.piece-set-cburnett :global(.cg-wrap piece::before) { content: none; display: none; }
    .square-controls { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 0.2rem; }
    .square-control { min-width: 2.5rem; min-height: 2.5rem; padding: 0.2rem; font-size: 0.62rem; }
    /* The board remains fluid between phone and desktop widths. Reserve only
       the rank-label gutter instead of jumping to a separate 18.5rem board at
       one arbitrary breakpoint. */
    @media (max-width: 420px) {
        .chess { width: min(100%, 32rem); margin-top: 0.45rem; }
        .board-grid { width: calc(100% - 1.8rem); margin-inline: 1.8rem 0; }
        .rank-labels { left: -1.8rem; }
        .square-control { min-width: 2.25rem; min-height: 2.5rem; }
    }
</style>
