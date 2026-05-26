import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!password || password !== process.env.STAFF_PASSWORD) {
    return NextResponse.json({ error: "Incorrect passphrase." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("staff-token", process.env.STAFF_TOKEN!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return res;
}
