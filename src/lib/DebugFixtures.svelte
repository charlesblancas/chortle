<script>
    import { createEventDispatcher } from "svelte";
    import { FIXTURES } from "../fixtures";

    export let selected = "";
    export let pieceSet = "cburnett";
    const dispatch = createEventDispatcher();
    const PIECES = [
        { label: "King", role: "king", code: "K", white: "♔", black: "♚" },
        { label: "Queen", role: "queen", code: "Q", white: "♕", black: "♛" },
        { label: "Rook", role: "rook", code: "R", white: "♖", black: "♜" },
        { label: "Bishop", role: "bishop", code: "B", white: "♗", black: "♝" },
        { label: "Knight", role: "knight", code: "N", white: "♘", black: "♞" },
        { label: "Pawn", role: "pawn", code: "P", white: "♙", black: "♟" },
    ];
    const PIECE_SETS = [
        { id: "glyph", label: "Typographic glyphs", description: "Crisp text glyphs that match the promotion chooser." },
        { id: "chessnut", label: "Chessnut diagrams", description: "The outlined diagrams from the alternate piece set." },
        { id: "cburnett", label: "Cburnett", description: "The classic Chessground pieces bundled with the board." },
        { id: "berlin", label: "Berlin", description: "East German Sportverlag-inspired diagrams for a Cold War book feel." },
        { id: "leipzig", label: "Leipzig", description: "Period German book illustrations with a distinctly printed look." },
        { id: "alpha", label: "Alpha", description: "A clean, traditional outlined set by Eric Bentzen." },
        { id: "merida", label: "Merida", description: "The familiar tournament-style set by Armando Hernandez Marroquin." },
        { id: "maestro", label: "Maestro", description: "A heavier, expressive set by sadsnake1." },
        { id: "fantasy", label: "Fantasy", description: "A decorative hand-drawn set by Maurizio Monge." },
        { id: "caliente", label: "Caliente", description: "A compact modern set by Leonid Gordenin." },
        { id: "horsey", label: "Horsey", description: "A playful set by cham and michael1241." },
        { id: "pixel", label: "Pixel", description: "A retro pixel-art set by therealqtpi." },
        { id: "mono", label: "Mono", description: "A simple monochrome set from the Chessground collection." },
    ];
    const SAMPLES = [
        { tile: "light", side: "white", label: "Light · white" },
        { tile: "light", side: "black", label: "Light · black" },
        { tile: "dark", side: "white", label: "Dark · white" },
        { tile: "dark", side: "black", label: "Dark · black" },
    ];
    $: active = FIXTURES.find((fixture) => fixture.id === selected) || null;
    $: activePieceSet = PIECE_SETS.find((option) => option.id === pieceSet) || PIECE_SETS[0];

    function load(event) {
        const id = event.currentTarget.value;
        const url = new URL(window.location.href);
        if (id) url.searchParams.set("fixture", id);
        else url.searchParams.delete("fixture");
        window.location.href = url.toString();
    }

    function selectPieceSet(event) {
        dispatch("pieceSet", event.currentTarget.value);
    }
</script>

<details class="debug-fixtures">
    <summary>Debug controls</summary>
    <div class="debug-content">
        <div class="fixture-picker">
            <label for="fixture-select">Debug fixture</label>
            <select id="fixture-select" value={selected} on:change={load}>
                <option value="">Daily puzzle</option>
                {#each FIXTURES as fixture}<option value={fixture.id}>{fixture.label}</option>{/each}
            </select>
        </div>
        {#if active}<p>{active.description}</p><small>{active.instructions}</small>{/if}
    <div class="piece-picker" aria-label="Chess piece style">
        <div class="piece-picker-heading">
            <div class="piece-picker-title">
                <label for="piece-set-select">Piece set</label>
                <select id="piece-set-select" value={pieceSet} on:change={selectPieceSet}>
                    {#each PIECE_SETS as option}<option value={option.id}>{option.label}</option>{/each}
                </select>
            </div>
            <small>Compare every piece on light and dark squares</small>
        </div>
        <p class="piece-set-description">{activePieceSet.description}</p>
        <div class="piece-preview" aria-label={`${pieceSet} piece preview`}>
            <div class="sample-legend" aria-hidden="true"><span>light · white</span><span>light · black</span><span>dark · white</span><span>dark · black</span></div>
            {#each PIECES as piece}
                <div class="preview-row">
                    <strong>{piece.label}</strong>
                    {#each SAMPLES as sample}
                        <span class={`sample ${sample.tile}`} title={`${piece.label}, ${sample.label}`}>
                            {#if pieceSet === "glyph"}
                                <span class="glyph-piece">{sample.side === "white" ? piece.white : piece.black}</span>
                            {:else if pieceSet === "cburnett"}
                                <span class="cburnett-wrap"><img src={`/pieces/cburnett/${sample.side === "white" ? "w" : "b"}${piece.code}.svg`} alt="" /></span>
                            {:else}
                                <img src={`/pieces/${pieceSet}/${sample.side === "white" ? "w" : "b"}${piece.code}.svg`} alt="" />
                            {/if}
                        </span>
                    {/each}
                </div>
            {/each}
        </div>
    </div>
    </div>
</details>

<style>
    .debug-fixtures { margin: 0 auto 0.75rem; border: 1px dashed var(--burgundy); color: var(--muted); font: 0.72rem/1.35 var(--mono); }
    .debug-fixtures summary { padding: 0.4rem 0.65rem; cursor: pointer; color: var(--burgundy); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; list-style: none; user-select: none; }
    .debug-fixtures summary::-webkit-details-marker { display: none; }
    .debug-fixtures summary::before { content: "+"; display: inline-block; width: 1rem; color: var(--muted); }
    .debug-fixtures[open] summary { border-bottom: 1px solid var(--line); }
    .debug-fixtures[open] summary::before { content: "−"; }
    .debug-content { padding: 0.5rem 0.65rem; }
    .fixture-picker { display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem; }
    .fixture-picker label { margin: 0; }
    label { margin-right: 0.45rem; color: var(--burgundy); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    select { border: 1px solid var(--line); border-radius: 0; background: var(--panel); color: var(--text); font: inherit; padding: 0.2rem 0.35rem; }
    p { margin: 0.45rem 0 0; }
    small { display: block; margin-top: 0.25rem; color: var(--text); }
    .piece-picker { margin-top: 0.65rem; padding-top: 0.55rem; border-top: 1px solid var(--line); }
    .piece-picker-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; color: var(--burgundy); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .piece-picker-title { display: flex; align-items: center; gap: 0.45rem; }
    .piece-picker-title label { margin: 0; }
    .piece-picker-title select { min-width: 10rem; padding: 0.28rem 1.5rem 0.28rem 0.4rem; }
    .piece-picker-heading small { margin: 0; color: var(--muted); font-size: 0.62rem; font-weight: 400; letter-spacing: 0; text-transform: none; }
    .piece-set-description { margin: 0.45rem 0 0.35rem; color: var(--muted); font-size: 0.62rem; }
    .piece-preview { display: grid; gap: 0.16rem; margin-top: 0.45rem; }
    .sample-legend, .preview-row { display: grid; grid-template-columns: 4.2rem repeat(4, minmax(0, 1fr)); gap: 0.16rem; }
    .sample-legend { color: var(--muted); font: 0.47rem/1 var(--mono); letter-spacing: 0; text-align: center; text-transform: uppercase; }
    .sample-legend::before { content: ""; }
    .preview-row { align-items: center; }
    .preview-row > strong { color: var(--muted); font: 700 0.58rem/1 var(--sans); letter-spacing: 0.03em; text-transform: uppercase; }
    .sample { display: grid; width: 100%; aspect-ratio: 1; place-items: center; color: var(--ink); font: 1.25rem/1 Georgia, "Times New Roman", serif; }
    .sample.light { background: #e9e5db; }
    .sample.dark { background: #a7a8a3; }
    .sample img { width: 88%; height: 88%; object-fit: contain; }
    .glyph-piece { display: block; transform: translateY(-0.03em); }
    .cburnett-wrap { display: grid; width: 100%; height: 100%; place-items: center; }
    .cburnett-wrap img { width: 92%; height: 92%; object-fit: contain; }
    @media (max-width: 420px) {
        .piece-picker-heading { display: block; }
        .piece-picker-title { justify-content: space-between; }
        .piece-picker-title select { flex: 1; min-width: 0; }
        .piece-picker-heading small { margin-top: 0.2rem; }
        .sample-legend, .preview-row { grid-template-columns: 3.4rem repeat(4, minmax(0, 1fr)); }
        .preview-row > strong { font-size: 0.5rem; }
    }
</style>
