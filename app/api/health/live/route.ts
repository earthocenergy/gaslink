import {NextResponse} from "next/server";import {getReleaseMetadata} from "@/lib/observability/release";
export const dynamic="force-dynamic";
export async function GET(){return NextResponse.json({ok:true,service:"cngx-web",...getReleaseMetadata(),timestamp:new Date().toISOString()},{headers:{"Cache-Control":"no-store"}})}
