const url=process.env.QA_SUPABASE_URL, key=process.env.QA_SUPABASE_PUBLISHABLE_KEY, token=process.env.QA_ORDINARY_USER_TOKEN;
if(process.env.QA_ALLOW_RPC_MUTATION!=="STAGING_ONLY")throw new Error("RPC adversarial execution requires QA_ALLOW_RPC_MUTATION=STAGING_ONLY");
if(!url||!key||!token)throw new Error("Staging Supabase URL/key/ordinary-user token required");
if(/knhrgugextsmisyxzdgc/.test(url))throw new Error("Production GasLink Supabase target is prohibited");
const uuid="00000000-0000-4000-8000-000000000001";
const cases=[
["activate_user_role",{p_role:"operator"}],
["admin_equipment_verification",{p_id:uuid,p_status:"verified"}],
["admin_marketplace_listing",{p_id:uuid,p_status:"approved"}],
["admin_marketplace_seller",{p_id:uuid,p_status:"verified"}],
["admin_moderate_station_report",{p_report_id:uuid,p_apply:true}],
["admin_publish_station",{p_station_id:uuid,p_notes:"qa adversarial"}],
["admin_review_station_publication",{p_station_id:uuid,p_decision:"eligible",p_notes:"qa adversarial"}],
["admin_review_station_registration",{p_station_id:uuid,p_approve:true}],
["admin_service_offering",{p_id:uuid,p_status:"approved"}],
["admin_service_provider",{p_id:uuid,p_status:"verified"}],
["admin_unpublish_station",{p_station_id:uuid,p_notes:"qa adversarial"}],
["admin_update_business_enquiry",{p_id:uuid,p_status:"closed"}],
["approve_station_claim",{p_claim_id:uuid,p_approve:true}]
];
let failed=0;for(const [name,args] of cases){const r=await fetch(url+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(args)});if(r.ok){console.error("FAIL",name,"ordinary user call unexpectedly succeeded");failed++}else console.log("PASS",name,"rejected",r.status)}if(failed)process.exit(1);console.log("13 SECURITY DEFINER ordinary-user rejection probes passed");
