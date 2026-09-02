<script>
    import { tick } from "svelte";

    export let show;
    let dialog;
    let wasShown = false;
    let priorFocus;

    $: if (show && !wasShown) {
        wasShown = true;
        priorFocus = document.activeElement;
        // On desktop, keep focus on the dialog itself. Focusing the first
        // button meant the Enter key that submitted the final guess could be
        // interpreted as activating “Copy result”, making it look like the
        // result was copied automatically. Touch devices retain the original
        // first-action focus behavior.
        tick().then(() => {
            const touchDevice = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
            const firstAction = dialog?.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
            (touchDevice ? firstAction : dialog)?.focus();
        });
    } else if (!show && wasShown) {
        wasShown = false;
        priorFocus?.focus?.();
    }

    function trapFocus(event) {
        if (!show || event.key !== "Tab") return;
        const focusable = [...dialog.querySelectorAll("button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")];
        if (!focusable.length) { event.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
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
