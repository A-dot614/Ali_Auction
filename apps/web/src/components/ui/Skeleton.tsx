/** Non-animated loading placeholder; announcements come from ScreenState. */
export default function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="ui-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => <span key={index} className="ui-skeleton-line" />)}
    </div>
  );
}
