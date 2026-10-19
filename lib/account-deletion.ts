export const ACCOUNT_DELETION_CONTRACT_VERSION =
  "2026-10-19.l2-legal-2a";

export const ACCOUNT_DELETION_SUPPORT_EMAIL = "support@cngx.ng";

export const LEGAL_PRODUCT_DECISION =
  "REQUIRES LEGAL/PRODUCT DECISION" as const;

export type AccountDeletionRelationshipSnapshot = {
  profileRole: string | null;
  roles: string[];
  stationSubmissions: number;
  stationClaimsOwned: number;
  stationClaimHistory: number;
  stationReportHistory: number;
  businessEnquiries: number;
  marketplaceSeller: boolean;
  marketplaceListings: number;
  marketplaceBuyerEnquiries: number;
  serviceProvider: boolean;
  serviceOfferings: number;
  serviceCustomerEnquiries: number;
  serviceProviderEnquiries: number;
};

export type AccountDeletionBlockerCode =
  | "privileged_role"
  | "station_relationship"
  | "station_claim_history"
  | "station_report_history"
  | "business_enquiry_history"
  | "marketplace_seller_record"
  | "marketplace_enquiry_history"
  | "service_provider_record"
  | "service_enquiry_history"
  | "retention_review_pending";

export type AccountDeletionBlocker = {
  code: AccountDeletionBlockerCode;
  title: string;
  detail: string;
  decision: typeof LEGAL_PRODUCT_DECISION;
};

export type AccountDeletionPreflightResponse = {
  ok: true;
  contractVersion: string;
  destructiveDeletionEnabled: false;
  readiness: "review_required";
  relationships: AccountDeletionRelationshipSnapshot;
  blockers: AccountDeletionBlocker[];
  coverage: {
    userScopedRelationshipsChecked: true;
    privilegedRetentionReviewRequired: true;
    notScannedByUserScopedPreflight: string[];
  };
  support: {
    email: string;
  };
};

function blocker(
  code: AccountDeletionBlockerCode,
  title: string,
  detail: string,
): AccountDeletionBlocker {
  return {
    code,
    title,
    detail,
    decision: LEGAL_PRODUCT_DECISION,
  };
}

export function buildAccountDeletionPreflight(
  relationships: AccountDeletionRelationshipSnapshot,
): AccountDeletionPreflightResponse {
  const blockers: AccountDeletionBlocker[] = [];
  const roleSet = new Set([
    relationships.profileRole,
    ...relationships.roles,
  ].filter(Boolean));

  if (roleSet.has("admin") || roleSet.has("operator")) {
    blockers.push(
      blocker(
        "privileged_role",
        "Privileged account role",
        "Admin and operator accounts require role, ownership and audit-history review before account deletion.",
      ),
    );
  }

  if (
    relationships.stationSubmissions > 0 ||
    relationships.stationClaimsOwned > 0
  ) {
    blockers.push(
      blocker(
        "station_relationship",
        "Station ownership or submission relationship",
        "Station records can outlive an account and may contain operational or contact information that requires an approved detach or anonymisation rule.",
      ),
    );
  }

  if (relationships.stationClaimHistory > 0) {
    blockers.push(
      blocker(
        "station_claim_history",
        "Station claim history",
        "Reviewed station-claim records need an approved deletion or retention treatment before destructive account deletion.",
      ),
    );
  }

  if (relationships.stationReportHistory > 0) {
    blockers.push(
      blocker(
        "station_report_history",
        "Station report history",
        "Moderated or applied station reports need an approved deletion or retention treatment before destructive account deletion.",
      ),
    );
  }

  if (relationships.businessEnquiries > 0) {
    blockers.push(
      blocker(
        "business_enquiry_history",
        "Business enquiry history",
        "Business enquiries may retain contact and commercial context after the account link is removed.",
      ),
    );
  }

  if (relationships.marketplaceSeller) {
    blockers.push(
      blocker(
        "marketplace_seller_record",
        "Marketplace seller relationship",
        "Seller records, listings and buyer enquiries are shared commercial records and cannot be removed through an unsafe cascade.",
      ),
    );
  }

  if (relationships.marketplaceBuyerEnquiries > 0) {
    blockers.push(
      blocker(
        "marketplace_enquiry_history",
        "Marketplace enquiry history",
        "Buyer enquiries are shared with sellers and need an approved deletion or anonymisation treatment.",
      ),
    );
  }

  if (relationships.serviceProvider) {
    blockers.push(
      blocker(
        "service_provider_record",
        "Service-provider relationship",
        "Provider records, offerings and customer enquiries are shared commercial records and cannot be removed through an unsafe cascade.",
      ),
    );
  }

  if (
    relationships.serviceCustomerEnquiries > 0 ||
    relationships.serviceProviderEnquiries > 0
  ) {
    blockers.push(
      blocker(
        "service_enquiry_history",
        "Service enquiry history",
        "Service enquiries are shared between customers and providers and need an approved deletion or anonymisation treatment.",
      ),
    );
  }

  blockers.push(
    blocker(
      "retention_review_pending",
      "Final retention review required",
      "Search telemetry, publication/audit actor history, abuse telemetry and Storage ownership are not all visible through the user-scoped RLS preflight. Destructive deletion stays disabled until the privileged review contract is approved.",
    ),
  );

  return {
    ok: true,
    contractVersion: ACCOUNT_DELETION_CONTRACT_VERSION,
    destructiveDeletionEnabled: false,
    readiness: "review_required",
    relationships,
    blockers,
    coverage: {
      userScopedRelationshipsChecked: true,
      privilegedRetentionReviewRequired: true,
      notScannedByUserScopedPreflight: [
        "search_events",
        "station_publication_reviews",
        "abuse_write_events (pending Foundation contract)",
        "station_operator_update_audit (pending Foundation contract)",
        "station_verification_audit (pending Foundation contract)",
        "Supabase Storage ownership",
      ],
    },
    support: {
      email: ACCOUNT_DELETION_SUPPORT_EMAIL,
    },
  };
}
