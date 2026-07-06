import { vi } from "vitest";

type MockResult = unknown[] | unknown;

interface MockDbState {
  selectResults: MockResult[];
  executeResults: MockResult[];
  selectIndex: number;
  executeIndex: number;
}

const state: MockDbState = {
  selectResults: [],
  executeResults: [],
  selectIndex: 0,
  executeIndex: 0,
};

function createSelectChain(results: unknown[]): unknown {
  const chain: Record<string, unknown> = {};
  const resolve = () => Promise.resolve(results);

  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.orderBy = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.offset = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) => resolve().then(onFulfill);

  return chain;
}

function createInsertChain(): unknown {
  const chain: Record<string, unknown> = {};

  chain.values = vi.fn(() => chain);
  chain.onConflictDoUpdate = vi.fn(() => chain);
  chain.onConflictDoNothing = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(undefined).then(onFulfill);

  return chain;
}

function createUpdateChain(): unknown {
  const chain: Record<string, unknown> = {};

  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(undefined).then(onFulfill);

  return chain;
}

function createDeleteChain(): unknown {
  const chain: Record<string, unknown> = {};

  chain.where = vi.fn(() => chain);
  chain.then = (onFulfill: (v: unknown) => unknown) =>
    Promise.resolve(undefined).then(onFulfill);

  return chain;
}

export function createMockDb() {
  const mockDb = {
    select: vi.fn(() => {
      const results =
        state.selectIndex < state.selectResults.length
          ? (state.selectResults[state.selectIndex++] as unknown[])
          : [];
      return createSelectChain(results);
    }),
    insert: vi.fn(() => createInsertChain()),
    update: vi.fn(() => createUpdateChain()),
    delete: vi.fn(() => createDeleteChain()),
    execute: vi.fn(() => {
      const result =
        state.executeIndex < state.executeResults.length
          ? state.executeResults[state.executeIndex++]
          : undefined;
      return Promise.resolve(result);
    }),
    query: new Proxy(
      {},
      {
        get(_target, _prop) {
          return {
            findMany: vi.fn(() => {
              const results =
                state.selectIndex < state.selectResults.length
                  ? state.selectResults[state.selectIndex++]
                  : [];
              return Promise.resolve(results);
            }),
            findFirst: vi.fn(() => {
              const results =
                state.selectIndex < state.selectResults.length
                  ? (state.selectResults[state.selectIndex++] as unknown[])
                  : [];
              return Promise.resolve(results[0] ?? null);
            }),
          };
        },
      },
    ),
  };

  return mockDb;
}

export function mockSelectResults(...results: unknown[][]): void {
  state.selectResults.push(...results);
}

export function mockExecuteResults(...results: unknown[]): void {
  state.executeResults.push(...results);
}

export function resetDbMocks(): void {
  state.selectResults = [];
  state.executeResults = [];
  state.selectIndex = 0;
  state.executeIndex = 0;
}
