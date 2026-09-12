import { NextResponse } from "next/server";
import { nonceStore } from "@/lib/nonce";

/**
 * GET /api/auth/nonce
 *
 * Generates and stores a cryptographically secure nonce on the server,
 * returning it to the client for inclusion in the SIWE signing workflow.
 */
export async function GET() {
  try {
    const nonce = nonceStore.generateAndStore();

    return NextResponse.json(
      { nonce },
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
        error: "Failed to generate authentication nonce",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
