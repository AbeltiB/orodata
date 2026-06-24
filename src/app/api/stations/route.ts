import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const stations = await prisma.station.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({ data: stations });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, location } = body;

  if (!name || !location) {
    return NextResponse.json({ error: "Name and location are required." }, { status: 400 });
  }

  await prisma.station.create({ data: { name, location } });
  return NextResponse.json({ data: true });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, name, location } = body;

  if (!id || !name || !location) {
    return NextResponse.json({ error: "Station id, name, and location are required." }, { status: 400 });
  }

  await prisma.station.update({ where: { id }, data: { name, location } });
  return NextResponse.json({ data: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Station id is required." }, { status: 400 });
  }

  await prisma.station.delete({ where: { id } });
  return NextResponse.json({ data: true });
}
