import { NextResponse } from "next/server";

const CLEAR = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 0,
  path: "/",
};

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("staff-token", "", CLEAR);
  res.cookies.set("admin-token", "", CLEAR);
  return res;
}
