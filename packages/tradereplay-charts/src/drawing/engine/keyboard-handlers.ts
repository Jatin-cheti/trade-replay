export interface KeyboardManager {
  register(shortcut: string, callback: () => void): void;
  unregister(shortcut: string): void;
  clear(): void;
  handle(event: KeyboardEvent): boolean;
  dispose(): void;
}

class DefaultKeyboardManager implements KeyboardManager {
  private readonly handlers = new Map<string, () => void>();
  private readonly listener = (event: KeyboardEvent) => {
    this.handle(event);
  };

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.listener);
    }
  }

  register(shortcut: string, callback: () => void): void {
    this.handlers.set(normalizeShortcut(shortcut), callback);
  }

  unregister(shortcut: string): void {
    this.handlers.delete(normalizeShortcut(shortcut));
  }

  clear(): void {
    this.handlers.clear();
  }

  handle(event: KeyboardEvent): boolean {
    const key = serializeEvent(event);
    const handler = this.handlers.get(key);
    if (!handler) {
      return false;
    }
    event.preventDefault();
    handler();
    return true;
  }

  dispose(): void {
    this.clear();
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.listener);
    }
  }
}

function normalizeShortcut(shortcut: string): string {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  const key = parts.pop() ?? '';
  const mods = parts.sort();
  return [...mods, key].join('+');
}

function serializeEvent(event: KeyboardEvent): string {
  const mods: string[] = [];
  if (event.ctrlKey || event.metaKey) mods.push('control');
  if (event.altKey) mods.push('alt');
  if (event.shiftKey) mods.push('shift');
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key.toLowerCase();
  return [...mods.sort(), key].join('+');
}

export function createDefaultKeyboardManager(): KeyboardManager {
  return new DefaultKeyboardManager();
}
