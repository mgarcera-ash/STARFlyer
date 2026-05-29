import { NextRequest, NextResponse } from "next/server";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: "/",
};

export async function POST(req: NextRequest) {
  const { password, role } = await req.json();

  if (!password) {
    return NextResponse.json({ error: "Incorrect passphrase." }, { status: 401 });
  }

  if (role === "admin" && password === process.env.ADMIN_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("admin-token", process.env.ADMIN_TOKEN!, COOKIE_OPTS);
    return res;
  }

  return NextResponse.json({ error: "Incorrect passphrase." }, { status: 401 });
}
