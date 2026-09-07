<script>
    import Modal from "./Modal.svelte";
    import { showInstructions } from "../stores";
    import { onMount } from "svelte";
    import { safeStorage } from "./gameStorage";

    const INSTRUCTIONS_SEEN_KEY = "chortle:instructions-seen-v1";
    const storage = safeStorage();
    const closeInstructions = () => showInstructions.set(false);
    onMount(() => {
        const seenBefore = storage.getItem(INSTRUCTIONS_SEEN_KEY);
        if (seenBefore) {
            showInstructions.set(false);
        } else {
            storage.setItem(INSTRUCTIONS_SEEN_KEY, "1");
            showInstructions.set(true);
        }
        const onKeydown = (event) => { if (event.key === "Escape" && $showInstructions) closeInstructions(); };
        window.addEventListener("keydown", onKeydown);
        return () => window.removeEventListener("keydown", onKeydown);
    });
</script>

<Modal show={$showInstructions} labelledBy="instructions-title">
    <button class="close" type="button" aria-label="Close instructions" title="Close instructions" on:click={closeInstructions}>×</button>
    <p class="eyebrow">How to play</p>
    <h1 id="instructions-title">Find the word through the board.</h1>
    <p class="intro">Guess the five-letter answer in five rows. You win when every letter is green and every A–H chess move is correct.</p>
    <ol>
        <li>Type letters outside A–H with your keyboard.</li>
        <li>For A–H, use the board: choose a piece in that lettered column, then its destination.</li>
        <li>Backspace removes your latest letter or chess move.</li>
        <li>Each tile shows letter feedback above and chess-move feedback below.</li>
    </ol>
    <div class="legend" aria-label="Color key">
        <span class="swatch green">Green <small>correct here</small></span>
        <span class="swatch yellow">Yellow <small>elsewhere in the word or chess line</small></span>
        <span class="swatch gray">Gray <small>not in the word or chess line</small></span>
    </div>
    <div class="example" aria-label="Example tile: correct letter with a chess move from elsewhere in the line">
        <div class="example-tile" aria-hidden="true">
            <span class="example-letter">F</span>
            <span class="example-move">F3→F6</span>
        </div>
        <p>Right letter; move belongs elsewhere in the chess line.</p>
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
    .example { display: flex; align-items: center; gap: 0.55rem; margin: -0.72rem 0 1.15rem; color: var(--muted); font-size: 0.82rem; line-height: 1.25; }
    .example p { margin: 0; }
    .example-tile { width: 2.75rem; height: 2.75rem; flex: 0 0 auto; overflow: hidden; border: 1px solid var(--ink); display: grid; grid-template-rows: minmax(0, 1fr) minmax(0, 0.42fr); text-align: center; }
    .example-letter { display: grid; place-items: center; background: var(--green); color: var(--panel); font: 700 1.25rem/1 var(--sans); }
    .example-move { display: grid; place-items: center; background: var(--yellow); color: var(--ink); font: 700 0.42rem/1 var(--mono); white-space: nowrap; }
    .close { position: absolute; top: 0.55rem; right: 0.6rem; min-width: 0; width: 2.5rem; height: 2.5rem; padding: 0; border: 0; color: var(--muted); font: 400 1.45rem/1 var(--sans); }
    .close:hover { color: var(--burgundy); background: transparent; border-color: transparent; }
    @media (max-width: 420px) {
        h1 { font-size: 1.65rem; margin-bottom: 0.55rem; padding-bottom: 0.5rem; }
        .intro { margin-bottom: 0.7rem; font-size: 0.92rem; }
        ol { margin-bottom: 0.85rem; padding-top: 0.35rem; }
        li { margin: 0.3rem 0; }
        .legend { gap: 0.2rem; margin-bottom: 0.85rem; }
        .swatch { padding: 0.28rem 0.38rem; }
        .swatch small { margin-top: 0.05rem; }
        .example { margin: -0.45rem 0 0.75rem; font-size: 0.76rem; }
        .example-tile { width: 2.35rem; height: 2.35rem; }
    }
</style>
