import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { qrToken } from "@/lib/qr";

function workDate(timeZone:string){return new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}

export async function GET(request:Request){
  const accessToken=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");const officeId=new URL(request.url).searchParams.get("officeId");if(!accessToken||!officeId)return NextResponse.json({error:"Unauthorized"},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!anonKey||!serviceKey||!process.env.QR_SIGNING_SECRET)return NextResponse.json({error:"QR is not configured"},{status:500});
  const auth=createClient(url,anonKey);const {data:{user}}=await auth.auth.getUser(accessToken);if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});const {data:actor}=await admin.from("profiles").select("company_id,role,active").eq("id",user.id).single();if(!actor?.active||!["founder","admin"].includes(actor.role))return NextResponse.json({error:"Only founders and admins can display office QR codes"},{status:403});
  const [{data:office},{data:company}]=await Promise.all([admin.from("offices").select("id,name,company_id,latitude,longitude,geofence_radius_m,geofence_enabled,qr_enabled").eq("id",officeId).single(),admin.from("companies").select("timezone").eq("id",actor.company_id).single()]);
  if(!office||office.company_id!==actor.company_id)return NextResponse.json({error:"Invalid office"},{status:404});if(!office.qr_enabled)return NextResponse.json({error:"QR check-in is disabled for this office"},{status:400});
  const date=workDate(company?.timezone||"Asia/Kolkata");const token=qrToken(office.id,date);return NextResponse.json({office,date,token,payload:JSON.stringify({officeId:office.id,date,token})});
}
