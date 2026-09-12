import { NextResponse } from "next/server";
import { getSession } from "./session";

export interface AuthenticatedContext {
  address: `0x${string}`;
}


export async function requireAuth(
  cookieStore?: any
): Promise<
  | { context: AuthenticatedContext; response: null }
  | { context: null; response: NextResponse }
> {
  const session = await getSession(cookieStore);

  if (!session.authenticated || !session.address) {
    return {
      context: null,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized: authentication required" },
        {
          status: 401,
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        }
      ),
    };
  }


  return {
    context: { address: session.address as `0x${string}` },
    response: null,
  };
}
