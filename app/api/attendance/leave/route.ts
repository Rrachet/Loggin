import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function workDate(timeZone: string) { return new Intl.DateTimeFormat("en-CA", { timeZone, year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()); }

export async function POST(request: Request) {
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!token||!url||!anon||!service)return NextResponse.json({error:"Supabase is not configured"},{status:500});
  const auth=createClient(url,anon); const {data:{user}}=await auth.auth.getUser(token);
  if(!user)return NextResponse.json({error:"Unauthorized"},{status:401});
  const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:profile}=await admin.from("profiles").select("id,company_id,office_id,active,role").eq("id",user.id).single();
  if(!profile?.active||profile.role!=="employee")return NextResponse.json({error:"Only active employees can mark themselves on leave"},{status:403});
  const {data:company}=await admin.from("companies").select("timezone").eq("id",profile.company_id).single();
  const date=workDate(company?.timezone||"Asia/Kolkata");
  const {data,error}=await admin.from("attendance").upsert({employee_id:user.id,office_id:profile.office_id,work_date:date,status:"on_leave",check_in_method:"self_leave"},{onConflict:"employee_id,work_date"}).select().single();
  if(error)return NextResponse.json({error:error.message},{status:400});
  return NextResponse.json({ok:true,attendance:data});
}
