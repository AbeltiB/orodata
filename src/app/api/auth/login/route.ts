import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { username, password } = await req.json();
  if (!username || !password) return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
  const employee = await prisma.employee.findFirst({ where: { username, password } });
  if (!employee) return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  if (!employee.isActive) return NextResponse.json({ error: "This employee account is inactive. Contact an administrator." }, { status: 403 });
  return NextResponse.json({ data: { id: employee.id, username: employee.username, role: employee.role } });
}
