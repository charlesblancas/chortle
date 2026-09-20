<script>
    import { createEventDispatcher, onMount, tick } from "svelte";
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
    let copyFailed = false;
    let copyStatus = "";
    let useNativeShare = false;
    let sharing = false;
    let shareFailed = false;
    let shareStatus = "";
    let manualCopy;
    let gameOverValue;
    const dispatch = createEventDispatcher();
    onMount(() => {
        const touchDevice = typeof window.matchMedia === "function"
            && window.matchMedia("(pointer: coarse)").matches;
        useNativeShare = touchDevice && typeof navigator.share === "function";
    });
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
    $: shareTitle = `CHORTLE BETA #${String(day).padStart(4, "0")}`;

    function fallbackCopy(text) {
        if (typeof document === "undefined" || typeof document.execCommand !== "function") return false;
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        // iOS only honours execCommand when the editable control is focused
        // and still attached to the viewport. Keep it visually unobtrusive,
        // but do not move it off-screen before selecting its contents.
        textarea.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
        try {
            document.body.append(textarea);
            textarea.focus({ preventScroll: true });
            textarea.select();
            return document.execCommand("copy");
        } catch {
            return false;
        } finally {
            textarea.remove();
        }
    }

    async function copyResult() {
        copyFailed = false;
        copyStatus = "";
        shareFailed = false;
        shareStatus = "";
        try {
            if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
            await navigator.clipboard.writeText(shareMessage);
            copied = true;
            copyStatus = "Result copied to the clipboard.";
        } catch {
            copied = fallbackCopy(shareMessage);
            copyFailed = !copied;
            copyStatus = copied
                ? "Result copied to the clipboard."
                : "Copy failed. Select the result text below and copy it manually.";
            if (copyFailed) {
                await tick();
                manualCopy?.focus({ preventScroll: true });
                manualCopy?.select();
            }
        }
    }

    async function shareResult() {
        if (sharing) return;
        if (!useNativeShare) {
            await copyResult();
            return;
        }
        sharing = true;
        shareFailed = false;
        shareStatus = "";
        copyFailed = false;
        copyStatus = "";
        try {
            await navigator.share({
                title: shareTitle,
                text: `${shareTitle} ${solved ? `${attempts}/5` : "X/5"}\n${gameSummary}`,
                url: "https://chortle.charlesblancas.com",
            });
            shareStatus = "Result shared.";
        } catch (error) {
            // Canceling the native sheet is an expected user action, not an
            // error. Other failures use the clipboard/manual-copy fallback.
            if (error?.name !== "AbortError") {
                await copyResult();
            }
        } finally {
            sharing = false;
        }
    }
</script>

<Modal show={gameOverValue && !solutionViewing && !$showInstructions} labelledBy="result-title">
    <p class="eyebrow">Puzzle {String(day).padStart(4, "0")}</p>
    <h1 id="result-title">{solved ? `Solved in ${attempts}/5` : "Out of attempts"}</h1>
    <p class="answer">Today’s answer: <strong>{word}</strong></p>
    <p class="summary" aria-label="Result grid">{gameSummary}</p>
    <button class:copied class="action-button result-action share" type="button" on:click={shareResult} disabled={sharing}>{copied ? "Copied" : sharing ? "Sharing…" : "Share result"}</button>
    {#if solved}<button class="action-button result-action solution" type="button" on:click={() => dispatch("viewSolution")}>View solution</button>{/if}
    {#if import.meta.env.DEV}<button class="action-button result-action reset" type="button" on:click={() => dispatch("reset")}>Reset puzzle</button>{/if}
    <p
        class:copy-failed={copyFailed || shareFailed}
        class="copy-status"
        role="status"
        aria-hidden={!(copyStatus || shareStatus)}
    >{copyStatus || shareStatus || "\u00a0"}</p>
    {#if copyFailed}<textarea bind:this={manualCopy} class="manual-copy" aria-label="Result text to copy manually" readonly value={shareMessage}></textarea>{/if}
</Modal>

<style>
    h1 { margin: 0.25rem 0 0.6rem; font: 700 clamp(2rem, 8vw, 2.5rem)/1 var(--display); letter-spacing: -0.02em; }
    p { color: var(--muted); }
    .eyebrow { margin: 0; color: var(--accent); font: 700 0.72rem/1 var(--mono); letter-spacing: 0.1em; text-transform: uppercase; }
    .answer { margin: 0 0 1rem; }
    .answer strong { color: var(--text); letter-spacing: 0.08em; }
    .summary { margin: 0 0 1.1rem; padding: 0.7rem 0; border-block: 1px solid var(--line); white-space: pre; color: var(--text); font-size: 1.05rem; letter-spacing: 0.05em; }
    .result-action { margin-left: 0.45rem; }
    .reset { color: var(--burgundy); border-color: var(--burgundy); }
    .solution { color: var(--accent); border-color: var(--accent); }
    .share { color: var(--blue); border-color: var(--blue); }
    .share.copied,
    .share.copied:hover,
    .share.copied:active { color: var(--panel); background: var(--green); border-color: var(--green); }
    .copy-status { min-height: 1.2em; margin: 0.65rem 0 0; font-size: 0.82rem; }
    .copy-failed { color: var(--burgundy); }
    .manual-copy { width: 100%; min-height: 7.25rem; margin-top: 0.45rem; resize: vertical; border: 1px solid var(--ink); background: var(--panel-raised); color: var(--text); font: 0.75rem/1.35 var(--mono); }
    @media (max-width: 420px) {
        .result-action { margin-top: 0.45rem; margin-left: 0; }
    }
</style>
