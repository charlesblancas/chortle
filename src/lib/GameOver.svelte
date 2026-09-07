<script>
    import { createEventDispatcher } from "svelte";
    import Modal from "./Modal.svelte";
    import { gameOver, showInstructions } from "../stores";
    import { scoreShareRow } from "../gameRules";

    export let word;
    export let statuses;
    export let guesses = [];
    export let actionHistory = [];
    export let solutionMoves = [];
    export let solved = false;
    export let day;
    export let attempts;
    export let solutionViewing = false;
    let gameSummary = "";
    let copied = false;
    let gameOverValue;
    const dispatch = createEventDispatcher();
    gameOver.subscribe((value) => {
        gameOverValue = value;
        if (value) gameSummary = generateSummary();
    });

    function numberToSquare(number) {
        return number === 0 ? "⬛" : number === 1 ? "🟨" : number === 2 ? "🟩" : "⬜";
    }
    function generateSummary() {
        return statuses.map((status, index) => {
            if (!status.some((value) => value >= 0)) return "";
            return scoreShareRow(guesses[index] || "", status, actionHistory[index] || [], solutionMoves)
                .map(numberToSquare)
                .join("");
        }).filter(Boolean).join("\n");
    }
    $: shareMessage = `CHORTLE BETA #${String(day).padStart(4, "0")} ${solved ? `${attempts}/5` : "X/5"}\nhttps://chortle.charlesblancas.com\n${gameSummary}`;

    async function copyResult() {
        try {
            await navigator.clipboard.writeText(shareMessage);
            copied = true;
        } catch {
            copied = false;
        }
    }
</script>

<Modal show={gameOverValue && !solutionViewing && !$showInstructions}>
    <p class="eyebrow">Puzzle {String(day).padStart(4, "0")}</p>
    <h1>{solved ? `Solved in ${attempts}/5` : "Out of attempts"}</h1>
    <p class="answer">Today’s answer: <strong>{word}</strong></p>
    <p class="summary" aria-label="Result grid">{gameSummary}</p>
    <button type="button" on:click={copyResult}>{copied ? "Copied" : "Copy result"}</button>
    {#if solved}<button class="solution" type="button" on:click={() => dispatch("viewSolution")}>View solution</button>{/if}
    {#if import.meta.env.DEV}<button class="reset" type="button" on:click={() => dispatch("reset")}>Reset puzzle</button>{/if}
</Modal>

<style>
    h1 { margin: 0.25rem 0 0.6rem; font: 700 clamp(2rem, 8vw, 2.5rem)/1 var(--display); letter-spacing: -0.02em; }
    p { color: var(--muted); }
    .eyebrow { margin: 0; color: var(--accent); font: 700 0.72rem/1 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; }
    .answer { margin: 0 0 1rem; }
    .answer strong { color: var(--text); letter-spacing: 0.08em; }
    .summary { margin: 0 0 1.1rem; padding: 0.7rem 0; border-block: 1px solid var(--line); white-space: pre; color: var(--text); font-size: 1.05rem; letter-spacing: 0.05em; }
    .reset { margin-left: 0.45rem; color: var(--burgundy); border-color: var(--burgundy); }
    .solution { margin-left: 0.45rem; color: var(--accent); border-color: var(--accent); }
    @media (max-width: 420px) {
        .solution, .reset { margin-top: 0.45rem; margin-left: 0; }
    }
</style>
