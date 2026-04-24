/**
 * 小型 assertion helpers — 故意不用 jest，減少依賴。
 */
export class AssertionError extends Error {}

export function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new AssertionError(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

export function assertTrue(
  cond: unknown,
  label: string,
  extra?: string,
): asserts cond {
  if (!cond) {
    throw new AssertionError(`${label}${extra ? ` — ${extra}` : ''}`);
  }
}

export function assertIncludes(
  haystack: string[],
  needle: string,
  label: string,
): void {
  if (!haystack.includes(needle)) {
    throw new AssertionError(
      `${label}: expected [${haystack.join(', ')}] to include ${needle}`,
    );
  }
}

export interface ScenarioResult {
  name: string;
  ok: boolean;
  durationMs: number;
  error: string | null;
  skipped?: boolean;
  skipReason?: string;
}

export async function runScenario(
  name: string,
  fn: () => Promise<void>,
  opts: { skip?: boolean; skipReason?: string } = {},
): Promise<ScenarioResult> {
  if (opts.skip) {
    return {
      name,
      ok: true,
      durationMs: 0,
      error: null,
      skipped: true,
      skipReason: opts.skipReason,
    };
  }
  const start = Date.now();
  try {
    await fn();
    return {
      name,
      ok: true,
      durationMs: Date.now() - start,
      error: null,
    };
  } catch (err) {
    return {
      name,
      ok: false,
      durationMs: Date.now() - start,
      error:
        err instanceof Error
          ? `${err.name}: ${err.message}${err.stack ? '\n' + err.stack.split('\n').slice(0, 5).join('\n') : ''}`
          : String(err),
    };
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 輪詢某個條件，最多 timeoutMs 毫秒，每 intervalMs 檢查一次 */
export async function waitFor(
  predicate: () => Promise<boolean>,
  opts: { timeoutMs?: number; intervalMs?: number; label?: string } = {},
): Promise<void> {
  const timeout = opts.timeoutMs ?? 10_000;
  const interval = opts.intervalMs ?? 500;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return;
    await sleep(interval);
  }
  throw new AssertionError(
    `waitFor timed out after ${timeout}ms: ${opts.label ?? '(no label)'}`,
  );
}
