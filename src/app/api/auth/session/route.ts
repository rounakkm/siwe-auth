import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";


export async function GET(
  _req?: NextRequest,
  context?: { params?: Promise<Record<string, string>>; cookieStore?: any }
) {
  try {
    const session = await getSession(context?.cookieStore);

    if (session.authenticated && session.address) {
      return NextResponse.json(
        {
          authenticated: true,
          address: session.address,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      {
        authenticated: false,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        authenticated: false,
        error: "Failed to retrieve session",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
