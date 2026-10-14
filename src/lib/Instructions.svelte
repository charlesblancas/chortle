<script>
    import Modal from "./Modal.svelte";
    import { showInstructions } from "../stores";
    import { onMount, tick } from "svelte";
    import { safeStorage } from "./gameStorage";
    import Tutorial from "./Tutorial.svelte";

    export let pieceSet = "cburnett";
    let tutorial = false;
    let invitation = false;
    const INVITATION_SEEN_KEY = "chortle:line-invitation-v1";
    const lineMode = new URLSearchParams(window.location.search).get("mode") === "line";
    function modeUrl(mode) {
        const url = new URL(window.location.href);
        if (mode === "line") url.searchParams.set("mode", "line");
        else url.searchParams.delete("mode");
        return url.pathname + url.search;
    }
    let confirmClose = false;
    let keepPlayingButton;
    let closeFocus;

    const INSTRUCTIONS_SEEN_KEY = "chortle:instructions-seen-v1";
    const TUTORIAL_COMPLETED_KEY = "chortle:tutorial-completed-v1";
    const storage = safeStorage();
    const closeInstructions = () => { confirmClose = false; tutorial = false; invitation = false; showInstructions.set(false); };
    const completeTutorial = () => {
        storage.setItem(TUTORIAL_COMPLETED_KEY, "1");
        storage.setItem(INSTRUCTIONS_SEEN_KEY, "1");
    };
    function requestClose() {
        if (storage.getItem(TUTORIAL_COMPLETED_KEY)) return closeInstructions();
        closeFocus = document.activeElement;
        confirmClose = true;
        tick().then(() => keepPlayingButton?.focus());
    }
    function keepPlaying() {
        confirmClose = false;
        tick().then(() => closeFocus?.isConnected && closeFocus.focus());
    }
    function skipTutorial() {
        completeTutorial();
        closeInstructions();
    }
    onMount(() => {
        const seenBefore = storage.getItem(INSTRUCTIONS_SEEN_KEY);
        if (!storage.getItem(TUTORIAL_COMPLETED_KEY)) {
            tutorial = true;
            showInstructions.set(true);
        } else if (seenBefore) {
            invitation = !lineMode && !storage.getItem(INVITATION_SEEN_KEY);
            if (invitation) storage.setItem(INVITATION_SEEN_KEY, "1");
            showInstructions.set(invitation);
        } else {
            storage.setItem(INSTRUCTIONS_SEEN_KEY, "1");
            showInstructions.set(true);
        }
        const onKeydown = (event) => { if (event.key === "Escape" && $showInstructions) confirmClose ? keepPlaying() : requestClose(); };
        window.addEventListener("keydown", onKeydown);
        return () => window.removeEventListener("keydown", onKeydown);
    });
</script>

<Modal show={$showInstructions} labelledBy={confirmClose ? "tutorial-close-title" : invitation ? "line-invitation-title" : tutorial ? "tutorial-title" : "instructions-title"} cardClass={tutorial ? "tutorial-card" : invitation ? "invitation-card" : "instructions-card"} onClose={confirmClose ? null : requestClose} closeLabel={invitation ? "Close Line mode invitation" : tutorial ? "Close tutorial" : "Close instructions"}>
    {#if confirmClose}
        <section class="close-confirmation" aria-labelledby="tutorial-close-title">
            <h1 id="tutorial-close-title">Leave the tutorial?</h1>
            <p>You can replay it anytime from the ? at the top right.</p>
            <div class="instructions-actions">
                <button bind:this={keepPlayingButton} type="button" on:click={keepPlaying}>Keep playing</button>
                <button type="button" on:click={skipTutorial}>Leave tutorial</button>
            </div>
        </section>
    {/if}
 <div class="instructions-body" inert={confirmClose} aria-hidden={confirmClose ? "true" : undefined}>
    {#if invitation}
        <section class="invitation">
            <p class="eyebrow">Something new to try</p>
            <h1 id="line-invitation-title">Hey! Want to experiment?</h1>
            <p>I’m trying a new mode: I tell you how many chess moves you need, but you have to play that many each guess.</p>
            <p>Then fit their letters into your word, in order. You can still undo.</p>
            <p class="feedback-note">Give it a try and let me know how it goes. Open to feedback!</p>
            <div class="invitation-actions"><a class="mode-action primary" href={modeUrl("line")}>Try Line mode</a><button type="button" on:click={closeInstructions}>Not now</button></div>
        </section>
    {:else if tutorial}
        <Tutorial {pieceSet} active={!confirmClose} on:complete={completeTutorial} on:close={requestClose} on:instructions={() => tutorial = false} />
    {:else}
    <div class="instructions-content">
        <p class="eyebrow">How to play</p>
        <h1 id="instructions-title">Find the word through the board.</h1>
        <p class="intro">Guess the five-letter answer in four tries. You win when every letter is green and every A–H chess move is correct.</p>
        <ol>
            <li>Type letters outside A–H with your keyboard.</li>
            <li>For A–H, choose a piece in that column, then its destination. Once a move earns green feedback, you can type its letter when following the same chess line.</li>
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
        <section class="mode-panel" aria-labelledby="mode-panel-title">
            <p class="eyebrow">Experimental</p>
            <h2 id="mode-panel-title">{lineMode ? "You’re playing Line mode" : "Try Line mode"}</h2>
            <p>Know the move count. Play that many moves, then fit their letters into your word in order.</p>
            <p class="mode-detail">Undo is allowed. Nonwords count as guesses.</p>
            <a class="mode-action" href={modeUrl(lineMode ? "normal" : "line")}>{lineMode ? "Switch to normal mode" : "Try Line mode"}</a>
        </section>
    </div>
    <div class="instructions-actions"><button on:click={() => tutorial = true}>Play tutorial</button><button on:click={requestClose}>Understood</button></div>
    {/if}
    </div>
</Modal>

<style>
    .mode-panel { padding: 0.9rem 1rem; margin: 1rem 0 0.75rem; border: 1px solid var(--line); border-left: 3px solid var(--burgundy); }
    .mode-panel h2 { margin: 0.35rem 0; font: 700 1.25rem/1.15 var(--display); }
    .mode-panel p:not(.eyebrow) { margin: 0.4rem 0; font-size: 0.85rem; line-height: 1.4; }
    .mode-panel .mode-detail { color: var(--muted); }
    .mode-action { display: inline-block; padding: 0.5rem 0.7rem; margin-top: 0.35rem; border: 1px solid var(--burgundy); color: var(--burgundy); font: 700 0.7rem/1.2 var(--sans); text-decoration: none; text-transform: uppercase; }
    .mode-action:hover, .mode-action.primary { background: var(--burgundy); color: var(--panel); }
    .mode-action:focus-visible { outline: 2px solid var(--burgundy); outline-offset: 3px; }
    .invitation p:not(.eyebrow) { font-size: 1rem; line-height: 1.45; }
    .invitation .feedback-note { padding-top: 0.75rem; border-top: 1px solid var(--line); color: var(--muted); font-style: italic; }
    .invitation-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
    .invitation-actions .mode-action { margin: 0; }
    .instructions-body { display: contents; }
    .instructions-body[inert] { visibility: hidden; }
    .close-confirmation { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; justify-content: center; padding: 1.25rem; background: var(--panel); }
    :global(.modal-card.tutorial-card) { padding: 0.8rem 1rem; width: min(100%, 34rem); }
    .instructions-actions { display: flex; gap: 0.5rem; }
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
    .eyebrow { padding-right: 3rem; }
    @media (max-width: 420px) {
        :global(.modal-card.instructions-card) { display: grid; grid-template-rows: minmax(0, 1fr) auto; overflow: hidden; padding: 0; }
        .instructions-content { min-height: 0; overflow-y: auto; padding: 1rem 1rem 0.7rem; }
        .instructions-actions { padding: 0.6rem 1rem 1rem; border-top: 1px solid var(--line); background: var(--panel); }
        .instructions-actions button { width: 100%; min-height: 2.75rem; }
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
