import Link from "next/link";
import PageShell from "../../components/PageShell";
import NotEnabled from "../../components/NotEnabled";
import { PROFILE_EDIT_FIELDS } from "../../lib/profile-fields";

export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <PageShell title="Account" description="Your account details.">
      <section className="card">
        <h2>Profile fields</h2>
        <p className="muted">Allowlisted fields: {PROFILE_EDIT_FIELDS.join(", ")}. Email and account status are excluded.</p>
        <p>This build shows the allowlist only; no profile request is sent from this screen.</p>
      </section>
      <NotEnabled
        message="Not enabled yet"
        detail="Email change and re-verification are pending."
      />
      <Link href="/account/email">Email change</Link>
    </PageShell>
  );
}
