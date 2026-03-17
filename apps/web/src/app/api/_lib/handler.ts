import { NextRequest, NextResponse } from 'next/server';
import type { CustomClaims } from '@vizo/shared';
import { verifyAuth } from './auth';
import { ApiError } from './errors';

export interface ActionContext {
  uid: string;
  claims: CustomClaims;
  data: unknown;
}

type ActionHandler = (ctx: ActionContext) => Promise<unknown>;

/**
 * Creates a Next.js POST route handler that dispatches to action handlers.
 * Request body: { action: string, data?: unknown }
 * Response: { data: ... } on success, { error: { code, message } } on failure.
 */
export function createRouteHandler(actions: Record<string, ActionHandler>) {
  return async function POST(request: NextRequest): Promise<NextResponse> {
    try {
      const body = await request.json();
      const { action, data } = body as { action: string; data?: unknown };

      const handler = actions[action];
      if (!handler) {
        return NextResponse.json(
          { error: { code: 'not-found', message: `Unknown action: ${action}` } },
          { status: 404 },
        );
      }

      const { uid, claims } = await verifyAuth(request.headers.get('authorization'));
      const result = await handler({ uid, claims, data });
      return NextResponse.json({ data: result });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        return NextResponse.json(
          { error: { code: err.code, message: err.message } },
          { status: err.status },
        );
      }

      const message = err instanceof Error ? err.message : 'Internal server error';
      console.error('[API Route Error]', err);
      return NextResponse.json(
        { error: { code: 'internal', message } },
        { status: 500 },
      );
    }
  };
}
