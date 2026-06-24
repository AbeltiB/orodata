import { NextResponse } from "next/server";
import { queryDb } from "@/lib/db";

export async function GET() {
  const result = await queryDb("SELECT * FROM employees ORDER BY id ASC");
  return NextResponse.json({ data: result.rows });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { first_name, middle_name, last_name, email, phone, role, username, password, station_id } = body;

  if (!first_name || !last_name || !email || !role || !username || !password || !station_id) {
    return NextResponse.json({ error: "All required fields are needed." }, { status: 400 });
  }

  await queryDb(
    "INSERT INTO employees (first_name, middle_name, last_name, email, phone, role, username, password, station_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    [first_name, middle_name, last_name, email, phone, role, username, password, station_id]
  );

  return NextResponse.json({ data: true });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, first_name, middle_name, last_name, email, phone, role, username, password, station_id } = body;

  if (!id || !first_name || !last_name || !email || !role || !username || !password || !station_id) {
    return NextResponse.json({ error: "All required fields are needed for update." }, { status: 400 });
  }

  await queryDb(
    "UPDATE employees SET first_name = $1, middle_name = $2, last_name = $3, email = $4, phone = $5, role = $6, username = $7, password = $8, station_id = $9 WHERE id = $10",
    [first_name, middle_name, last_name, email, phone, role, username, password, station_id, id]
  );

  return NextResponse.json({ data: true });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "Employee id is required." }, { status: 400 });
  }

  await queryDb("DELETE FROM employees WHERE id = $1", [id]);
  return NextResponse.json({ data: true });
}
