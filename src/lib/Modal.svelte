<script>
    import { tick } from "svelte";

    export let show;
    let dialog;
    let wasShown = false;
    let priorFocus;

    function focusableElements() {
        if (!dialog) return [];
        return [...dialog.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")]
            .filter((node) => node.getClientRects().length > 0);
    }

    $: if (show && !wasShown) {
        wasShown = true;
        priorFocus = document.activeElement;
        tick().then(() => {
            // Start every modal on its heading/container. This avoids
            // accidentally activating the first action button when the modal
            // opens immediately after Enter submitted a guess, while still
            // giving screen readers a stable dialog context.
            dialog?.focus();
        });
    } else if (!show && wasShown) {
        wasShown = false;
        if (priorFocus && priorFocus.isConnected && typeof priorFocus.focus === "function") priorFocus.focus();
    }

    function trapFocus(event) {
        if (!show || event.key !== "Tab") return;
        const focusable = focusableElements();
        if (!focusable.length) { event.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
</script>

<svelte:window on:keydown={trapFocus} />

{#if show}
    <div class="modal-layer">
        <div class="modal-card" bind:this={dialog} role="dialog" aria-modal="true" aria-label="Chortle dialog" tabindex="-1">
            <slot />
        </div>
    </div>
{/if}

<style>
    .modal-layer { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 1rem; background: rgba(38, 50, 56, 0.18); }
    .modal-card {
        position: relative;
        width: min(100%, 34rem);
        max-height: 100%;
        overflow: auto;
        box-sizing: border-box;
        padding: clamp(1.25rem, 4vw, 2rem);
        border-top: 3px solid var(--ink);
        border-bottom: 3px solid var(--ink);
        border-left: 1px solid var(--line);
        border-right: 1px solid var(--line);
        background-color: var(--panel);
        color: var(--text);
    }
</style>
