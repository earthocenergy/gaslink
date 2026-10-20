import Link from "next/link";
import { APP_OWNER_LINE } from "@/lib/brand";

export default function SiteFooter() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--line)",
        background: "#fff",
        padding: "24px max(5vw, 24px)",
        display: "flex",
        gap: 14,
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        fontSize: 13,
      }}
    >
      <span className="muted">{APP_OWNER_LINE}</span>
      <nav
        aria-label="Legal and support links"
        style={{ display: "flex", gap: 14, flexWrap: "wrap" }}
      >
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/support">Support</Link>
        <Link href="/account-deletion">Delete account</Link>
      </nav>
    </footer>
  );
}
