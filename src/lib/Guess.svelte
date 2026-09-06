<script>
    import Tile from "./Tile.svelte";
    import { FILE_LETTERS, chessMoveStatus } from "../gameRules";

    export let status;
    export let word;
    export let active = false;
    export let previewLetter = "";
    export let actions = [];
    export let solutionMoves = [];

    function formatMove(uci = "") {
        if (!uci) return "";
        const promotion = uci[4] ? `=${uci[4].toUpperCase()}` : "";
        return `${uci.slice(0, 2).toUpperCase()}→${uci.slice(2, 4).toUpperCase()}${promotion}`;
    }

    // A scored row is the only kind allowed to show feedback. This also keeps
    // restored or debug rows neutral when they contain an in-progress move.
    $: submitted = status.some((value) => value >= 0);

    $: tileDetails = (() => {
        let actionIndex = 0;
        return Array.from({ length: 5 }, (_, index) => {
            // A move can be recorded while the player is composing a guess, but
            // feedback belongs to a submitted row only.
            const letterStatus = submitted ? status[index] : -1;
            if (!FILE_LETTERS.includes(word[index] || "")) {
                return { move: "", moveStatus: letterStatus };
            }
            const action = actions[actionIndex++];
            return {
                move: formatMove(action?.uci),
                moveStatus: submitted ? chessMoveStatus(action, letterStatus, solutionMoves) : -1
            };
        });
    })();

    $: displayStatus = submitted ? status : Array(5).fill(-1);
</script>

<div class:active class="guess">
    <div class="tiles">
        <Tile letter={word[0] || (active && word.length === 0 ? previewLetter : "")} status={displayStatus[0]} moveStatus={tileDetails[0].moveStatus} ghost={active && word.length === 0 && !!previewLetter} move={tileDetails[0].move} />
        <Tile letter={word[1] || (active && word.length === 1 ? previewLetter : "")} status={displayStatus[1]} moveStatus={tileDetails[1].moveStatus} ghost={active && word.length === 1 && !!previewLetter} move={tileDetails[1].move} />
        <Tile letter={word[2] || (active && word.length === 2 ? previewLetter : "")} status={displayStatus[2]} moveStatus={tileDetails[2].moveStatus} ghost={active && word.length === 2 && !!previewLetter} move={tileDetails[2].move} />
        <Tile letter={word[3] || (active && word.length === 3 ? previewLetter : "")} status={displayStatus[3]} moveStatus={tileDetails[3].moveStatus} ghost={active && word.length === 3 && !!previewLetter} move={tileDetails[3].move} />
        <Tile letter={word[4] || (active && word.length === 4 ? previewLetter : "")} status={displayStatus[4]} moveStatus={tileDetails[4].moveStatus} ghost={active && word.length === 4 && !!previewLetter} move={tileDetails[4].move} />
    </div>
</div>

<style>
    .guess {
        display: flex;
        gap: 0.5rem;
    }

    .tiles {
        display: flex;
        gap: 0.3rem;
    }
</style>
