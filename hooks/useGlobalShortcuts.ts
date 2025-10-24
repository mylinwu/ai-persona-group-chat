
import { useEffect } from 'react';

interface Shortcut {
    shortcut: string;
    handler: () => void;
    requireNoInputFocus?: boolean;
}

const checkShortcut = (shortcut: string, event: KeyboardEvent): boolean => {
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    const parts = shortcut.split('+');
    const key = parts.pop()?.toLowerCase();
    if (!key) return false;

    const needsCtrl = parts.includes('Control');
    const needsAlt = parts.includes('Alt');
    const needsShift = parts.includes('Shift');
    
    const hasCtrl = isMac ? event.metaKey : event.ctrlKey;

    return (
        event.key.toLowerCase() === key &&
        needsCtrl === hasCtrl &&
        needsAlt === event.altKey &&
        needsShift === event.shiftKey
    );
};

export const useGlobalShortcuts = (shortcuts: Shortcut[]) => {
    useEffect(() => {
        const handleGlobalKeyDown = (event: KeyboardEvent) => {
            const activeElement = document.activeElement;
            const isInputFocused = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;

            for (const { shortcut, handler, requireNoInputFocus } of shortcuts) {
                if (requireNoInputFocus && isInputFocused) {
                    continue;
                }
                if (checkShortcut(shortcut, event)) {
                    event.preventDefault();
                    handler();
                    return; // Handle first match
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [shortcuts]);
};
