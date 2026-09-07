<script>
    export let letter;
    export let status;
    export let moveStatus = status;
    export let ghost = false;
    export let move = "";
    const statusNames = ["not in the answer", "in the answer, but in another position", "correct position"];
    $: wordStatus = status >= 0 ? statusNames[status] : "not scored";
    $: chessStatus = moveStatus >= 0 ? statusNames[moveStatus].replace("answer", "chess line").replace("position", "move") : "not scored";
    $: tileLabel = letter
        ? `${letter}${move ? `, chess move ${move}` : ""}; letter ${wordStatus}${move ? `; chess move ${chessStatus}` : ""}`
        : "Empty letter tile";
</script>

<div
    class:ghost
    data-status={status >= 0 ? status : "empty"}
    data-move-status={moveStatus >= 0 ? moveStatus : "empty"}
    role="img"
    aria-label={tileLabel}
    title={move ? `Move ${move}. Letter ${wordStatus}. Chess move ${chessStatus}.` : tileLabel}
>
    <span class:green={status === 2} class:yellow={status === 1} class:gray={status === 0} class="letter">{letter}</span>
    <span class:green={moveStatus === 2} class:yellow={moveStatus === 1} class:gray={moveStatus === 0} class="move" aria-hidden="true">{move}</span>
</div>

<style>
    div {
        position: relative;
        width: clamp(2.7rem, 10vw, 3.35rem);
        height: clamp(2.7rem, 10vw, 3.35rem);
        border: 1px solid var(--ink);
        display: grid;
        grid-template-rows: minmax(0, 1fr) minmax(0, 0.42fr);
        overflow: hidden;
    }

    .letter, .move { display: grid; place-items: center; }
    .letter { font: 700 clamp(1.15rem, 4vw, 1.45rem)/1 var(--sans); letter-spacing: 0.03em; }
    .move {
        font: 700 clamp(0.42rem, 1.5vw, 0.52rem)/1 var(--mono);
        letter-spacing: -0.035em;
        white-space: nowrap;
    }

    .ghost { border-color: var(--burgundy); border-style: dashed; opacity: 0.58; }
    .ghost .letter, .ghost .move { color: var(--burgundy); background: transparent; }

    .green {
        background-color: var(--green);
        color: var(--panel);
    }

    .yellow {
        background-color: var(--yellow);
        color: var(--ink);
    }

    .gray {
        background-color: var(--gray);
        color: var(--panel);
    }
    @media (max-width: 420px) {
        div { width: clamp(2.15rem, 13vw, 2.75rem); height: clamp(2.15rem, 13vw, 2.75rem); }
        .letter { font-size: clamp(0.95rem, 4.5vw, 1.25rem); }
        .move { font-size: clamp(0.36rem, 1.7vw, 0.48rem); }
    }
</style>
