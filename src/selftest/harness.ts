// ============================================================
// Self-test harness — browser shims for a Node run
// ============================================================
// The service layer is the part worth testing without a browser: the
// repository, the scoping rules, the metric derivations and the sync
// queue all run headless. These shims give them the four browser globals
// they touch, so `npm run selftest` exercises the real modules rather
// than a re-implementation of them.

interface StoreLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
  key(i: number): string | null;
  readonly length: number;
}

function createStore(): StoreLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => {
      map.set(key, String(value));
    },
    removeItem: (key) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

type Listener = (event: unknown) => void;

class FakeEventTarget {
  private listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: { type: string }): boolean {
    this.listeners.get(event.type)?.forEach((listener) => listener(event));
    return true;
  }
}

/** Installs the globals the services expect. Call once, before imports. */
export function installBrowserShims(): void {
  const g = globalThis as Record<string, unknown>;

  g.localStorage = createStore();
  g.sessionStorage = createStore();

  const target = new FakeEventTarget();
  g.window = target;
  (g.window as Record<string, unknown>).localStorage = g.localStorage;
  (g.window as Record<string, unknown>).sessionStorage = g.sessionStorage;

  // Node 24 ships a read-only `navigator`, so this has to be redefined
  // rather than assigned.
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    writable: true,
    configurable: true,
  });

  // The services build events with `new CustomEvent(...)`/`new Event(...)`.
  class FakeEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }
  g.CustomEvent = FakeEvent;
  g.Event = FakeEvent;
}

/** Puts the device offline (or back online) and fires the event. */
export function setOnline(online: boolean): void {
  const g = globalThis as Record<string, unknown>;
  (g.navigator as { onLine: boolean }).onLine = online;
  const EventCtor = g.Event as new (type: string) => { type: string };
  (g.window as FakeEventTarget).dispatchEvent(new EventCtor(online ? 'online' : 'offline'));
}

// ------------------------------------------------------------
// Assertions
// ------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures: string[] = [];

export function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    process.stdout.write(`  PASS  ${label}\n`);
  } else {
    failed += 1;
    failures.push(label + (detail ? ` — ${detail}` : ''));
    process.stdout.write(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}\n`);
  }
}

export function checkEqual(label: string, actual: unknown, expected: unknown): void {
  check(label, Object.is(actual, expected), `expected ${String(expected)}, got ${String(actual)}`);
}

export function section(title: string): void {
  process.stdout.write(`\n${title}\n${'-'.repeat(title.length)}\n`);
}

export function report(): void {
  process.stdout.write(`\n${'='.repeat(56)}\n`);
  process.stdout.write(`  ${passed} passed, ${failed} failed\n`);
  if (failures.length > 0) {
    process.stdout.write('\nFailures:\n');
    failures.forEach((f) => process.stdout.write(`  - ${f}\n`));
  }
  process.stdout.write(`${'='.repeat(56)}\n`);
  if (failed > 0) process.exitCode = 1;
}
