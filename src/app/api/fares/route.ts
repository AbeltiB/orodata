import { NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export async function GET() {
  const result = await queryDb("SELECT * FROM fares ORDER BY id ASC");
  return NextResponse.json({ data: result.rows });
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

  await queryDb(
    "INSERT INTO fares (vehicle_kind, level, road_type, multiplier) VALUES ($1, $2, $3, $4)",
    [vehicle_kind, level, road_type, parsedMultiplier]
  );

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

  await queryDb(
    "UPDATE fares SET vehicle_kind = $1, level = $2, road_type = $3, multiplier = $4 WHERE id = $5",
    [vehicle_kind, level, road_type, parsedMultiplier, id]
  );

  return NextResponse.json({ data: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Fare id is required." }, { status: 400 });
  }

  await queryDb("DELETE FROM fares WHERE id = $1", [id]);
  return NextResponse.json({ data: true });
}
