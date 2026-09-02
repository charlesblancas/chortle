<script>
    export let letter;
    export let status;
    export let compact = false;
    export let ghost = false;
</script>

<div
    class:compact
    class:ghost
    class:green={status === 2}
    class:yellow={status === 1}
    class:gray={status === 0}
>
    {letter}
</div>

<style>
    div {
        width: clamp(2.7rem, 10vw, 3.35rem);
        height: clamp(2.7rem, 10vw, 3.35rem);
        border: 1px solid var(--ink);
        font: 700 clamp(1.15rem, 4vw, 1.45rem)/1 var(--sans);
        letter-spacing: 0.03em;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .compact { width: 1.55rem; height: 1.55rem; font-size: 0.75rem; border-color: var(--ink); }
    .ghost { color: var(--burgundy); border-color: var(--burgundy); border-style: dashed; opacity: 0.58; }

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
        div { width: 2.2rem; height: 2.2rem; font-size: 0.95rem; }
        .compact { width: 1.2rem; height: 1.2rem; font-size: 0.6rem; }
    }
    @media (max-width: 420px) and (max-height: 760px) {
        div { width: 2rem; height: 2rem; font-size: 0.88rem; }
        .compact { width: 1.05rem; height: 1.05rem; font-size: 0.55rem; }
    }
</style>
