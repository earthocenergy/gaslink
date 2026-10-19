import Link from "next/link";
import type { ReactNode } from "react";
import { APP_NAME, APP_OWNER_LINE } from "@/lib/brand";

export default function LegalPageShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main
      className="authWrap"
      style={{ alignItems: "start", paddingTop: 36, paddingBottom: 64 }}
    >
      <article
        className="authCard"
        style={{
          width: "min(100%, 900px)",
          display: "grid",
          gap: 22,
          lineHeight: 1.65,
        }}
      >
        <div>
          <Link href="/" className="brand">
            <span className="mark">x</span>
            <span>
              <b>{APP_NAME}</b>
              <small>{APP_OWNER_LINE}</small>
            </span>
          </Link>
        </div>

        <div>
          <h1 style={{ marginBottom: 8 }}>{title}</h1>
          <p className="muted" style={{ margin: 0 }}>{intro}</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Last updated: 19 October 2026
          </p>
        </div>

        <nav
          aria-label="Legal and support"
          style={{ display: "flex", flexWrap: "wrap", gap: 10 }}
        >
          <Link className="secondary" href="/privacy">Privacy</Link>
          <Link className="secondary" href="/terms">Terms</Link>
          <Link className="secondary" href="/support">Support</Link>
          <Link className="secondary" href="/account-deletion">
            Account deletion
          </Link>
        </nav>

        <div style={{ display: "grid", gap: 18 }}>{children}</div>
      </article>
    </main>
  );
}
