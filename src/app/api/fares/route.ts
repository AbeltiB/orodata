import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, hasPrismaCode } from "@/lib/apiErrors";

export const dynamic = "force-dynamic";
const id=(v:unknown)=>Number(v);
function valid(b: Record<string, unknown>){const m=Number(b.multiplier); return b.vehicle_kind&&b.level&&b.road_type&&Number.isFinite(m)&&m>0;}
export async function GET(){try{return NextResponse.json({data:await prisma.fare.findMany({orderBy:{id:"asc"}})})}catch(e){return apiError(e)}}
export async function POST(req:Request){try{const b=await req.json(); if(!valid(b))return NextResponse.json({error:"Vehicle, road, level, and a positive multiplier are required."},{status:400}); return NextResponse.json({data:await prisma.fare.create({data:{vehicle_kind:String(b.vehicle_kind),road_type:String(b.road_type),level:String(b.level),multiplier:Number(b.multiplier)}})})}catch(e){return apiError(e)}}
export async function PATCH(req:Request){try{const b=await req.json(); const fareId=id(b.id); if(!fareId||!valid(b))return NextResponse.json({error:"Fare id, vehicle, road, level, and a positive multiplier are required."},{status:400}); return NextResponse.json({data:await prisma.fare.update({where:{id:fareId},data:{vehicle_kind:String(b.vehicle_kind),road_type:String(b.road_type),level:String(b.level),multiplier:Number(b.multiplier)}})})}catch(e){if(hasPrismaCode(e, "P2025"))return NextResponse.json({error:"Fare not found."},{status:404}); return apiError(e)}}
export async function DELETE(req:Request){try{const fareId=id((await req.json()).id); if(!fareId)return NextResponse.json({error:"Fare id is required."},{status:400}); await prisma.fare.delete({where:{id:fareId}}); return NextResponse.json({data:true})}catch(e){if(hasPrismaCode(e, "P2025"))return NextResponse.json({error:"Fare not found."},{status:404}); return apiError(e)}}
