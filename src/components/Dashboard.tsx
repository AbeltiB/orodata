"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Employee, EmployeeRole, Fare, FareLevel, PosMachine, PosType, Station, VehicleKind, RoadType } from "@/types";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

type Section = "overview" | "stations" | "employees" | "pos" | "fare";

type RoleCounts = { ticketer: number; supervisor: number; cashier: number };

type FareTableRow = { ID: number; Vehicle: string; Road: string; Level: string; Multiplier: number };
type FareForm = { vehicle_kind: VehicleKind; road_type: RoadType; level: FareLevel; multiplier: number };
type EmployeeForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: EmployeeRole;
  username: string;
  password: string;
  station_id: number;
};
type PosForm = {
  serial_number: string;
  version: string;
  type: PosType;
  station_id: number;
};
type MenuItem = { id: Section; label: string; icon: ReactNode };

const defaultStation = { name: "", location: "" };
const defaultEmployee: EmployeeForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  phone: "",
  role: "ticketer" as const,
  username: "",
  password: "",
  station_id: 0,
};
const defaultPos: PosForm = {
  serial_number: "",
  version: "1.0",
  type: "terminal",
  station_id: 0,
};

const defaultFare: FareForm = {
  vehicle_kind: "minibus",
  road_type: "asphalt",
  level: "level 1",
  multiplier: 1.0,
};

const fareVehicleKinds: VehicleKind[] = ["minibus", "midbus", "bus"];
const fareRoadTypes: RoadType[] = ["asphalt", "gravel"];
const fareLevels: FareLevel[] = ["level 1", "level 2", "level 3"];

const menuItems: MenuItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13h8V3H3v10Z" />
        <path d="M13 21h8V11h-8v10Z" />
        <path d="M3 21h8v-6H3v6Z" />
      </svg>
    ),
  },
  {
    id: "stations",
    label: "Bus Stations",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18" />
        <path d="M6 3h12v10H6z" />
        <path d="M6 13v8" />
        <path d="M18 13v8" />
      </svg>
    ),
  },
  {
    id: "employees",
    label: "Employees",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "pos",
    label: "POS Machines",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="2" />
        <path d="M7 20h10" />
        <path d="M8 8h8" />
        <path d="M9 12h.01" />
      </svg>
    ),
  },
  {
    id: "fare",
    label: "Fare Multiplier",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" />
        <path d="M14 5h5v14h-5" />
        <path d="M5 7h4v4H5z" />
        <path d="M5 13h4v4H5z" />
      </svg>
    ),
  },
];

function classNames(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatDate() {
  return new Date().toISOString().slice(0, 10);
}

export default function Dashboard() {
  const [section, setSection] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [posMachines, setPosMachines] = useState<PosMachine[]>([]);
  const [loading, setLoading] = useState(false);
  const [stationForm, setStationForm] = useState(defaultStation);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(defaultEmployee);
  const [posForm, setPosForm] = useState<PosForm>(defaultPos);
  const [fareForm, setFareForm] = useState<FareForm>(defaultFare);
  const [editingStation, setEditingStation] = useState<Station | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingPos, setEditingPos] = useState<PosMachine | null>(null);
  const [editingFare, setEditingFare] = useState<Fare | null>(null);
  const [fares, setFares] = useState<Fare[]>([]);

  const selectedStation = useMemo(
    () => stations.find((station) => station.id === Number(employeeForm.station_id)) || null,
    [employeeForm.station_id, stations]
  );

  const roleCounts = useMemo<RoleCounts>(() => {
    return employees.reduce(
      (acc, employee) => {
        acc[employee.role] += 1;
        return acc;
      },
      { ticketer: 0, supervisor: 0, cashier: 0 }
    );
  }, [employees]);

  const busiestStation = useMemo(() => {
    if (!stations.length) return null;
    return stations
      .map((station) => ({ station, count: employees.filter((employee) => employee.station_id === station.id).length }))
      .reduce((best, current) => (!best || current.count > best.count ? current : best), null as { station: Station; count: number } | null);
  }, [stations, employees]);

  const stationRows = stations.map((station) => ({
    ID: station.id,
    Name: station.name,
    Location: station.location,
  }));

  const employeeRows = employees.map((employee) => {
    const station = stations.find((item) => item.id === employee.station_id);
    return {
      ID: employee.id,
      Name: `${employee.first_name} ${employee.middle_name ? employee.middle_name + " " : ""}${employee.last_name}`,
      Role: employee.role,
      Email: employee.email,
      Phone: employee.phone,
      Station: station?.name ?? "Unknown",
    };
  });

  const posRows = posMachines.map((pos) => {
    const station = stations.find((item) => item.id === pos.station_id);
    return {
      ID: pos.id,
      Serial: pos.serial_number,
      Version: pos.version,
      Type: pos.type,
      Station: station?.name ?? "Unknown",
    };
  });

  const fareRows: FareTableRow[] = fares.map((fare) => ({
    ID: fare.id,
    Vehicle: fare.vehicle_kind,
    Road: fare.road_type,
    Level: fare.level,
    Multiplier: fare.multiplier,
  }));

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [stationsRes, employeesRes, posRes] = await Promise.all([
        fetch("/api/stations", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/employees", { cache: "no-store" }).then((res) => res.json()),
        fetch("/api/pos", { cache: "no-store" }).then((res) => res.json()),
      ]);
      setStations(stationsRes.data ?? []);
      setEmployees(employeesRes.data ?? []);
      setPosMachines(posRes.data ?? []);
      setFares(await fetchFareData());
    } finally {
      setLoading(false);
    }
  }

  async function fetchFareData() {
    try {
      const res = await fetch("/api/fares", { cache: "no-store" });
      const payload = await res.json();
      return payload.data ?? [];
    } catch {
      return [];
    }
  }

  async function exportData(entity: "stations" | "employees" | "pos" | "fare", format: "xlsx" | "pdf") {
    const rows =
      entity === "stations"
        ? stationRows
        : entity === "employees"
        ? employeeRows
        : entity === "pos"
        ? posRows
        : fareRows;
    if (!rows.length) return;

    const fileName = `${entity}-${formatDate()}`;

    if (format === "xlsx") {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
      XLSX.writeFile(workbook, `${fileName}.xlsx`);
      return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    const columns = Object.keys(rows[0]);
    const body = rows.map((row) => columns.map((key) => String((row as any)[key] ?? "")));

    (doc as any).autoTable({
      head: [columns],
      body,
      startY: 30,
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      theme: "grid",
    });
    doc.save(`${fileName}.pdf`);
  }

  async function handleStationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = { name: stationForm.name.trim(), location: stationForm.location.trim() };
    if (!payload.name || !payload.location) return;
    setLoading(true);
    try {
      const endpoint = "/api/stations";
      const method = editingStation ? "PATCH" : "POST";
      const body = editingStation ? { id: editingStation.id, ...payload } : payload;
      await fetch(endpoint, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      setStationForm(defaultStation);
      setEditingStation(null);
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  async function handleEmployeeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      first_name: employeeForm.first_name.trim(),
      middle_name: employeeForm.middle_name.trim(),
      last_name: employeeForm.last_name.trim(),
      email: employeeForm.email.trim(),
      phone: employeeForm.phone.trim(),
      role: employeeForm.role,
      username: employeeForm.username.trim(),
      password: employeeForm.password.trim(),
      station_id: Number(employeeForm.station_id),
    };
    if (!payload.first_name || !payload.last_name || !payload.email || !payload.station_id) return;
    setLoading(true);
    try {
      const endpoint = "/api/employees";
      const method = editingEmployee ? "PATCH" : "POST";
      const body = editingEmployee ? { id: editingEmployee.id, ...payload } : payload;
      await fetch(endpoint, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      setEmployeeForm(defaultEmployee);
      setEditingEmployee(null);
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  async function handlePosSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      serial_number: posForm.serial_number.trim(),
      version: posForm.version.trim(),
      type: posForm.type,
      station_id: Number(posForm.station_id),
    };
    if (!payload.serial_number || !payload.version || !payload.station_id) return;
    setLoading(true);
    try {
      const endpoint = "/api/pos";
      const method = editingPos ? "PATCH" : "POST";
      const body = editingPos ? { id: editingPos.id, ...payload } : payload;
      await fetch(endpoint, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      setPosForm(defaultPos);
      setEditingPos(null);
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  async function handleFareSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      vehicle_kind: fareForm.vehicle_kind,
      level: fareForm.level,
      road_type: fareForm.road_type,
      multiplier: Number(fareForm.multiplier),
    };

    if (!payload.vehicle_kind || !payload.level || !payload.road_type || !payload.multiplier) return;
    setLoading(true);
    try {
      const endpoint = "/api/fares";
      const method = editingFare ? "PATCH" : "POST";
      const body = editingFare ? { id: editingFare.id, ...payload } : payload;
      await fetch(endpoint, { method, body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      setFareForm(defaultFare);
      setEditingFare(null);
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  async function handleFareEdit(fare: Fare) {
    setEditingFare(fare);
    setFareForm(fare);
    setSection("fare");
  }

  async function handleDelete(entity: "stations" | "employees" | "pos" | "fare", id: number) {
    setLoading(true);
    try {
      await fetch(`/api/${entity}`, {
        method: "DELETE",
        body: JSON.stringify({ id }),
        headers: { "Content-Type": "application/json" },
      });
      await loadAll();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative flex min-h-screen">
        <aside
          className={classNames(
            "fixed inset-y-0 left-0 z-40 flex h-full flex-col overflow-hidden border-r border-slate-800 bg-slate-950 shadow-2xl transition-all duration-300 lg:static",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
            sidebarCollapsed ? "w-20" : "w-72",
            "lg:translate-x-0"
          )}
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500 text-white">O</div>
              {!sidebarCollapsed ? (
                <div>
                  <p className="text-sm font-semibold text-white">OroData</p>
                  <p className="text-xs text-slate-400">Station control</p>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-200 transition hover:border-slate-700 hover:bg-slate-800"
            >
              {sidebarCollapsed ? "›" : "‹"}
            </button>
          </div>
          <nav className="flex-1 space-y-1 px-2 py-6">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setSection(item.id);
                  setSidebarOpen(false);
                }}
                className={classNames(
                  section === item.id
                    ? "bg-slate-800 text-white"
                    : "text-slate-400 hover:bg-slate-900 hover:text-white",
                  "flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-sm font-medium transition"
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-slate-300">{item.icon}</span>
                {!sidebarCollapsed ? item.label : null}
              </button>
            ))}
          </nav>
          <div className="border-t border-slate-800 px-5 py-5">
            {!sidebarCollapsed ? (
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Network overview</p>
                <div className="mt-4 space-y-3 text-sm text-slate-400">
                  <p>{stations.length} stations</p>
                  <p>{employees.length} staff</p>
                  <p>{posMachines.length} terminals</p>
                </div>
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400">Stats</div>
            )}
          </div>
        </aside>

        <main className={classNames("flex-1 transition-all duration-300", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
          <div className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-800 bg-slate-950 px-4 py-4 shadow-lg shadow-slate-950/10 lg:px-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-200 transition hover:border-slate-700 hover:bg-slate-800 lg:hidden"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Welcome back</p>
                <h1 className="text-2xl font-semibold text-white">OroData operations</h1>
              </div>
            </div>
            <div className="hidden items-center gap-3 lg:flex">
              <div className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-slate-300 ring-1 ring-slate-800">{loading ? "Refreshing…" : "Live data sync"}</div>
            </div>
          </div>

          <div className="mx-auto max-w-[1600px] p-4 sm:p-6 lg:p-8">
            <div className="space-y-6">
              <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-6 text-white shadow-2xl ring-1 ring-white/10 sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
                <div className="max-w-2xl">
                  <p className="text-xs uppercase tracking-[0.35em] text-sky-300">Operations hub</p>
                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">A modern station dashboard for your POS network</h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                    Manage stations, employees, and POS terminals from one sleek workspace. Export any dataset to Excel or PDF with a single click.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    onClick={() => exportData("stations", "xlsx")}
                    className="inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
                  >
                    Export stations
                  </button>
                  <button
                    onClick={() => exportData("employees", "pdf")}
                    className="inline-flex items-center justify-center gap-2 rounded-3xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                  >
                    Export employees
                  </button>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.1fr_320px]">
                <div className="space-y-6">
                  <div className="rounded-3xl bg-slate-950 p-6 shadow-2xl ring-1 ring-white/10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-sky-300">
                          {section === "overview"
                            ? "Operations hub"
                            : section === "stations"
                            ? "Station management"
                            : section === "employees"
                            ? "Employee roster"
                            : section === "pos"
                            ? "POS terminals"
                            : "Fare multipliers"}
                        </p>
                        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white">
                          {section === "overview"
                            ? "A modern station dashboard for your POS network"
                            : section === "stations"
                            ? "Manage bus stations"
                            : section === "employees"
                            ? "Manage your staff roster"
                            : section === "pos"
                            ? "Manage POS terminals"
                            : "Configure fare multipliers"}
                        </h2>
                        <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300">
                          {section === "overview"
                            ? "Manage stations, employees, and POS terminals from one sleek workspace. Export any dataset to Excel or PDF with a single click."
                            : section === "stations"
                            ? "Add or update station locations and keep the network map current."
                            : section === "employees"
                            ? "Track employee assignments, roles, and contact details across your stations."
                            : section === "pos"
                            ? "Register terminals, update versions, and assign machines to stations."
                            : "Create fare multiplier rules by vehicle class, road type, and level for flexible pricing."}
                        </p>
                      </div>
                      {section !== "overview" ? (
                        <div className="flex flex-wrap gap-3">
                          <button
                            onClick={() => exportData(section, "xlsx")}
                            className="inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-400"
                          >
                            Export {section}
                          </button>
                          <button
                            onClick={() => exportData(section, "pdf")}
                            className="inline-flex items-center justify-center gap-2 rounded-3xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                          >
                            Export {section}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {section === "overview" ? (
                    <>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {[
                          { title: "Stations", value: stations.length, caption: "Active stations", color: "from-sky-500 to-cyan-500" },
                          { title: "Employees", value: employees.length, caption: "Total staff", color: "from-emerald-500 to-teal-500" },
                          { title: "POS", value: posMachines.length, caption: "Connected terminals", color: "from-violet-500 to-fuchsia-500" },
                        ].map((stat) => (
                          <div key={stat.title} className="overflow-hidden rounded-3xl bg-slate-950 p-6 shadow-2xl ring-1 ring-white/10">
                            <p className="text-sm uppercase tracking-[0.28em] text-slate-400">{stat.caption}</p>
                            <p className="mt-4 text-3xl font-semibold text-white">{stat.value}</p>
                            <div className={`mt-6 h-1 rounded-full bg-gradient-to-r ${stat.color}`} />
                          </div>
                        ))}
                      </div>

                      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-slate-950">Station coverage</h3>
                            <p className="mt-1 text-sm text-slate-500">Live station health and staff coverage.</p>
                          </div>
                          <div className="rounded-2xl bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">{stations.length} stations, 9 more incoming</div>
                        </div>
                        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {stations.map((station) => {
                            const stationEmployees = employees.filter((employee) => employee.station_id === station.id).length;
                            const stationPos = posMachines.filter((pos) => pos.station_id === station.id).length;
                            return (
                              <div key={station.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
                                <h4 className="text-base font-semibold text-slate-950">{station.name}</h4>
                                <p className="mt-2 text-sm text-slate-600">{station.location}</p>
                                <div className="mt-5 flex flex-wrap gap-2 text-sm text-slate-700">
                                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{stationEmployees} staff</span>
                                  <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{stationPos} POS</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-2xl ring-1 ring-white/10">
                          <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Ticketers</p>
                          <p className="mt-4 text-3xl font-semibold">{roleCounts.ticketer}</p>
                          <p className="mt-2 text-sm text-slate-400">Active operators available</p>
                        </div>
                        <div className="rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-2xl ring-1 ring-white/10">
                          <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Supervisors</p>
                          <p className="mt-4 text-3xl font-semibold">{roleCounts.supervisor}</p>
                          <p className="mt-2 text-sm text-slate-400">Oversight and quality control</p>
                        </div>
                        <div className="rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-6 text-white shadow-2xl ring-1 ring-white/10">
                          <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Cashiers</p>
                          <p className="mt-4 text-3xl font-semibold">{roleCounts.cashier}</p>
                          <p className="mt-2 text-sm text-slate-400">Frontline transaction staff</p>
                        </div>
                      </div>
                    </>
                  ) : section === "stations" ? (
                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">Station records</h3>
                          <p className="mt-1 text-sm text-slate-500">Create, edit, and remove station records.</p>
                        </div>
                        <span className="rounded-2xl bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">{stations.length} stations</span>
                      </div>
                      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
                        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                              <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Name</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Location</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {stations.map((station) => (
                                  <tr key={station.id} className="bg-white">
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-900">{station.name}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{station.location}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-500">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingStation(station);
                                          setStationForm({ name: station.name, location: station.location });
                                        }}
                                        className="mr-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700 transition hover:bg-slate-200"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete("stations", station.id)}
                                        className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 transition hover:bg-rose-100"
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <form onSubmit={handleStationSubmit} className="space-y-4 rounded-3xl bg-slate-950 p-6 text-white shadow-sm ring-1 ring-slate-800">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">Name</label>
                            <input
                              value={stationForm.name}
                              onChange={(event) => setStationForm({ ...stationForm, name: event.target.value })}
                              className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">Location</label>
                            <input
                              value={stationForm.location}
                              onChange={(event) => setStationForm({ ...stationForm, location: event.target.value })}
                              className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            />
                          </div>
                          <div className="flex flex-wrap gap-3 pt-2">
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
                            >
                              {editingStation ? "Update station" : "Add station"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStation(null);
                                setStationForm(defaultStation);
                              }}
                              className="inline-flex items-center justify-center gap-2 rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                            >
                              Clear
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : section === "employees" ? (
                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">Employee roster</h3>
                          <p className="mt-1 text-sm text-slate-500">Track roles, contact details, and assignments.</p>
                        </div>
                        <span className="rounded-2xl bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">{employees.length} employees</span>
                      </div>
                      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
                        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                              <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Name</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Role</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Station</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {employees.map((employee) => {
                                  const station = stations.find((item) => item.id === employee.station_id);
                                  return (
                                    <tr key={employee.id} className="bg-white">
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-900">{`${employee.first_name} ${employee.middle_name ? `${employee.middle_name} ` : ""}${employee.last_name}`}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{employee.role}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{station?.name ?? "Unknown"}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-500">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingEmployee(employee);
                                            setEmployeeForm({
                                              first_name: employee.first_name,
                                              middle_name: employee.middle_name,
                                              last_name: employee.last_name,
                                              email: employee.email,
                                              phone: employee.phone,
                                              role: employee.role,
                                              username: employee.username,
                                              password: employee.password,
                                              station_id: employee.station_id,
                                            });
                                          }}
                                          className="mr-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700 transition hover:bg-slate-200"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDelete("employees", employee.id)}
                                          className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 transition hover:bg-rose-100"
                                        >
                                          Delete
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <form onSubmit={handleEmployeeSubmit} className="space-y-4 rounded-3xl bg-slate-950 p-6 text-white shadow-sm ring-1 ring-slate-800">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-200">First name</label>
                              <input
                                value={employeeForm.first_name}
                                onChange={(event) => setEmployeeForm({ ...employeeForm, first_name: event.target.value })}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-200">Middle name</label>
                              <input
                                value={employeeForm.middle_name}
                                onChange={(event) => setEmployeeForm({ ...employeeForm, middle_name: event.target.value })}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                              />
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-200">Last name</label>
                              <input
                                value={employeeForm.last_name}
                                onChange={(event) => setEmployeeForm({ ...employeeForm, last_name: event.target.value })}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-200">Email</label>
                              <input
                                value={employeeForm.email}
                                onChange={(event) => setEmployeeForm({ ...employeeForm, email: event.target.value })}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                              />
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-200">Phone</label>
                              <input
                                value={employeeForm.phone}
                                onChange={(event) => setEmployeeForm({ ...employeeForm, phone: event.target.value })}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-200">Role</label>
                              <select
                                value={employeeForm.role}
                                onChange={(event) => setEmployeeForm({ ...employeeForm, role: event.target.value as Employee["role"] })}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                              >
                                <option value="ticketer">Ticketer</option>
                                <option value="supervisor">Supervisor</option>
                                <option value="cashier">Cashier</option>
                              </select>
                            </div>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-200">Username</label>
                              <input
                                value={employeeForm.username}
                                onChange={(event) => setEmployeeForm({ ...employeeForm, username: event.target.value })}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-200">Password</label>
                              <input
                                type="password"
                                value={employeeForm.password}
                                onChange={(event) => setEmployeeForm({ ...employeeForm, password: event.target.value })}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">Station</label>
                            <select
                              value={employeeForm.station_id}
                              onChange={(event) => setEmployeeForm({ ...employeeForm, station_id: Number(event.target.value) })}
                              className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            >
                              <option value={0}>Choose station</option>
                              {stations.map((station) => (
                                <option key={station.id} value={station.id}>
                                  {station.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-wrap gap-3 pt-2">
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
                            >
                              {editingEmployee ? "Update employee" : "Add employee"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEmployee(null);
                                setEmployeeForm(defaultEmployee);
                              }}
                              className="inline-flex items-center justify-center gap-2 rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                            >
                              Clear
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : section === "pos" ? (
                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">POS terminal inventory</h3>
                          <p className="mt-1 text-sm text-slate-500">Manage devices, versions, and station assignments.</p>
                        </div>
                        <span className="rounded-2xl bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">{posMachines.length} machines</span>
                      </div>
                      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
                        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                              <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Serial</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Version</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Station</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {posMachines.map((pos) => {
                                  const station = stations.find((item) => item.id === pos.station_id);
                                  return (
                                    <tr key={pos.id} className="bg-white">
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-900">{pos.serial_number}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{pos.version}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{station?.name ?? "Unknown"}</td>
                                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-500">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingPos(pos);
                                            setPosForm({ serial_number: pos.serial_number, version: pos.version, type: pos.type, station_id: pos.station_id });
                                          }}
                                          className="mr-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700 transition hover:bg-slate-200"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDelete("pos", pos.id)}
                                          className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 transition hover:bg-rose-100"
                                        >
                                          Delete
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <form onSubmit={handlePosSubmit} className="space-y-4 rounded-3xl bg-slate-950 p-6 text-white shadow-sm ring-1 ring-slate-800">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">Serial number</label>
                            <input
                              value={posForm.serial_number}
                              onChange={(event) => setPosForm({ ...posForm, serial_number: event.target.value })}
                              className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            />
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-200">Version</label>
                              <input
                                value={posForm.version}
                                onChange={(event) => setPosForm({ ...posForm, version: event.target.value })}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-sm font-medium text-slate-200">Type</label>
                              <select
                                value={posForm.type}
                                onChange={(event) => setPosForm({ ...posForm, type: event.target.value as typeof posForm.type })}
                                className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                              >
                                <option value="terminal">Terminal</option>
                                <option value="counter">Counter</option>
                                <option value="handheld">Handheld</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">Station</label>
                            <select
                              value={posForm.station_id}
                              onChange={(event) => setPosForm({ ...posForm, station_id: Number(event.target.value) })}
                              className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            >
                              <option value={0}>Choose station</option>
                              {stations.map((station) => (
                                <option key={station.id} value={station.id}>
                                  {station.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-wrap gap-3 pt-2">
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
                            >
                              {editingPos ? "Update terminal" : "Add terminal"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPos(null);
                                setPosForm(defaultPos);
                              }}
                              className="inline-flex items-center justify-center gap-2 rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                            >
                              Clear
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : section === "fare" ? (
                    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">Fare multiplier rules</h3>
                          <p className="mt-1 text-sm text-slate-500">Manage vehicle class, road type, and level-based multipliers.</p>
                        </div>
                        <span className="rounded-2xl bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">{fares.length} rules</span>
                      </div>
                      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_340px]">
                        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                              <thead className="bg-slate-100 text-slate-700">
                                <tr>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Vehicle</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Road</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Level</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold">Multiplier</th>
                                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {fares.map((fare) => (
                                  <tr key={fare.id} className="bg-white">
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-900">{fare.vehicle_kind}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fare.road_type}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{fare.level}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-900">{fare.multiplier.toFixed(2)}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-slate-500">
                                      <button
                                        type="button"
                                        onClick={() => handleFareEdit(fare)}
                                        className="mr-2 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-1 text-slate-700 transition hover:bg-slate-200"
                                      >
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDelete("fare", fare.id)}
                                        className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-1 text-rose-700 transition hover:bg-rose-100"
                                      >
                                        Delete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <form onSubmit={handleFareSubmit} className="space-y-4 rounded-3xl bg-slate-950 p-6 text-white shadow-sm ring-1 ring-slate-800">
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">Vehicle kind</label>
                            <select
                              value={fareForm.vehicle_kind}
                              onChange={(event) => setFareForm({ ...fareForm, vehicle_kind: event.target.value as typeof fareForm.vehicle_kind })}
                              className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            >
                              {fareVehicleKinds.map((kind) => (
                                <option key={kind} value={kind}>
                                  {kind}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">Road type</label>
                            <select
                              value={fareForm.road_type}
                              onChange={(event) => setFareForm({ ...fareForm, road_type: event.target.value as typeof fareForm.road_type })}
                              className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            >
                              {fareRoadTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">Fare level</label>
                            <select
                              value={fareForm.level}
                              onChange={(event) => setFareForm({ ...fareForm, level: event.target.value as typeof fareForm.level })}
                              className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            >
                              {fareLevels.map((level) => (
                                <option key={level} value={level}>
                                  {level}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-2 block text-sm font-medium text-slate-200">Multiplier</label>
                            <input
                              type="number"
                              step="0.1"
                              value={fareForm.multiplier}
                              onChange={(event) => setFareForm({ ...fareForm, multiplier: Number(event.target.value) })}
                              className="w-full rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20"
                            />
                          </div>
                          <div className="flex flex-wrap gap-3 pt-2">
                            <button
                              type="submit"
                              className="inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
                            >
                              {editingFare ? "Update multiplier" : "Add multiplier"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFare(null);
                                setFareForm(defaultFare);
                              }}
                              className="inline-flex items-center justify-center gap-2 rounded-3xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                            >
                              Clear
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  ) : null}
                </div>

                <aside className="space-y-6">
                  <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                    <h3 className="text-lg font-semibold text-slate-950">Network highlights</h3>
                    <div className="mt-5 space-y-4 text-sm text-slate-600">
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">Most staffed station</p>
                        <p className="mt-2 font-semibold text-slate-950">{busiestStation?.station.name ?? "Not available"}</p>
                        <p className="mt-1 text-slate-500">{busiestStation ? `${busiestStation.count} staff` : "Add employees to fill this report."}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">Data health</p>
                        <p className="mt-2 font-semibold text-slate-950">{stations.length + employees.length + posMachines.length} records</p>
                        <p className="mt-1 text-slate-500">Includes live station, employee, and POS records.</p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 p-4">
                        <p className="text-sm text-slate-500">Export ready</p>
                        <p className="mt-2 font-semibold text-slate-950">Excel & PDF</p>
                        <p className="mt-1 text-slate-500">Use the buttons above to generate reports.</p>
                      </div>
                    </div>
                  </div>
                </aside>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
