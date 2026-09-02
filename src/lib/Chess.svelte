<script>
    import { createEventDispatcher, onMount } from "svelte";
    import { Chess, SQUARES } from "chess.js";
    import { Chessground } from "svelte-chessground";
    import { isPlayerMatedAfterReply } from "../gameRules";
    import { fastChessReply, isUciMove } from "./fastChessEngine";

    export let fen;
    export let movesString;
    export let actions = [];
    export let disabled = false;
    export let mated = false;
    export let highlightFile = "";
    const dispatch = createEventDispatcher();
    const chess = new Chess();
    const line = movesString.split(" ");
    let chessground;
    let last = "";
    let selectedLetter = "";
    let selectedSquare = "";
    let engineThinking = false;
    $: orientation = fen.split(" ")[1] === "w" ? "black" : "white";
    $: playerColor = orientation;
    $: files = orientation === "white" ? "ABCDEFGH".split("") : "HGFEDCBA".split("");
    $: ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    $: highlightIndex = files.indexOf(highlightFile);

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
        chessground.set({
            fen: chess.fen(),
            movable: { enabled: !disabled && !engineThinking && playerTurn, color: playerColor, dests: destinations(), free: false },
            turnColor,
            viewOnly: disabled || engineThinking || !playerTurn,
        });
    }
    function rebuild() {
        if (!chessground) return;
        chess.load(fen);
        selectedLetter = "";
        selectedSquare = "";
        dispatch("preview", { letter: "" });
        chessground.set({ fen, orientation, coordinates: false });
        apply(line[0]);
        actions.forEach((action) => { apply(action.uci); apply(action.reply); });
        setup();
    }
    async function after(from, to) {
        if (disabled || engineThinking) return;
        const playerColor = chess.turn();
        const move = chess.move({ from, to });
        if (!move) return;
        const uci = `${move.from}${move.to}${move.promotion || ""}`;
        const actionIndex = actions.length;
        const expected = line[1 + actionIndex * 2];
        const moveCorrect = uci === expected;
        let reply = line[2 + actionIndex * 2];

        selectedLetter = "";
        selectedSquare = "";
        dispatch("preview", { letter: "" });
        const completesLine = moveCorrect && !reply;
        dispatch("move", {
            letter: move.from[0].toUpperCase(),
            uci,
            reply: "",
            moveCorrect,
            mated: false,
            pending: !completesLine,
        });

        // Some puzzle lines end on the player's move (day 1649 is one). No
        // engine reply is required in that case, so resolve immediately
        // instead of briefly entering the thinking/locked state.
        if (completesLine) return;

        engineThinking = true;
        setup();
        dispatch("thinking", { active: true });
        try {
            if (!moveCorrect) {
                try {
                    reply = fastChessReply(chess.fen());
                } catch {
                    reply = "";
                }
            }
            // Never unlock the board until the reply has actually been
            // applied. A malformed or stale engine response must not leave
            // the side-to-move on the opponent, which looks like the player
            // can move black pieces next.
            const replyApplied = reply ? apply(reply) : false;
            if (!moveCorrect && !replyApplied) {
                // `fastChessReply` includes a deterministic legal-move safety
                // path, so a failed search cannot leave the board on the
                // opponent's turn.
                reply = fastChessReply(chess.fen());
            }
            const matedAfterReply = isPlayerMatedAfterReply(chess, playerColor, reply);
            dispatch("resolve", { index: actionIndex, reply, mated: matedAfterReply });
        } finally {
            engineThinking = false;
            dispatch("thinking", { active: false });
            setup();
        }
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
    function fileHint(node) {
        const clear = () => {
            selectedLetter = "";
            selectedSquare = "";
            dispatch("preview", { letter: "" });
        };
        const onBoardClick = (event) => {
            showFile(event);
            requestAnimationFrame(() => {
                if (!node.querySelector("square.selected")) clear();
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
    // Replaying the whole position is only necessary when the move history
    // changes.  `disabled` changes as a guess fills up (especially between
    // letters four and five), and rebuilding on that transition made the
    // board visibly jump/reset even though no chess move had happened.
    $: signature = JSON.stringify(actions);
    $: if (chessground && signature !== last) { last = signature; rebuild(); }
    $: interactionSignature = `${disabled}:${engineThinking}`;
    $: if (chessground && last === signature && interactionSignature) setup();
    onMount(() => {
        rebuild();
        last = JSON.stringify(actions);
    });
</script>

<section class="chess" aria-label="Chess board. Use a mouse or touch to make A to H moves.">
    <div class="board-grid">
        <div class="rank-labels" aria-hidden="true">{#each ranks as rank}<span>{rank}</span>{/each}</div>
        <div class="board" use:fileHint>
            {#if highlightIndex >= 0}<div class="file-highlight" style={`left: ${highlightIndex * 12.5}%`}></div>{/if}
            <Chessground bind:this={chessground} coordinates={false} config={{ movable: { events: { after } } }} />
            {#if mated}<div class="mate-banner" role="status">You are mated.</div>{/if}
        </div>
        <div class="file-labels" aria-hidden="true">{#each files as file}<span>{file}</span>{/each}</div>
    </div>
    <span class="sr-only" aria-live="polite">{selectedLetter ? `This move writes ${selectedLetter}` : ""}</span>
</section>

<style>
    .chess { width: min(100%, 32rem); margin: 1.75rem auto 0; }
    .board-grid { position: relative; display: block; padding-bottom: 1.55rem; }
    .board { position: relative; width: 100%; aspect-ratio: 1; overflow: hidden; background: #e9e5db; }
    .file-highlight { position: absolute; z-index: 2; top: 0; bottom: 0; width: 12.5%; pointer-events: none; background: rgba(112, 45, 49, 0.1); box-shadow: inset 0 0 0 2px rgba(112, 45, 49, 0.55); }
    .mate-banner { position: absolute; z-index: 4; top: 50%; left: 50%; width: min(82%, 18rem); box-sizing: border-box; transform: translate(-50%, -50%); padding: 1rem 0.8rem; background: rgba(239, 236, 226, 0.9); border-block: 2px solid var(--burgundy); color: var(--burgundy); text-align: center; font: 700 1.05rem/1.1 var(--mono); letter-spacing: 0.08em; text-transform: uppercase; pointer-events: none; }
    .rank-labels { position: absolute; top: 0; bottom: 1.55rem; left: -1.65rem; display: grid; grid-template-rows: repeat(8, 1fr); align-items: center; justify-items: end; width: 1.1rem; color: var(--burgundy); font: 700 0.72rem/1 var(--mono); font-variant-numeric: tabular-nums; }
    .file-labels { position: absolute; right: 0; bottom: 0; left: 0; height: 1.55rem; display: grid; grid-template-columns: repeat(8, 1fr); place-items: center; color: var(--burgundy); font: 700 0.72rem/1 var(--mono); letter-spacing: 0.03em; }
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
    .board :global(.cg-wrap) { width: 100%; height: 100%; }
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
    @media (max-width: 420px) {
        .chess { width: min(100%, 18.5rem); margin-top: 0.35rem; }
        .board-grid { width: calc(100% - 3.3rem); margin-inline: auto; }
    }
    @media (max-width: 420px) and (max-height: 760px) {
        .chess { width: min(100%, 18.5rem); margin-top: 0.2rem; }
    }
</style>
