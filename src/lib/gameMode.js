import { safeStorage } from './gameStorage.js';
import { track } from './analytics.js';

export const MODE_PREFERENCE_KEY = 'chortle:game-mode-v1';
let sessionMode;
export function saveGameMode(mode) {
    sessionMode = mode === 'line' ? 'line' : 'normal';
    try { safeStorage().setItem(MODE_PREFERENCE_KEY, sessionMode); } catch { /* Optional preference. */ }
}

export function switchGameMode(event, mode) {
    // Remount in this tab rather than throwing away the storage fallback on reload.
    saveGameMode(mode);
    track('mode_changed', { mode });
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.dispatchEvent(new CustomEvent('game-mode-changed', { detail: mode }));
}

export function preferredGameMode() {
    const url = new URL(window.location.href);
    const legacy = url.searchParams.get('mode');
    if (legacy === 'line' || legacy === 'normal') saveGameMode(legacy);
    if (url.searchParams.has('mode')) {
        url.searchParams.delete('mode');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    try { return sessionMode ?? (safeStorage().getItem(MODE_PREFERENCE_KEY) === 'line' ? 'line' : 'normal'); }
    catch { return legacy === 'line' ? 'line' : 'normal'; }
}
