export type EmployeeRole = "ticketer" | "supervisor" | "cashier";
export type PosType = "terminal" | "counter" | "handheld";
export type VehicleKind = "minibus" | "midbus" | "bus";
export type RoadType = "gravel" | "asphalt";
export type FareLevel = "level 1" | "level 2" | "level 3";

export interface Station { id: number; name: string; location: string; }
export interface Fare { id: number; vehicle_kind: VehicleKind; road_type: RoadType; level: FareLevel; multiplier: number; }
export interface Employee { id: number; first_name: string; middle_name: string | null; last_name: string; email: string; phone: string; role: EmployeeRole; username: string; password: string; station_id: number; isActive: boolean; }
export interface PosMachine { id: number; serial_number: string; version: string; type: PosType; station_id: number; }
