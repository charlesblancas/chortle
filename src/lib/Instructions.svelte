<script>
    import Modal from "./Modal.svelte";
    import { showInstructions } from "../stores";
    import { onMount } from "svelte";

    let showInstructionsValue;
    showInstructions.subscribe((value) => { showInstructionsValue = value; });
    const closeInstructions = () => showInstructions.set(false);
    onMount(() => {
        const onKeydown = (event) => { if (event.key === "Escape" && showInstructionsValue) closeInstructions(); };
        window.addEventListener("keydown", onKeydown);
        return () => window.removeEventListener("keydown", onKeydown);
    });
</script>

<Modal show={showInstructionsValue}>
    <button class="close" type="button" aria-label="Close instructions" title="Close instructions" on:click={closeInstructions}>×</button>
    <p class="eyebrow">How to play</p>
    <h1>Find the word through the board.</h1>
    <p class="intro">It is Wordle, except A–H come from chess moves.</p>
    <ol>
        <li>Type I–Z as usual.</li>
        <li>For A–H, move a piece from that file.</li>
        <li>Backspace undoes the last letter and move.</li>
        <li>Tiles use the color key below.</li>
    </ol>
    <div class="legend" aria-label="Color key">
        <span class="swatch green">Green <small>correct position + move</small></span>
        <span class="swatch yellow">Yellow <small>elsewhere in word, or wrong move</small></span>
        <span class="swatch gray">Gray <small>not in word</small></span>
    </div>
    <button on:click={closeInstructions}>Understood</button>
</Modal>

<style>
    h1 { margin: 0.3rem 0 0.85rem; padding-bottom: 0.7rem; border-bottom: 1px solid var(--ink); font: 700 2.15rem/1 var(--display); letter-spacing: -0.035em; }
    .eyebrow { margin: 0; color: var(--burgundy); font: 700 0.7rem/1 var(--sans); letter-spacing: 0.1em; text-transform: uppercase; }
    .intro { color: var(--muted); margin: 0 0 1.1rem; font-style: italic; }
    ol { margin: 0 0 1.35rem; padding: 0.6rem 0 0.1rem 1.25rem; border-block: 1px solid var(--line); }
    li { margin: 0.55rem 0; }
    .legend { display: grid; gap: 0.35rem; margin: 0 0 1.35rem; }
    .swatch { display: block; padding: 0.35rem 0.45rem; font-weight: 700; }
    .swatch small { display: block; margin-top: 0.12rem; font-size: 0.78em; font-weight: 400; }
    .swatch.green { background: var(--green); color: var(--panel); }
    .swatch.yellow { background: var(--yellow); color: var(--ink); }
    .swatch.gray { background: var(--gray); color: var(--panel); }
    .close { position: absolute; top: 0.65rem; right: 0.7rem; min-width: 0; width: 1.6rem; height: 1.6rem; padding: 0; border: 0; color: var(--muted); font: 400 1.45rem/1 var(--sans); }
    .close:hover { color: var(--burgundy); background: transparent; border-color: transparent; }
    @media (max-width: 420px) {
        h1 { font-size: 1.65rem; margin-bottom: 0.55rem; padding-bottom: 0.5rem; }
        .intro { margin-bottom: 0.7rem; font-size: 0.92rem; }
        ol { margin-bottom: 0.85rem; padding-top: 0.35rem; }
        li { margin: 0.3rem 0; }
        .legend { gap: 0.2rem; margin-bottom: 0.85rem; }
        .swatch { padding: 0.28rem 0.38rem; }
        .swatch small { margin-top: 0.05rem; }
    }
</style>
