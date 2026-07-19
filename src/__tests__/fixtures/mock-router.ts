import { NextRequest, NextResponse } from "next/server";
import { vi } from "vitest";
import type { ZodType } from "zod";

/**
 * Test double for `@/lib/router`. Payment (x402) and identity (SIWX) verification
 * are the router library's responsibility and are exercised by its own test
 * suite — here we mock them away so each route test can drive the handler's
 * business logic directly.
 *
 * The builder mirrors the real fluent API (`.route().siwx()/.paid()/.unprotected()
 * .body().query().description().inputExample().handler()`) but `.handler(fn)`
 * returns a plain Next.js handler that:
 *   - validates the request body/query against the registered Zod schema,
 *     returning 400 on failure (matching the router's validation behavior);
 *   - passes a `wallet` derived from the `x-test-wallet` header (null when
 *     absent), so paid/SIWX routes can assert wallet-dependent behavior;
 *   - serializes the handler's return value to JSON, or maps a thrown error to
 *     a 500 — the shape route tests assert against.
 */
export function installRouterMock(): void {
  vi.mock("@/lib/router", () => ({ router: makeMockRouter() }));
}

interface BuilderState {
  bodySchema?: ZodType<unknown>;
  querySchema?: ZodType<unknown>;
}

function makeMockRouter() {
  return {
    route() {
      return makeBuilder({});
    },
    openapi: () => async () => NextResponse.json({}),
    wellKnown: () => async () => NextResponse.json({}),
    llmsTxt: () => async () => new NextResponse(""),
    notFound: () => async () => NextResponse.json({}, { status: 404 }),
  };
}

function makeBuilder(state: BuilderState) {
  const builder = {
    siwx: () => makeBuilder(state),
    paid: () => makeBuilder(state),
    unprotected: () => makeBuilder(state),
    description: () => makeBuilder(state),
    inputExample: () => makeBuilder(state),
    outputExample: () => makeBuilder(state),
    output: () => makeBuilder(state),
    tags: () => makeBuilder(state),
    method: () => makeBuilder(state),
    path: () => makeBuilder(state),
    body: (schema: ZodType<unknown>) => makeBuilder({ ...state, bodySchema: schema }),
    query: (schema: ZodType<unknown>) =>
      makeBuilder({ ...state, querySchema: schema }),
    handler:
      (fn: (ctx: HandlerCtx) => Promise<unknown>) =>
      async (request: NextRequest): Promise<Response> => {
        try {
          const ctx = await buildContext(request, state);
          if (ctx instanceof NextResponse) return ctx;
          const result = await fn(ctx);
          return NextResponse.json(result);
        } catch {
          return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 },
          );
        }
      },
  };
  return builder;
}

interface HandlerCtx {
  body: unknown;
  query: unknown;
  request: NextRequest;
  wallet: string | null;
}

async function buildContext(
  request: NextRequest,
  state: BuilderState,
): Promise<HandlerCtx | NextResponse> {
  let body: unknown;
  if (state.bodySchema) {
    const raw = await readJson(request);
    const parsed = state.bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    body = parsed.data;
  }

  let query: unknown;
  if (state.querySchema) {
    const params = Object.fromEntries(request.nextUrl.searchParams.entries());
    const parsed = state.querySchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query params" },
        { status: 400 },
      );
    }
    query = parsed.data;
  }

  return {
    body,
    query,
    request,
    wallet: request.headers.get("x-test-wallet"),
  };
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
