# SECURITY DEFINER authenticated RPC inventory

Live read-only inventory captured 2026-09-28. Every RPC below is callable by `authenticated`; this is not itself a vulnerability. Staging adversarial execution must prove the internal authorization boundary.

| RPC | Ordinary-user adversarial expectation |
|---|---|
| activate_user_role(p_role text) | reject admin/operator escalation; legitimate driver/buyer self-activation remains supported |
| admin_equipment_verification(p_id uuid,p_status text) | reject before mutation |
| admin_marketplace_listing(p_id uuid,p_status text) | reject before mutation |
| admin_marketplace_seller(p_id uuid,p_status text) | reject before mutation |
| admin_moderate_station_report(p_report_id uuid,p_apply boolean) | reject before mutation |
| admin_publish_station(p_station_id uuid,p_notes text) | reject before mutation |
| admin_review_station_publication(p_station_id uuid,p_decision text,p_notes text) | reject before mutation |
| admin_review_station_registration(p_station_id uuid,p_approve boolean) | reject before mutation/operator grant |
| admin_service_offering(p_id uuid,p_status text) | reject before mutation |
| admin_service_provider(p_id uuid,p_status text) | reject before mutation |
| admin_unpublish_station(p_station_id uuid,p_notes text) | reject before mutation |
| admin_update_business_enquiry(p_id uuid,p_status text) | reject before mutation |
| approve_station_claim(p_claim_id uuid,p_approve boolean) | reject before mutation/operator escalation |

Execution policy: never run this adversarial suite against production. Use an ordinary staging identity plus synthetic target rows and snapshot state before/after each call. Passing requires RPC rejection and unchanged target/role state.