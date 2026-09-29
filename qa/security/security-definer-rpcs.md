# SECURITY DEFINER authenticated RPC inventory

## Inventory basis

The last read-only production inventory captured 2026-09-28 contained 13
SECURITY DEFINER RPCs executable by `authenticated`.

The current Foundation source has since advanced. Forward migrations introduce
additional authenticated-executable SECURITY DEFINER boundaries. Source
presence does not imply that a pending migration has already been applied to
production.

Every authenticated-executable SECURITY DEFINER RPC must have an explicit
authorization expectation before RC staging execution.

| RPC | Source/live classification | Ordinary-user adversarial expectation |
|---|---|---|
| activate_user_role(p_role text) | previous live inventory | reject admin/operator escalation; legitimate supported self-activation must remain bounded |
| admin_equipment_verification(p_id uuid,p_status text) | previous live inventory | reject before mutation |
| admin_marketplace_listing(p_id uuid,p_status text) | previous live inventory | reject before mutation |
| admin_marketplace_seller(p_id uuid,p_status text) | previous live inventory | reject before mutation |
| admin_moderate_station_report(p_report_id uuid,p_apply boolean) | previous live inventory; redefined by trust migration | reject before mutation |
| admin_publish_station(p_station_id uuid,p_notes text) | previous live inventory | reject before mutation |
| admin_review_station_publication(p_station_id uuid,p_decision text,p_notes text) | previous live inventory | reject before mutation |
| admin_review_station_registration(p_station_id uuid,p_approve boolean) | previous live inventory; redefined by trust migration | reject before mutation/operator grant |
| admin_service_offering(p_id uuid,p_status text) | previous live inventory | reject before mutation |
| admin_service_provider(p_id uuid,p_status text) | previous live inventory | reject before mutation |
| admin_unpublish_station(p_station_id uuid,p_notes text) | previous live inventory | reject before mutation |
| admin_update_business_enquiry(p_id uuid,p_status text) | previous live inventory | reject before mutation |
| approve_station_claim(p_claim_id uuid,p_approve boolean) | previous live inventory; redefined by trust migration | reject before mutation/operator escalation |
| operator_update_station_operational(p_station_id uuid,p_status station_status,p_price_per_scm numeric,p_queue_minutes integer,p_opening_hours text,p_open_now boolean) | trust-contract forward migration | unrelated ordinary user must be rejected before mutation; legitimate claimant may update only the operational fields authorized by the RPC |
| admin_set_station_verification(p_station_id uuid,p_verified boolean) | trust-contract forward migration | reject ordinary non-admin before verification mutation/audit |
| check_write_abuse(p_action text,p_network_key text,p_duplicate_key text) | rate/abuse forward migration; pending L1C activation | authenticated execution is intentional; staging must prove it cannot be used to bypass or corrupt abuse-control state |

`approve_station_registration(uuid, boolean)` remains SECURITY DEFINER in source
but is explicitly revoked from `public`, `anon`, and `authenticated` and granted
only to `service_role`. It is therefore excluded from the authenticated
adversarial execution matrix and must remain non-executable by an ordinary
authenticated identity.

## Staging execution policy

Never run this adversarial suite against production.

L1C staging execution must use synthetic rows and ordinary test identities.
For rejection cases, snapshot relevant target and role state before and after
each call. Passing requires both the expected authorization result and unchanged
protected state.

For intentionally authenticated operations, success alone is not sufficient:
staging must prove the caller can mutate only the documented scope and cannot
cross user, operator, admin, verification, publication, or other trust
boundaries.
