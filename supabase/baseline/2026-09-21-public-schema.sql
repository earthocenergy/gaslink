-- GasLink live database schema baseline
-- Captured from Supabase project knhrgugextsmisyxzdgc on 2026-09-21.
-- DOCUMENTATION SNAPSHOT ONLY. Do not apply this file as a migration.
-- Historical live migrations remain recorded in docs/database-baseline.md.
-- Future database changes must be added as new forward-only migrations.

-- Public enum types
-- app_role: driver, operator, admin
-- claim_status: pending, approved, rejected
-- station_status: available, low_supply, out_of_gas, offline, unknown

-- public.profiles
-- id uuid PK -> auth.users(id) ON DELETE CASCADE
-- full_name text null
-- role app_role NOT NULL DEFAULT driver
-- phone text null
-- created_at timestamptz NOT NULL DEFAULT now()
-- updated_at timestamptz NOT NULL DEFAULT now()

-- public.user_roles
-- user_id uuid -> auth.users(id) ON DELETE CASCADE
-- role text NOT NULL CHECK role in (driver,buyer,seller,operator,service_provider,admin)
-- created_at timestamptz NOT NULL DEFAULT now()
-- PK (user_id, role)

-- public.stations
-- id uuid PK DEFAULT gen_random_uuid()
-- name text NOT NULL; operator_name text; address text NOT NULL; city text; state text
-- latitude float8; longitude float8
-- status station_status NOT NULL DEFAULT unknown
-- price_per_scm numeric CHECK null or >=0
-- queue_minutes int CHECK null or >=0
-- open_now boolean; opening_hours text
-- vehicle_compatibility text[] NOT NULL DEFAULT {}
-- is_demo boolean NOT NULL DEFAULT true
-- is_verified boolean NOT NULL DEFAULT false
-- claimed_by uuid -> auth.users(id) ON DELETE SET NULL
-- last_verified_at timestamptz
-- created_at/updated_at timestamptz NOT NULL DEFAULT now()
-- registration_status text NOT NULL DEFAULT approved CHECK pending|approved|rejected
-- submitted_by uuid -> auth.users(id) ON DELETE SET NULL
-- phone text; email text

-- public.station_claims
-- id uuid PK DEFAULT gen_random_uuid()
-- station_id uuid -> stations(id) ON DELETE CASCADE
-- user_id uuid -> auth.users(id) ON DELETE CASCADE
-- status claim_status NOT NULL DEFAULT pending
-- business_name text; phone text; note text
-- created_at timestamptz NOT NULL DEFAULT now(); reviewed_at timestamptz
-- UNIQUE (station_id,user_id)

-- public.station_reports
-- id uuid PK DEFAULT gen_random_uuid()
-- station_id uuid -> stations(id) ON DELETE CASCADE
-- user_id uuid -> auth.users(id) ON DELETE CASCADE
-- status station_status null
-- price_per_scm numeric CHECK null or >=0
-- queue_minutes int CHECK null or >=0
-- note text; is_moderated boolean NOT NULL DEFAULT false
-- created_at timestamptz NOT NULL DEFAULT now()

-- public.search_events
-- id bigint identity PK
-- user_id uuid -> auth.users(id) ON DELETE SET NULL
-- query/origin/destination text; event_type text NOT NULL
-- created_at timestamptz NOT NULL DEFAULT now()

-- public.marketplace_sellers
-- id uuid PK DEFAULT gen_random_uuid()
-- user_id uuid UNIQUE -> auth.users(id) ON DELETE CASCADE
-- business_name text NOT NULL; phone/email/city/state/description text
-- verification_status text NOT NULL DEFAULT pending CHECK pending|verified|rejected
-- created_at/updated_at timestamptz NOT NULL DEFAULT now()

-- public.marketplace_listings
-- id uuid PK DEFAULT gen_random_uuid()
-- seller_id uuid -> marketplace_sellers(id) ON DELETE CASCADE
-- title/category/condition text NOT NULL; condition CHECK new|used|refurbished
-- brand/model/description/specifications text
-- quantity int NOT NULL DEFAULT 1 CHECK >0
-- city/state text; price numeric CHECK null or >=0
-- price_on_request boolean NOT NULL DEFAULT false
-- status text NOT NULL DEFAULT pending CHECK draft|pending|approved|rejected|sold|inactive
-- is_featured boolean NOT NULL DEFAULT false
-- created_at/updated_at timestamptz NOT NULL DEFAULT now()
-- image_url/certification text
-- equipment_verification_status text NOT NULL DEFAULT unverified CHECK unverified|reviewing|verified|rejected

-- public.marketplace_enquiries
-- id uuid PK DEFAULT gen_random_uuid()
-- listing_id uuid -> marketplace_listings(id) ON DELETE CASCADE
-- buyer_id uuid -> auth.users(id) ON DELETE CASCADE
-- message/phone text; status text NOT NULL DEFAULT new
-- created_at timestamptz NOT NULL DEFAULT now()

-- public.service_providers
-- id uuid PK DEFAULT gen_random_uuid()
-- user_id uuid UNIQUE -> auth.users(id) ON DELETE CASCADE
-- business_name/provider_type text NOT NULL
-- phone/email/address/city/state/description text
-- verification_status text NOT NULL DEFAULT pending CHECK pending|verified|rejected
-- created_at timestamptz NOT NULL DEFAULT now()

-- public.service_offerings
-- id uuid PK DEFAULT gen_random_uuid()
-- provider_id uuid -> service_providers(id) ON DELETE CASCADE
-- title/category text NOT NULL; description text; price_from numeric
-- status text NOT NULL DEFAULT pending CHECK pending|approved|rejected|inactive
-- created_at timestamptz NOT NULL DEFAULT now()

-- public.service_enquiries
-- id uuid PK DEFAULT gen_random_uuid()
-- offering_id uuid -> service_offerings(id) ON DELETE SET NULL
-- provider_id uuid -> service_providers(id) ON DELETE CASCADE
-- customer_id uuid -> auth.users(id) ON DELETE CASCADE
-- message/phone text; status text NOT NULL DEFAULT new
-- created_at timestamptz NOT NULL DEFAULT now()

-- public.business_enquiries
-- id uuid PK DEFAULT gen_random_uuid()
-- user_id uuid -> auth.users(id) ON DELETE SET NULL
-- company_name/contact_name/enquiry_type text NOT NULL
-- email/phone/operating_locations/message text
-- fleet_size int CHECK null or >=0
-- estimated_daily_scm numeric CHECK null or >=0
-- status text NOT NULL DEFAULT new CHECK new|contacted|qualified|closed
-- created_at timestamptz NOT NULL DEFAULT now()

-- Indexes beyond PK/UNIQUE:
-- business_enquiries_user_id_idx(user_id)
-- marketplace_enquiries_buyer_idx(buyer_id)
-- marketplace_enquiries_listing_id_idx(listing_id)
-- marketplace_listings_category_idx(category)
-- marketplace_listings_seller_id_idx(seller_id)
-- marketplace_listings_status_idx(status)
-- search_events_user_id_idx(user_id)
-- service_enquiries_customer_id_idx(customer_id)
-- service_enquiries_offering_id_idx(offering_id)
-- service_enquiries_provider_id_idx(provider_id)
-- service_offering_category_idx(category)
-- service_offerings_provider_id_idx(provider_id)
-- service_provider_type_idx(provider_type)
-- station_claims_user_id_idx(user_id)
-- station_reports_station_id_idx(station_id)
-- station_reports_user_id_idx(user_id)
-- stations_claimed_by_idx(claimed_by)
-- stations_submitted_by_idx(submitted_by)

-- RLS is enabled on every public table. Exact live policy predicates,
-- function definitions, trigger inventory and migration ledger are documented
-- in docs/database-baseline.md and should be re-inspected before future DB changes.
