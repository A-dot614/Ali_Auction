import PageShell from "../../components/PageShell";
import ScreenState from "../../components/ScreenState";

// PLACEHOLDER COPY (docs/16 §8 #6): search form copy pending review.
export default function SearchPage() {
  return (
    <PageShell title="Search" description="Find listings by keyword.">
      <form className="card" action="/search" method="get">
        <label htmlFor="search-query">Search listings</label> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
        <input id="search-query" name="q" type="search" />
        <button type="submit">Search</button> {/* PLACEHOLDER COPY (docs/16 §8 #6) */}
      </form>
      <ScreenState state="empty" />
    </PageShell>
  );
}
