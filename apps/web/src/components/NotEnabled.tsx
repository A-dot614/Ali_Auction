/**
 * Neutral "not enabled" state for real-mode screens where the backend reports
 * NOT_ENABLED or a capability is still behind a flag. No raw error is rendered.
 */
export default function NotEnabled({
  message = "Not enabled yet",
  detail,
}: {
  message?: string;
  detail?: string;
}) {
  return (
    <section className="card not-enabled" role="status" data-not-enabled="true">
      <p><strong>{message}</strong></p>
      {detail ? <p className="muted">{detail}</p> : null}
    </section>
  );
}
