import { NextResponse } from "next/server";
import { nonceStore } from "@/lib/nonce";


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
