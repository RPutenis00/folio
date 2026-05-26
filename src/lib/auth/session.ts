import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type IronSession, type SessionOptions } from "iron-session";

export type SessionData = {
  userId?: string;
  email?: string;
};

const sessionOptions: SessionOptions = {
  cookieName: "folio_session",
  password: process.env.SESSION_PASSWORD ?? "dev-only-please-change-me-this-is-32+characters-long",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
