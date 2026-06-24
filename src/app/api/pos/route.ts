import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const machines = await prisma.posMachine.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({ data: machines });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { serial_number, version, type, station_id } = body;

  if (!serial_number || !version || !type || !station_id) {
    return NextResponse.json({ error: "All required fields are needed." }, { status: 400 });
  }

  await prisma.posMachine.create({ data: { serial_number, version, type, station_id } });

  return NextResponse.json({ data: true });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, serial_number, version, type, station_id } = body;

  if (!id || !serial_number || !version || !type || !station_id) {
    return NextResponse.json({ error: "All required fields are needed for update." }, { status: 400 });
  }

  await prisma.posMachine.update({ where: { id }, data: { serial_number, version, type, station_id } });

  return NextResponse.json({ data: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "POS id is required." }, { status: 400 });
  }

  await prisma.posMachine.delete({ where: { id } });
  return NextResponse.json({ data: true });
}
