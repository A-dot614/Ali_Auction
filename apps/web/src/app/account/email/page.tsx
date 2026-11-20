import Link from "next/link";
import PageShell from "../../../components/PageShell";
import NotEnabled from "../../../components/NotEnabled";

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
