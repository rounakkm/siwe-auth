import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";


export async function POST(
  _req?: NextRequest,
  context?: { params?: Promise<Record<string, string>>; cookieStore?: any }
) {
  try {
    const session = await getSession(context?.cookieStore);
    session.destroy();

    return NextResponse.json(
      {
        ok: true,
        message: "Logged out successfully",
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
        ok: false,
        error: "Failed to log out",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
