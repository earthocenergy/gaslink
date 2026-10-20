import type { Metadata } from "next";
import Link from "next/link";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Support | CNGx",
  description: "Get help with CNGx accounts, stations and services.",
};

export default function SupportPage() {
  return (
    <LegalPageShell
      title="Support"
      intro="Get help with your CNGx account, station information, marketplace, services or business enquiries."
    >
      <section>
        <h2>Contact CNGx</h2>
        <p>
          Email <a href="mailto:support@cngx.ng"><b>support@cngx.ng</b></a>.
          Include the email address connected to your CNGx account when the
          issue is account-specific, but do not send your password.
        </p>
        <p>
          For station issues, include the station name and the problem you
          observed. For marketplace or service enquiries, include enough
          information to identify the relevant listing, provider or request.
        </p>
      </section>

      <section>
        <h2>Account access</h2>
        <p>
          If you can sign in, use the account security controls to sign out
          this device, other sessions or all sessions.
        </p>
        <p>
          <Link className="secondary" href="/account/security">
            Account security
          </Link>
        </p>
      </section>

      <section>
        <h2>Account deletion</h2>
        <p>
          CNGx uses a controlled deletion process because some station,
          marketplace, service and moderation records are shared with other
          users or form part of the platform's trust history.
        </p>
        <p>
          <Link className="secondary" href="/account-deletion">
            Review account deletion
          </Link>
        </p>
      </section>

      <section>
        <h2>Privacy or terms questions</h2>
        <p>
          Read the <Link href="/privacy"><b>Privacy notice</b></Link> and
          {" "}<Link href="/terms"><b>Terms</b></Link> for the current public
          CNGx information.
        </p>
      </section>
    </LegalPageShell>
  );
}
