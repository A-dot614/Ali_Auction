/**
 * Draft-only public information content. No policy text is authored here: the
 * approved wording is an open counsel decision (decision log §9 #6). The page
 * owns the shell so the landmark and single h1 stay in one place.
 */
export default function LegalNoticeContent({ topics }: { topics: string[] }) {
  return (
    <>
      <section className="card ui-card draft-notice" role="status">
        <p><strong>DRAFT, not approved by counsel</strong></p>
        <p className="muted">
          No approved text is published in this build. No policy rule is stated, implied or decided here.
        </p>
      </section>
      <section className="card ui-card">
        <h2>Topics awaiting approved text</h2>
        <ul>
          {topics.map((topic) => (
            <li key={topic}>{topic} — not yet drafted.</li>
          ))}
        </ul>
        <p className="muted">
          The blocking item is decision log §9 #6 (owner role: counsel). Nothing on this page is legal advice.
        </p>
      </section>
    </>
  );
}
