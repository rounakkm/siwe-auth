import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { getSessionOptions } from "../config/session";
import type { SessionData } from "../types";

export const defaultSession: SessionData = {
  authenticated: false,
};

export class InMemoryCookieStore {
  private cookies: Map<string, string> = new Map();

  get(name: string) {
    const val = this.cookies.get(name);
    return val !== undefined ? { name, value: val } : undefined;
  }

  set(name: string, value: string) {
    this.cookies.set(name, value);
  }

  delete(name: string) {
    this.cookies.delete(name);
  }

  getAll() {
    return Array.from(this.cookies.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }
}


export async function getSession(
  customCookieStore?: any
): Promise<IronSession<SessionData>> {
  let cookieStore = customCookieStore;

  if (!cookieStore) {
    try {
      cookieStore = await cookies();
    } catch {
      cookieStore = new InMemoryCookieStore();
    }
  }

  const session = await getIronSession<SessionData>(
    cookieStore,
    getSessionOptions()
  );

  if (typeof session.authenticated !== "boolean") {
    session.authenticated = defaultSession.authenticated;
  }

  return session;
}
