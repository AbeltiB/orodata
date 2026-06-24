import { NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export async function GET() {
  const result = await queryDb("SELECT * FROM stations ORDER BY id ASC");
  return NextResponse.json({ data: result.rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, location } = body;

  if (!name || !location) {
    return NextResponse.json({ error: "Name and location are required." }, { status: 400 });
  }

  await queryDb("INSERT INTO stations (name, location) VALUES ($1, $2)", [name, location]);
  return NextResponse.json({ data: true });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, name, location } = body;

  if (!id || !name || !location) {
    return NextResponse.json({ error: "Station id, name, and location are required." }, { status: 400 });
  }

  await queryDb("UPDATE stations SET name = $1, location = $2 WHERE id = $3", [name, location, id]);
  return NextResponse.json({ data: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Station id is required." }, { status: 400 });
  }

  await queryDb("DELETE FROM stations WHERE id = $1", [id]);
  return NextResponse.json({ data: true });
}
