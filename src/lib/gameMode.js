import { safeStorage } from './gameStorage.js';

export const MODE_PREFERENCE_KEY = 'chortle:game-mode-v1';
let sessionMode;
export function saveGameMode(mode) {
    sessionMode = mode === 'line' ? 'line' : 'normal';
    try { safeStorage().setItem(MODE_PREFERENCE_KEY, sessionMode); } catch { /* Optional preference. */ }
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
