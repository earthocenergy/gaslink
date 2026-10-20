import type { Metadata } from "next";
import LegalPageShell from "@/components/LegalPageShell";

export const metadata: Metadata = {
  title: "Terms | CNGx",
  description: "Terms for using CNGx.",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms"
      intro="These terms apply to your use of CNGx, a product of Earthoc Gas Limited."
    >
      <section>
        <h2>Using CNGx</h2>
        <p>
          Use CNGx lawfully and do not attempt to misuse accounts, bypass
          access controls, manipulate station trust signals, submit information
          you know is false, or interfere with other users or the service.
        </p>
      </section>

      <section>
        <h2>Station information</h2>
        <p>
          CNGx helps users discover CNG stations and understand available
          evidence about a station. Station status, price, queue, opening
          information, location precision and other operational details can
          change. A published record is not automatically a CNGx verification
          or a guarantee that gas will be available when you arrive.
        </p>
        <p>
          Use appropriate judgment before travelling and follow road,
          refuelling and site-safety instructions. Do not use CNGx in a way
          that distracts you while driving.
        </p>
      </section>

      <section>
        <h2>Trip and savings information</h2>
        <p>
          Route, range, refuelling and savings outputs are planning aids. They
          depend on the information supplied, available station data and model
          assumptions. They are not a guarantee of route feasibility, fuel
          availability, vehicle performance or financial savings.
        </p>
      </section>

      <section>
        <h2>Marketplace and service providers</h2>
        <p>
          Marketplace sellers and service providers can be separate businesses
          or individuals. Approval or verification signals in CNGx describe
          the platform status shown to users; they do not replace your own
          checks on suitability, certification, pricing, warranties, payment
          terms or contractual obligations.
        </p>
      </section>

      <section>
        <h2>Your account and submissions</h2>
        <p>
          You are responsible for keeping account credentials secure and for
          the information you submit. Where a submission becomes part of a
          shared commercial, station, moderation or audit record, account
          deletion may require a controlled detach, anonymisation or review
          instead of deleting the shared record.
        </p>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>
          CNGx may change, suspend or improve features and may correct records
          where appropriate. Nothing on CNGx removes rights or obligations
          that cannot lawfully be excluded.
        </p>
      </section>

      <section>
        <h2>Support</h2>
        <p>
          Questions about these terms can be sent to
          {" "}<a href="mailto:support@cngx.ng"><b>support@cngx.ng</b></a>.
        </p>
      </section>
    </LegalPageShell>
  );
}
