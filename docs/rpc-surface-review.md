# CNGx SECURITY DEFINER RPC surface review

Reviewed against production on 2026-09-26. Database authorization remains authoritative. A Supabase Security Advisor warning is not, by itself, a reason to remove a privileged function.

## Authenticated-callable SECURITY DEFINER functions

| Function | Classification | Decision |
|---|---|---|
| `activate_user_role(text)` | authenticated-user needed | Retain. Explicitly limits self-activation to ordinary `driver` / `buyer` roles. |
| `admin_equipment_verification(uuid,text)` | admin-only | Retain; function performs an admin-role check. |
| `admin_marketplace_listing(uuid,text)` | admin-only | Retain; function performs an admin-role check. |
| `admin_marketplace_seller(uuid,text)` | admin-only | Retain; function performs an admin-role check. |
| `admin_moderate_station_report(uuid,boolean)` | admin-only | Retain; function performs an admin-role check. |
| `admin_publish_station(uuid,text)` | admin-only | Retain; controlled publication workflow and internal admin check. |
| `admin_review_station_publication(uuid,text,text)` | admin-only | Retain; controlled publication workflow and internal admin check. |
| `admin_review_station_registration(uuid,boolean)` | admin-only | Retain; current registration-review RPC and explicitly rejects official-directory rows. |
| `admin_service_offering(uuid,text)` | admin-only | Retain; function performs an admin-role check. |
| `admin_service_provider(uuid,text)` | admin-only | Retain; function performs an admin-role check. |
| `admin_unpublish_station(uuid,text)` | admin-only | Retain; safety rollback path and internal admin check. |
| `admin_update_business_enquiry(uuid,text)` | admin-only | Retain; function performs an admin-role check. |
| `approve_station_claim(uuid,boolean)` | admin-only | Retain for current admin workflow; function performs an admin-role check. |
| `approve_station_registration(uuid,boolean)` | obsolete/overlapping | Authenticated EXECUTE revoked in L1. Newer `admin_review_station_registration` is the current guarded workflow. Function retained only for history/service-role compatibility pending later deletion proof. |

## Internal SECURITY DEFINER trigger functions

`handle_gaslink_new_user`, `handle_new_user`, `prevent_profile_role_change`, and `sync_verified_user_role` are not exposed to the authenticated role in the reviewed ACL and are treated as internal trigger functions.

## Advisor interpretation

The remaining admin functions are intentionally callable by a signed-in browser session because the current web application invokes them through Supabase RPC. Their bodies perform explicit admin checks before privileged writes. Moving privileged implementation out of the exposed `public` schema is a worthwhile future hardening path, but doing so in L1 without a staged compatibility environment would risk breaking production workflows.

## Exit condition

Re-run Supabase Security Advisor after every RPC privilege change. Any future privileged RPC must have an explicit caller classification, narrow EXECUTE grants, fixed `search_path`, authorization checks, regression tests, and no reliance on user-editable metadata for authorization.
