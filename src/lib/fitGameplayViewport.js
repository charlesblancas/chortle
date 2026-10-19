/** Reserve room for actual controls before sizing the square board.
 * Existing CSS chooses the preferred size; this only caps it when it overflows.
 */
export function fitGameplayViewport(node) {
    const main = node.closest('main');
    let frame;
    let disposed = false;
    function fit() {
        frame = undefined;
        if (disposed || !main || document.body.style.position === 'fixed') return;
        // Keep pinch zoom usable rather than shrinking content away from the user.
        if (window.visualViewport?.scale > 1.05) return;
        // Expanded development tools are an intentional document, not gameplay.
        if (main.querySelector('.debug-fixtures[open]')) return;
        node.style.removeProperty('--viewport-board-limit');
        node.classList.remove('viewport-compact');
        const board = node.querySelector('.replay-board, .live-play .chess');
        if (!board) return;
        const bottom = Math.min(window.innerHeight, window.visualViewport?.height ?? window.innerHeight);
        const budget = () => board.getBoundingClientRect().width + bottom - main.getBoundingClientRect().bottom - 8;
        if (window.innerWidth <= 510 && budget() < 160) node.classList.add('viewport-compact');
        const limit = Math.floor(budget());
        if (limit < board.getBoundingClientRect().width) {
            node.style.setProperty('--viewport-board-limit', `${Math.max(80, limit)}px`);
        }
    }
    function schedule() {
        if (!disposed && !frame) frame = requestAnimationFrame(fit);
    }
    const resize = new ResizeObserver(schedule);
    resize.observe(main);
    const content = new MutationObserver(schedule);
    content.observe(node, { childList: true, subtree: true, characterData: true });
    const modal = new MutationObserver(schedule);
    modal.observe(document.body, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    document.fonts?.ready.then(schedule);
    schedule();
    return { destroy() {
        disposed = true;
        cancelAnimationFrame(frame);
        resize.disconnect();
        content.disconnect();
        modal.disconnect();
        window.removeEventListener('resize', schedule);
        window.visualViewport?.removeEventListener('resize', schedule);
    } };
}
