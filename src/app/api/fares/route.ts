import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const fares = await prisma.fare.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({ data: fares });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { vehicle_kind, level, road_type, multiplier } = body;

  if (!vehicle_kind || !level || !road_type || multiplier == null) {
    return NextResponse.json({ error: "All fare fields are required." }, { status: 400 });
  }

  const parsedMultiplier = Number(multiplier);
  if (Number.isNaN(parsedMultiplier) || parsedMultiplier <= 0) {
    return NextResponse.json({ error: "Multiplier must be a positive number." }, { status: 400 });
  }

  await prisma.fare.create({ data: { vehicle_kind, level, road_type, multiplier: parsedMultiplier } });

  return NextResponse.json({ data: true });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, vehicle_kind, level, road_type, multiplier } = body;

  if (!id || !vehicle_kind || !level || !road_type || multiplier == null) {
    return NextResponse.json({ error: "All fare fields are required for update." }, { status: 400 });
  }

  const parsedMultiplier = Number(multiplier);
  if (Number.isNaN(parsedMultiplier) || parsedMultiplier <= 0) {
    return NextResponse.json({ error: "Multiplier must be a positive number." }, { status: 400 });
  }

  await prisma.fare.update({ where: { id }, data: { vehicle_kind, level, road_type, multiplier: parsedMultiplier } });

  return NextResponse.json({ data: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Fare id is required." }, { status: 400 });
  }

  await prisma.fare.delete({ where: { id } });
  return NextResponse.json({ data: true });
}
