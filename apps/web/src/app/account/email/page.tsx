import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "../../../components/PageShell";
import NotEnabled from "../../../components/NotEnabled";

export const metadata: Metadata = {
  title: "Email change — AliAuction.ca",
  description: "Email change is not enabled in this build.",
};

export const dynamic = "force-dynamic";

export default function EmailChangePage() {
  return (
    <PageShell title="Email change" description="Email change is not implemented in this build.">
      <NotEnabled
        message="Not enabled yet"
        detail="The backend returns NOT_ENABLED for email change. No re-verification flow is shown."
      />
      <Link href="/account">Back to account</Link>
    </PageShell>
  );
}
