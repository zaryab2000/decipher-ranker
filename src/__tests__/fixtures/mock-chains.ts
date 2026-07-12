import { vi } from "vitest";

export function makeSelectChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.groupBy = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfill);
  return chain;
}

export function makeInsertChain() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn(() => chain);
  chain.onConflictDoUpdate = vi.fn(() => chain);
  chain.onConflictDoNothing = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(undefined).then(onFulfill);
  return chain;
}

export function makeUpdateChain() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(undefined).then(onFulfill);
  return chain;
}

export interface MockDbState {
  results: unknown[][];
  index: number;
}

export function createMockState(): MockDbState {
  return { results: [], index: 0 };
}

export function setResults(state: MockDbState, ...results: unknown[][]) {
  state.results = results;
  state.index = 0;
}

export function nextResult(state: MockDbState): unknown[] {
  const result = state.index < state.results.length
    ? state.results[state.index]
    : [];
  state.index++;
  return result;
}
