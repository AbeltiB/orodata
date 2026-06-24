import { NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export async function GET() {
  const result = await queryDb("SELECT * FROM pos_machines ORDER BY id ASC");
  return NextResponse.json({ data: result.rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { serial_number, version, type, station_id } = body;

  if (!serial_number || !version || !type || !station_id) {
    return NextResponse.json({ error: "All required fields are needed." }, { status: 400 });
  }

  await queryDb("INSERT INTO pos_machines (serial_number, version, type, station_id) VALUES ($1, $2, $3, $4)", [
    serial_number,
    version,
    type,
    station_id,
  ]);

  return NextResponse.json({ data: true });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, serial_number, version, type, station_id } = body;

  if (!id || !serial_number || !version || !type || !station_id) {
    return NextResponse.json({ error: "All required fields are needed for update." }, { status: 400 });
  }

  await queryDb(
    "UPDATE pos_machines SET serial_number = $1, version = $2, type = $3, station_id = $4 WHERE id = $5",
    [serial_number, version, type, station_id, id]
  );

  return NextResponse.json({ data: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "POS id is required." }, { status: 400 });
  }

  await queryDb("DELETE FROM pos_machines WHERE id = $1", [id]);
  return NextResponse.json({ data: true });
}
