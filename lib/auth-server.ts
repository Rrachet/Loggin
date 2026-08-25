import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Role = "founder" | "admin" | "manager" | "employee";
export type Profile = { id: string; company_id: string; office_id: string | null; full_name: string; role: Role; active: boolean };
export type ServerContext = { admin: SupabaseClient; userId: string; email: string | null; profile: Profile | null };
type Failure = { error: string; status: number };

export function isFailure(value: unknown): value is Failure { return typeof value === "object" && value !== null && "error" in value && "status" in value; }
function env() { const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const service=process.env.SUPABASE_SERVICE_ROLE_KEY; return url&&anon&&service?{url,anon,service}:null; }
export async function resolveCaller(request: Request): Promise<ServerContext|Failure> {
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim(); if(!token)return {error:"You are signed out. Sign in again.",status:401};
  const config=env(); if(!config)return {error:"The server is missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.",status:500};
  const auth=createClient(config.url,config.anon,{auth:{persistSession:false}}); const {data,error}=await auth.auth.getUser(token); if(error||!data.user)return {error:"Your session has expired. Sign in again.",status:401};
  const admin=createClient(config.url,config.service,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data:profile}=await admin.from("profiles").select("id,company_id,office_id,full_name,role,active").eq("id",data.user.id).maybeSingle();
  return {admin,userId:data.user.id,email:data.user.email??null,profile:(profile as Profile|null)??null};
}
export async function requireProfile(request:Request):Promise<ServerContext&{profile:Profile}|Failure>{const ctx=await resolveCaller(request);if(isFailure(ctx))return ctx;if(!ctx.profile)return{error:"Your account has no Loggin workspace yet. Reload the dashboard to finish setup.",status:409};if(!ctx.profile.active)return{error:"Your account is inactive. Ask an admin to reactivate it.",status:403};return{...ctx,profile:ctx.profile};}
export async function requireAdmin(request:Request){const ctx=await requireProfile(request);if(isFailure(ctx))return ctx;if(!["founder","admin"].includes(ctx.profile.role))return{error:"Only founders and admins can do this.",status:403};return ctx;}
export function workDate(timeZone:string,at=new Date()){return new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit"}).format(at);}
export function minutesOfDay(timeZone:string,at=new Date()){const parts=new Intl.DateTimeFormat("en-GB",{timeZone,hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(at);return Number(parts.find(p=>p.type==="hour")?.value??0)*60+Number(parts.find(p=>p.type==="minute")?.value??0);}
export async function companyTimezone(admin:SupabaseClient,companyId:string){const {data}=await admin.from("companies").select("timezone").eq("id",companyId).maybeSingle();return(data?.timezone as string|undefined)||"Asia/Kolkata";}
