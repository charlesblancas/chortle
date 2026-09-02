<script>
    import { FIXTURES } from "../fixtures";

    export let selected = "";
    $: active = FIXTURES.find((fixture) => fixture.id === selected) || null;

    function load(event) {
        const id = event.currentTarget.value;
        const url = new URL(window.location.href);
        if (id) url.searchParams.set("fixture", id);
        else url.searchParams.delete("fixture");
        window.location.href = url.toString();
    }
</script>

<aside class="debug-fixtures" aria-label="Debug fixtures">
    <label for="fixture-select">Debug fixture</label>
    <select id="fixture-select" value={selected} on:change={load}>
        <option value="">Daily puzzle</option>
        {#each FIXTURES as fixture}<option value={fixture.id}>{fixture.label}</option>{/each}
    </select>
    {#if active}<p>{active.description}</p><small>{active.instructions}</small>{/if}
</aside>

<style>
    .debug-fixtures { margin: 0 auto 0.75rem; padding: 0.5rem 0.65rem; border: 1px dashed var(--burgundy); color: var(--muted); font: 0.72rem/1.35 var(--mono); }
    label { margin-right: 0.45rem; color: var(--burgundy); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    select { border: 1px solid var(--line); border-radius: 0; background: var(--panel); color: var(--text); font: inherit; padding: 0.2rem 0.35rem; }
    p { margin: 0.45rem 0 0; }
    small { display: block; margin-top: 0.25rem; color: var(--text); }
</style>
