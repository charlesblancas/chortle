<script>
    import Modal from "./Modal.svelte";
    import { gameOver } from "../stores";
    import { copy } from "svelte-copy";

    export let word;
    export let move;
    export let statuses;
    export let chessStatuses;

    const shareMessage = "https://chortle.select\n";
    let gameSummary = "";

    let gameOverValue;
    gameOver.subscribe((value) => {
        gameOverValue = value;

        if (value) {
            gameSummary = generateSummary();
        }
    });

    function randomPartyEmoji() {
        let possible = ["🎉", "🥳", "🎊", "🎈", "🍾", "🥂"];
        let index = Math.floor(Math.random() * possible.length);
        return possible[index];
    }

    function numberToSquare(number) {
        switch (number) {
            case 0: {
                return "⬛";
            }
            case 1: {
                return "🟨";
            }
            case 2: {
                return "🟩";
            }
            default: {
                return randomPartyEmoji();
            }
        }
    }

    function generateSummary() {
        let out = "";
        for (let i = 0; i < statuses.length; i++) {
            let line = "";
            for (let j = 0; j < statuses[i].length; j++) {
                line = line + numberToSquare(statuses[i][j]);
            }
            for (let j = 0; j < chessStatuses[i].length; j++) {
                line = line + numberToSquare(chessStatuses[i][j]);
            }
            out += line + "\n";
        }
        return out;
    }
</script>

<Modal show={gameOverValue}>
    <h1>Game Over</h1>
    <h4>The answer was {word} and {move}</h4>
    <p class="summary">{gameSummary}</p>
    <button use:copy={shareMessage + gameSummary}>Share</button>
</Modal>

<style>
    .summary {
        white-space: pre;
    }
</style>
