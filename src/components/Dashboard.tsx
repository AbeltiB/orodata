"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Employee, EmployeeRole, Fare, FareLevel, PosMachine, PosType, RoadType, Station, VehicleKind } from "@/types";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

type Section = "overview" | "stations" | "employees" | "pos" | "fare";
type Entity = Exclude<Section, "overview">;
type Format = "csv" | "xlsx" | "pdf";
type Row = Record<string, string | number | boolean | null>;
type AutoTableDoc = jsPDF & { autoTable: (options: { head: string[][]; body: string[][]; startY: number; styles: { fontSize: number }; headStyles: { fillColor: number[]; textColor: number[] }; theme: string }) => void };

type EmployeeForm = Omit<Employee, "id" | "middle_name"> & { middle_name: string };
type PosForm = Omit<PosMachine, "id">;
type FareForm = Omit<Fare, "id">;

type ExportOptions = { open: boolean; entity: Entity; format: Format; scope: "all" | "current" | "selected"; columns: string[]; startId: string; endId: string };

const roles: EmployeeRole[] = ["ticketer", "supervisor", "cashier"];
const posTypes: PosType[] = ["terminal", "counter", "handheld"];
const vehicleKinds: VehicleKind[] = ["minibus", "midbus", "bus"];
const roadTypes: RoadType[] = ["asphalt", "gravel"];
const fareLevels: FareLevel[] = ["level 1", "level 2", "level 3"];
const stationDefault = { name: "", location: "" };
const employeeDefault: EmployeeForm = { first_name: "", middle_name: "", last_name: "", email: "", phone: "", role: "ticketer", username: "", password: "", station_id: 0, isActive: true };
const posDefault: PosForm = { serial_number: "", version: "1.0", type: "terminal", station_id: 0 };
const fareDefault: FareForm = { vehicle_kind: "minibus", road_type: "asphalt", level: "level 1", multiplier: 1 };

const menu: Array<{ id: Section; label: string; icon: ReactNode }> = [
  { id: "overview", label: "Overview", icon: "⌁" }, { id: "stations", label: "Bus Stations", icon: "⌂" },
  { id: "employees", label: "Employees", icon: "◎" }, { id: "pos", label: "POS Machines", icon: "▣" }, { id: "fare", label: "Fare Multiplier", icon: "↔" },
];
const cx = (...c: Array<string | false | undefined>) => c.filter(Boolean).join(" ");
const today = () => new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const [section, setSection] = useState<Section>("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && localStorage.getItem("orodata-sidebar") === "collapsed");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [stations, setStations] = useState<Station[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pos, setPos] = useState<PosMachine[]>([]);
  const [fares, setFares] = useState<Fare[]>([]);
  const [stationForm, setStationForm] = useState(stationDefault);
  const [employeeForm, setEmployeeForm] = useState(employeeDefault);
  const [posForm, setPosForm] = useState(posDefault);
  const [fareForm, setFareForm] = useState(fareDefault);
  const [editing, setEditing] = useState<{ entity: Entity; id: number } | null>(null);
  const [selected, setSelected] = useState<Record<Entity, number[]>>({ stations: [], employees: [], pos: [], fare: [] });
  const [exportOptions, setExportOptions] = useState<ExportOptions>({ open: false, entity: "stations", format: "csv", scope: "all", columns: [], startId: "", endId: "" });

  const loadAll = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [s, e, p, f] = await Promise.all(["stations", "employees", "pos", "fares"].map((r) => fetch(`/api/${r}`, { cache: "no-store" }).then(async (res) => { const body = await res.json(); if (!res.ok) throw new Error(body.error ?? `Failed to load ${r}`); return body.data; })));
      setStations(s); setEmployees(e); setPos(p); setFares(f);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load data."); } finally { setLoading(false); }
  }, []);

  useEffect(() => { const handle = window.setTimeout(() => void loadAll(), 0); return () => window.clearTimeout(handle); }, [loadAll]);
  useEffect(() => { localStorage.setItem("orodata-sidebar", collapsed ? "collapsed" : "expanded"); }, [collapsed]);
  useEffect(() => { document.body.style.overflow = mobileOpen ? "hidden" : ""; const esc = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false); window.addEventListener("keydown", esc); return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", esc); }; }, [mobileOpen]);

  const stationName = useCallback((id: number) => stations.find((s) => s.id === id)?.name ?? "Unknown", [stations]);
  const rows = useMemo<Record<Entity, Row[]>>(() => ({
    stations: stations.map((s) => ({ ID: s.id, Name: s.name, Location: s.location, Employees: employees.filter((e) => e.station_id === s.id).length, POS: pos.filter((p) => p.station_id === s.id).length })),
    employees: employees.map((e) => ({ ID: e.id, Name: `${e.first_name} ${e.middle_name ? `${e.middle_name} ` : ""}${e.last_name}`, Role: e.role, Email: e.email, Phone: e.phone, Username: e.username, Station: stationName(e.station_id), Active: e.isActive })),
    pos: pos.map((p) => ({ ID: p.id, Serial: p.serial_number, Version: p.version, Type: p.type, Station: stationName(p.station_id) })),
    fare: fares.map((f) => ({ ID: f.id, Vehicle: f.vehicle_kind, Road: f.road_type, Level: f.level, Multiplier: f.multiplier })),
  }), [stations, employees, pos, fares, stationName]);
  const activeEmployees = employees.filter((e) => e.isActive).length;
  const warnings = [stations.length === 0 && "No stations configured", employees.some((e) => !e.isActive) && `${employees.length - activeEmployees} inactive employee account(s)`, pos.length === 0 && "No POS terminals registered"].filter(Boolean);

  async function request(entity: Entity, method: "POST" | "PATCH" | "DELETE", body: object, success: string) {
    setLoading(true); setError(""); setMessage("");
    try { const res = await fetch(`/api/${entity === "fare" ? "fares" : entity}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await res.json(); if (!res.ok) throw new Error(data.error ?? "Request failed"); setMessage(success); setEditing(null); await loadAll(); }
    catch (err) { setError(err instanceof Error ? err.message : "Request failed."); } finally { setLoading(false); }
  }

  function toggleSelected(entity: Entity, id: number) { setSelected((prev) => ({ ...prev, [entity]: prev[entity].includes(id) ? prev[entity].filter((x) => x !== id) : [...prev[entity], id] })); }
  function editStation(s: Station) { setSection("stations"); setEditing({ entity: "stations", id: s.id }); setStationForm({ name: s.name, location: s.location }); }
  function editEmployee(e: Employee) { setSection("employees"); setEditing({ entity: "employees", id: e.id }); setEmployeeForm({ ...e, middle_name: e.middle_name ?? "", password: "" }); }
  function editPos(p: PosMachine) { setSection("pos"); setEditing({ entity: "pos", id: p.id }); setPosForm({ serial_number: p.serial_number, version: p.version, type: p.type, station_id: p.station_id }); }
  function editFare(f: Fare) { setSection("fare"); setEditing({ entity: "fare", id: f.id }); setFareForm({ vehicle_kind: f.vehicle_kind, road_type: f.road_type, level: f.level, multiplier: f.multiplier }); }

  function openExport(entity: Entity) { const cols = Object.keys(rows[entity][0] ?? { ID: 0 }); setExportOptions({ open: true, entity, format: "csv", scope: "all", columns: cols, startId: "", endId: "" }); }
  function exportRows() {
    const opts = exportOptions; let data = rows[opts.entity];
    if (opts.scope === "selected") data = data.filter((r) => selected[opts.entity].includes(Number(r.ID)));
    if (opts.scope === "current") data = data.slice(0, 10);
    if (opts.startId) data = data.filter((r) => Number(r.ID) >= Number(opts.startId));
    if (opts.endId) data = data.filter((r) => Number(r.ID) <= Number(opts.endId));
    data = data.map((r) => Object.fromEntries(opts.columns.map((c) => [c, r[c] ?? ""])));
    if (!data.length) { setError("No rows match the selected export scope."); return; }
    const file = `${opts.entity}-${today()}`;
    if (opts.format === "csv") { const csv = [opts.columns.join(","), ...data.map((r) => opts.columns.map((c) => `"${String(r[c] ?? "").replaceAll('"', '""')}"`).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = `${file}.csv`; a.click(); URL.revokeObjectURL(url); }
    if (opts.format === "xlsx") { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Data"); XLSX.writeFile(wb, `${file}.xlsx`); }
    if (opts.format === "pdf") { const doc = new jsPDF({ orientation: "landscape" }) as AutoTableDoc; doc.autoTable({ head: [opts.columns], body: data.map((r) => opts.columns.map((c) => String(r[c] ?? ""))), startY: 20, styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }, theme: "grid" }); doc.save(`${file}.pdf`); }
    setExportOptions((o) => ({ ...o, open: false })); setMessage("Export downloaded.");
  }

  return <div className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-950"><div className="flex min-h-screen w-full">
    {mobileOpen && <button aria-label="Close navigation backdrop" className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
    <aside className={cx("fixed inset-y-0 left-0 z-50 flex h-dvh flex-col border-r border-slate-800 bg-slate-950 text-white shadow-2xl transition-all duration-300 lg:sticky lg:top-0 lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full", collapsed ? "w-20" : "w-72")}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-4"><div className="flex min-w-0 items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-500 font-bold">O</div>{!collapsed && <div><p className="font-semibold">OroData</p><p className="text-xs text-slate-400">Operations control</p></div>}</div><button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden h-10 w-10 rounded-2xl border border-slate-700 lg:block" onClick={() => setCollapsed((v) => !v)}>{collapsed ? "›" : "‹"}</button></div>
      <nav className="flex-1 space-y-1 p-3">{menu.map((m) => <button key={m.id} onClick={() => { setSection(m.id); setMobileOpen(false); }} className={cx("flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm transition", section === m.id ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-slate-800", collapsed && "justify-center")}><span className="grid h-8 w-8 place-items-center rounded-xl bg-white/10">{m.icon}</span>{!collapsed && <span>{m.label}</span>}</button>)}</nav>
      {!collapsed && <div className="border-t border-slate-800 p-4 text-sm text-slate-400"><p>{stations.length} stations · {activeEmployees}/{employees.length} active staff · {pos.length} terminals</p></div>}
    </aside>
    <main className="min-w-0 flex-1"><header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8"><div className="flex min-w-0 items-center gap-3"><button aria-label="Open navigation" className="grid h-11 w-11 place-items-center rounded-2xl border lg:hidden" onClick={() => setMobileOpen(true)}>☰</button><div><p className="text-xs uppercase tracking-[0.28em] text-slate-500">OroData</p><h1 className="text-xl font-bold sm:text-2xl">{menu.find((m) => m.id === section)?.label}</h1></div></div><button className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => void loadAll()}>{loading ? "Syncing…" : "Refresh"}</button></header>
      <div className="w-full p-4 sm:p-6 lg:p-8">{error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}{message && <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">{message}</div>}{section === "overview" ? overview() : crud(section)}</div>
    </main>{exportOptions.open && exportDialog()}
  </div></div>;

  function overview() { const stats = [{ t: "Stations", v: stations.length, c: "Network locations" }, { t: "Active staff", v: activeEmployees, c: `${employees.length - activeEmployees} inactive` }, { t: "POS terminals", v: pos.length, c: "Registered devices" }, { t: "Fare rules", v: fares.length, c: "Multiplier records" }]; return <div className="space-y-6"><section className="rounded-3xl bg-gradient-to-r from-slate-950 to-sky-900 p-6 text-white"><p className="text-sm uppercase tracking-[0.3em] text-sky-200">Operations hub</p><h2 className="mt-3 text-3xl font-bold">Station, staff, POS, and fares at a glance</h2><p className="mt-3 max-w-3xl text-slate-200">Use the redesigned dashboard to spot inactive accounts, coverage gaps, terminal inventory, and export-ready records.</p></section><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((s) => <div key={s.t} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><p className="text-sm text-slate-500">{s.t}</p><p className="mt-3 text-4xl font-bold">{s.v}</p><p className="mt-2 text-sm text-slate-500">{s.c}</p></div>)}</section><section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200"><h3 className="font-bold">Station coverage</h3><div className="mt-4 space-y-3">{stations.length ? stations.map((s) => <div key={s.id} className="rounded-2xl bg-slate-50 p-4"><div className="flex justify-between gap-3"><b>{s.name}</b><span>{employees.filter((e) => e.station_id === s.id).length} staff · {pos.filter((p) => p.station_id === s.id).length} POS</span></div><div className="mt-3 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-sky-500" style={{ width: `${Math.min(100, employees.filter((e) => e.station_id === s.id).length * 20)}%` }} /></div></div>) : <p className="text-slate-500">No stations yet.</p>}</div></div><div className="rounded-3xl bg-white p-6 ring-1 ring-slate-200"><h3 className="font-bold">Alerts & shortcuts</h3><div className="mt-4 space-y-3">{warnings.length ? warnings.map((w) => <p key={String(w)} className="rounded-2xl bg-amber-50 p-3 text-amber-800">{w}</p>) : <p className="rounded-2xl bg-emerald-50 p-3 text-emerald-800">All core datasets are populated.</p>}{(["stations", "employees", "pos", "fare"] as Entity[]).map((e) => <button key={e} onClick={() => setSection(e)} className="block w-full rounded-2xl border p-3 text-left capitalize hover:bg-slate-50">Manage {e}</button>)}</div></div></section></div>; }

  function crud(entity: Entity) { return <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,420px)_1fr]"><form onSubmit={(e) => submit(entity, e)} className="h-fit rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200"><h2 className="text-lg font-bold">{editing?.entity === entity ? "Edit" : "Create"} {entity}</h2>{form(entity)}<div className="mt-5 flex gap-2"><button disabled={loading} className="rounded-2xl bg-sky-600 px-4 py-2 font-semibold text-white">Save</button><button type="button" className="rounded-2xl border px-4 py-2" onClick={() => { setEditing(null); setStationForm(stationDefault); setEmployeeForm(employeeDefault); setPosForm(posDefault); setFareForm(fareDefault); }}>Reset</button></div></form><div className="min-w-0 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-bold capitalize">{entity} records</h2><button className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white" onClick={() => openExport(entity)}>Export</button></div>{table(entity)}</div></div>; }
  function form(entity: Entity) { if (entity === "stations") return <div className="mt-4 space-y-3"><input required placeholder="Name" value={stationForm.name} onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })} className="w-full rounded-2xl border p-3" /><input required placeholder="Location" value={stationForm.location} onChange={(e) => setStationForm({ ...stationForm, location: e.target.value })} className="w-full rounded-2xl border p-3" /></div>; if (entity === "employees") return <div className="mt-4 grid gap-3 sm:grid-cols-2"><input required placeholder="First name" value={employeeForm.first_name} onChange={(e) => setEmployeeForm({ ...employeeForm, first_name: e.target.value })} className="rounded-2xl border p-3" /><input placeholder="Middle name" value={employeeForm.middle_name} onChange={(e) => setEmployeeForm({ ...employeeForm, middle_name: e.target.value })} className="rounded-2xl border p-3" /><input required placeholder="Last name" value={employeeForm.last_name} onChange={(e) => setEmployeeForm({ ...employeeForm, last_name: e.target.value })} className="rounded-2xl border p-3" /><input required type="email" placeholder="Email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} className="rounded-2xl border p-3" /><input placeholder="Phone" value={employeeForm.phone} onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })} className="rounded-2xl border p-3" /><select value={employeeForm.role} onChange={(e) => setEmployeeForm({ ...employeeForm, role: e.target.value as EmployeeRole })} className="rounded-2xl border p-3">{roles.map((r) => <option key={r}>{r}</option>)}</select><input required placeholder="Username" value={employeeForm.username} onChange={(e) => setEmployeeForm({ ...employeeForm, username: e.target.value })} className="rounded-2xl border p-3" /><input required={!editing} type="password" placeholder={editing ? "New password (optional)" : "Password"} value={employeeForm.password} onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })} className="rounded-2xl border p-3" /><select required value={employeeForm.station_id} onChange={(e) => setEmployeeForm({ ...employeeForm, station_id: Number(e.target.value) })} className="rounded-2xl border p-3"><option value={0}>Select station</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select><label className="flex items-center gap-3 rounded-2xl border p-3"><input type="checkbox" checked={employeeForm.isActive} onChange={(e) => setEmployeeForm({ ...employeeForm, isActive: e.target.checked })} /> Active account</label></div>; if (entity === "pos") return <div className="mt-4 space-y-3"><input required placeholder="Serial number" value={posForm.serial_number} onChange={(e) => setPosForm({ ...posForm, serial_number: e.target.value })} className="w-full rounded-2xl border p-3" /><input required placeholder="Version" value={posForm.version} onChange={(e) => setPosForm({ ...posForm, version: e.target.value })} className="w-full rounded-2xl border p-3" /><select value={posForm.type} onChange={(e) => setPosForm({ ...posForm, type: e.target.value as PosType })} className="w-full rounded-2xl border p-3">{posTypes.map((t) => <option key={t}>{t}</option>)}</select><select required value={posForm.station_id} onChange={(e) => setPosForm({ ...posForm, station_id: Number(e.target.value) })} className="w-full rounded-2xl border p-3"><option value={0}>Select station</option>{stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>; return <div className="mt-4 space-y-3"><select value={fareForm.vehicle_kind} onChange={(e) => setFareForm({ ...fareForm, vehicle_kind: e.target.value as VehicleKind })} className="w-full rounded-2xl border p-3">{vehicleKinds.map((v) => <option key={v}>{v}</option>)}</select><select value={fareForm.road_type} onChange={(e) => setFareForm({ ...fareForm, road_type: e.target.value as RoadType })} className="w-full rounded-2xl border p-3">{roadTypes.map((r) => <option key={r}>{r}</option>)}</select><select value={fareForm.level} onChange={(e) => setFareForm({ ...fareForm, level: e.target.value as FareLevel })} className="w-full rounded-2xl border p-3">{fareLevels.map((l) => <option key={l}>{l}</option>)}</select><input required type="number" min="0.01" step="0.01" value={fareForm.multiplier} onChange={(e) => setFareForm({ ...fareForm, multiplier: Number(e.target.value) })} className="w-full rounded-2xl border p-3" /></div>; }
  function submit(entity: Entity, e: FormEvent<HTMLFormElement>) { e.preventDefault(); const body = entity === "stations" ? stationForm : entity === "employees" ? employeeForm : entity === "pos" ? posForm : fareForm; void request(entity, editing?.entity === entity ? "PATCH" : "POST", editing?.entity === entity ? { id: editing.id, ...body } : body, `${entity} saved.`); }
  function table(entity: Entity) { const data = rows[entity]; if (!data.length) return <div className="rounded-2xl bg-slate-50 p-8 text-center text-slate-500">No records yet.</div>; const cols = Object.keys(data[0]); return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="text-left text-slate-500"><th className="p-3">Select</th>{cols.map((c) => <th key={c} className="p-3">{c}</th>)}<th className="p-3">Actions</th></tr></thead><tbody>{data.map((r) => <tr key={String(r.ID)} className="border-t"><td className="p-3"><input type="checkbox" checked={selected[entity].includes(Number(r.ID))} onChange={() => toggleSelected(entity, Number(r.ID))} /></td>{cols.map((c) => <td key={c} className="p-3">{c === "Active" ? <span className={cx("rounded-full px-2 py-1 text-xs font-semibold", r[c] ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>{r[c] ? "Active" : "Inactive"}</span> : String(r[c])}</td>)}<td className="space-x-2 p-3"><button className="rounded-xl border px-3 py-1" onClick={() => entity === "stations" ? editStation(stations.find((x) => x.id === r.ID)!) : entity === "employees" ? editEmployee(employees.find((x) => x.id === r.ID)!) : entity === "pos" ? editPos(pos.find((x) => x.id === r.ID)!) : editFare(fares.find((x) => x.id === r.ID)!)}>Edit</button><button className="rounded-xl bg-red-50 px-3 py-1 text-red-700" onClick={() => confirm(`Delete ${entity} #${r.ID}?`) && void request(entity, "DELETE", { id: r.ID }, `${entity} deleted.`)}>Delete</button></td></tr>)}</tbody></table></div>; }
  function exportDialog() { const cols = Object.keys(rows[exportOptions.entity][0] ?? { ID: 0 }); return <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/60 p-4"><div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl"><h2 className="text-xl font-bold">Export {exportOptions.entity}</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><select value={exportOptions.format} onChange={(e) => setExportOptions({ ...exportOptions, format: e.target.value as Format })} className="rounded-2xl border p-3"><option value="csv">CSV</option><option value="xlsx">Excel (.xlsx)</option><option value="pdf">PDF</option></select><select value={exportOptions.scope} onChange={(e) => setExportOptions({ ...exportOptions, scope: e.target.value as ExportOptions["scope"] })} className="rounded-2xl border p-3"><option value="all">Entire dataset</option><option value="current">Current page only</option><option value="selected">Selected rows only</option></select><input placeholder="Start ID/date range proxy" value={exportOptions.startId} onChange={(e) => setExportOptions({ ...exportOptions, startId: e.target.value })} className="rounded-2xl border p-3" /><input placeholder="End ID/date range proxy" value={exportOptions.endId} onChange={(e) => setExportOptions({ ...exportOptions, endId: e.target.value })} className="rounded-2xl border p-3" /></div><div className="mt-4 grid gap-2 sm:grid-cols-3">{cols.map((c) => <label key={c} className="flex gap-2 rounded-2xl border p-3"><input type="checkbox" checked={exportOptions.columns.includes(c)} onChange={(e) => setExportOptions({ ...exportOptions, columns: e.target.checked ? [...exportOptions.columns, c] : exportOptions.columns.filter((x) => x !== c) })} />{c}</label>)}</div><div className="mt-6 flex justify-end gap-3"><button className="rounded-2xl border px-4 py-2" onClick={() => setExportOptions({ ...exportOptions, open: false })}>Cancel</button><button className="rounded-2xl bg-slate-950 px-4 py-2 font-semibold text-white" onClick={exportRows}>Download</button></div></div></div>; }
}
