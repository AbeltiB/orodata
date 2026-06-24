import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, hasPrismaCode } from "@/lib/apiErrors";

export const dynamic = "force-dynamic";

function asId(value: unknown) { return Number(value); }

export const dynamic = "force-dynamic";

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ error: message }, { status: 500 });
}

function asId(value: unknown) { return Number(value); }

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({ orderBy: { id: "asc" } });
    return NextResponse.json({ data: employees });
  } catch (error) { return apiError(error); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { first_name, middle_name, last_name, email, phone, role, username, password, station_id } = body;
    const isActive = body.isActive ?? true;
    const stationId = asId(station_id);
    if (!first_name || !last_name || !email || !role || !username || !password || !stationId) {
      return NextResponse.json({ error: "First name, last name, email, role, username, password, and station are required." }, { status: 400 });
    }
    const employee = await prisma.employee.create({ data: { first_name, middle_name: middle_name || null, last_name, email, phone: phone || "", role, username, password, isActive: Boolean(isActive), station_id: stationId } });
    return NextResponse.json({ data: employee });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2003") return NextResponse.json({ error: "Selected station does not exist." }, { status: 400 });
    return apiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, first_name, middle_name, last_name, email, phone, role, username, password, station_id } = body;
    const employeeId = asId(id); const stationId = asId(station_id);
    if (!employeeId || !first_name || !last_name || !email || !role || !username || !stationId) {
      return NextResponse.json({ error: "Employee id, first name, last name, email, role, username, and station are required." }, { status: 400 });
    }
    const data: Record<string, unknown> = { first_name, middle_name: middle_name || null, last_name, email, phone: phone || "", role, username, isActive: Boolean(body.isActive), station: { connect: { id: stationId } } };
    if (password) data.password = password;
    const employee = await prisma.employee.update({ where: { id: employeeId }, data });
    return NextResponse.json({ data: employee });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2003") return NextResponse.json({ error: "Selected station does not exist." }, { status: 400 });
    return apiError(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json(); const employeeId = asId(id);
    if (!employeeId) return NextResponse.json({ error: "Employee id is required." }, { status: 400 });
    await prisma.employee.delete({ where: { id: employeeId } });
    return NextResponse.json({ data: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    return apiError(error);
  }
}
