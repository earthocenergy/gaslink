import type { Metadata } from "next";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Privacy | CNGx",
  description: "How CNGx handles account, station and service data.",
};

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy"
      intro="CNGx is operated by Earthoc Gas Limited. This notice explains the information CNGx processes to provide station discovery, account, marketplace, service and business features."
    >
      <section>
        <h2>Information CNGx processes</h2>
        <p>
          Depending on how you use CNGx, the service may process your account
          email, name, phone number, account roles, authentication and session
          information, and information you choose to submit through CNGx.
        </p>
        <p>
          User submissions can include station reports, station claims and
          registrations, business enquiries, marketplace seller and buyer
          information, service-provider information, service enquiries,
          locations you enter into search or trip features, and contact or
          operational details included in those submissions.
        </p>
      </section>

      <section>
        <h2>How CNGx uses information</h2>
        <p>
          CNGx uses information to authenticate accounts, operate requested
          features, protect the service, review submissions, maintain station
          trust and freshness, support marketplace and service interactions,
          respond to business enquiries, and investigate misuse or security
          incidents.
        </p>
      </section>

      <section>
        <h2>Station and public information</h2>
        <p>
          Some station information is intended for public discovery. CNGx
          separates published directory records, user-submitted records,
          verification state and operational updates so that source and trust
          signals are not silently converted into stronger claims.
        </p>
        <p>
          If an account is connected to a station or business record, deleting
          the account does not automatically mean the public or shared record
          can be deleted. CNGx must preserve the station trust model and avoid
          deleting information belonging to another participant.
        </p>
      </section>

      <section>
        <h2>Sharing and service providers</h2>
        <p>
          CNGx may use infrastructure and service providers to host, secure,
          authenticate and operate the product. Marketplace and service
          enquiries are also shared with the relevant seller or provider as
          needed to respond to the enquiry.
        </p>
      </section>

      <section>
        <h2>Retention and account deletion</h2>
        <p>
          Different records have different relationships. Some account-linked
          records can be removed with the account, while some shared,
          moderated, security or audit records need an approved deletion,
          anonymisation or retention treatment. CNGx does not use a blanket
          cascade where that could delete another person's records or weaken
          station and moderation history.
        </p>
        <p>
          Visit <a href="/account-deletion"><b>Account deletion</b></a> to
          review the current deletion process. No unpublished retention period
          is implied by this notice.
        </p>
      </section>

      <section>
        <h2>Your choices and support</h2>
        <p>
          You can update information through the available CNGx account and
          submission flows. For privacy, correction or deletion questions,
          contact <a href="mailto:support@cngx.ng"><b>support@cngx.ng</b></a>.
        </p>
      </section>

      <section>
        <h2>Changes to this notice</h2>
        <p>
          CNGx may update this notice as the product, legal requirements or
          data-handling practices change. The published page will show its most
          recent update date.
        </p>
      </section>
    </LegalPageShell>
  );
}
