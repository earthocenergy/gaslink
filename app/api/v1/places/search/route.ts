import{NextRequest,NextResponse}from"next/server";import{MapboxRoutingProvider}from"@/lib/routing/mapbox";import{checkTripRateLimit}from"@/lib/security/trip-rate-limit";
export async function GET(request:NextRequest){const rate=checkTripRateLimit(request,"place_resolution");if(!rate.allowed&&"unavailable" in rate)return NextResponse.json({
        ok:false,
        reason:"RATE_LIMIT_UNAVAILABLE",
        message:"Trip services are temporarily unavailable."
    },{
        status:503,
        headers:{"Cache-Control":"no-store"}
    });if(!rate.allowed)return NextResponse.json({
        ok:false,
        reason:"RATE_LIMITED",
        message:"Too many place searches. Please wait before trying again.",
        retryAfter:rate.retryAfter
    },{
        status:429,
        headers:{
            "Cache-Control":"no-store",
            "Retry-After":String(rate.retryAfter)
        }
    });const q=request.nextUrl.searchParams.get("q")?.trim()||"";if(q.length<3)return NextResponse.json({ok:true,results:[]});try{const results=await new MapboxRoutingProvider().searchPlaces(q);return NextResponse.json({ok:true,results,temporary:true},{headers:{"Cache-Control":"no-store"}})}catch{return NextResponse.json({ok:false,reason:"ROUTING_PROVIDER_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}})}}