import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const employees = await prisma.employee.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({ data: employees });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { first_name, middle_name, last_name, email, phone, role, username, password, station_id } = body;

  if (!first_name || !last_name || !email || !role || !username || !password || !station_id) {
    return NextResponse.json({ error: "All required fields are needed." }, { status: 400 });
  }

  await prisma.employee.create({
    data: { first_name, middle_name: middle_name ?? null, last_name, email, phone, role, username, password, station_id },
  });

  return NextResponse.json({ data: true });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, first_name, middle_name, last_name, email, phone, role, username, password, station_id } = body;

  if (!id || !first_name || !last_name || !email || !role || !username || !password || !station_id) {
    return NextResponse.json({ error: "All required fields are needed for update." }, { status: 400 });
  }

  await prisma.employee.update({
    where: { id },
    data: { first_name, middle_name: middle_name ?? null, last_name, email, phone, role, username, password, station_id },
  });

  return NextResponse.json({ data: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Employee id is required." }, { status: 400 });
  }

  await prisma.employee.delete({ where: { id } });
  return NextResponse.json({ data: true });
}
