import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError, hasPrismaCode } from "@/lib/apiErrors";

export const dynamic = "force-dynamic";
const id=(v:unknown)=>Number(v);
export async function GET(){try{return NextResponse.json({data:await prisma.station.findMany({orderBy:{id:"asc"}})})}catch(e){return apiError(e)}}
export async function POST(req:Request){try{const {name,location}=await req.json(); if(!name?.trim()||!location?.trim())return NextResponse.json({error:"Name and location are required."},{status:400}); return NextResponse.json({data:await prisma.station.create({data:{name:name.trim(),location:location.trim()}})})}catch(e){return apiError(e)}}
export async function PATCH(req:Request){try{const b=await req.json(); const stationId=id(b.id); if(!stationId||!b.name?.trim()||!b.location?.trim())return NextResponse.json({error:"Station id, name, and location are required."},{status:400}); return NextResponse.json({data:await prisma.station.update({where:{id:stationId},data:{name:b.name.trim(),location:b.location.trim()}})})}catch(e){if(hasPrismaCode(e, "P2025"))return NextResponse.json({error:"Station not found."},{status:404}); return apiError(e)}}
export async function DELETE(req:Request){try{const stationId=id((await req.json()).id); if(!stationId)return NextResponse.json({error:"Station id is required."},{status:400}); await prisma.station.delete({where:{id:stationId}}); return NextResponse.json({data:true})}catch(e){if(hasPrismaCode(e, "P2003"))return NextResponse.json({error:"Delete related employees and POS machines first."},{status:409}); if(hasPrismaCode(e, "P2025"))return NextResponse.json({error:"Station not found."},{status:404}); return apiError(e)}}
