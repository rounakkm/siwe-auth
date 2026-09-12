import type { SessionOptions } from "iron-session";


export function getSessionOptions(): SessionOptions {
  const password =
    process.env.SESSION_PASSWORD ||
    process.env.IRON_SESSION_SECRET ||
    "default_development_session_secret_at_least_32_characters_long!";

  if (process.env.NODE_ENV === "production" && password.length < 32) {
    throw new Error(
      "SESSION_PASSWORD or IRON_SESSION_SECRET must be at least 32 characters long in production"
    );
  }

  return {
    password,
    cookieName: process.env.SESSION_COOKIE_NAME || "siwe_session",
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
    },
  };
}
