
export const formatShortcut = (shortcut: string): string => {
    if (!shortcut) return '';
    const isMac = navigator.platform.toUpperCase().includes('MAC');
    return shortcut
        .replace('Control', isMac ? '⌘' : 'Ctrl')
        .replace('Enter', '↩')
        .replace('N', 'N');
};
