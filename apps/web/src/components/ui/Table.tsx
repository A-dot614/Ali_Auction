import type { ReactNode } from "react";

/** Responsive table: stacks into cards on narrow viewports. */
export default function Table({
  headings,
  rows,
}: {
  headings: string[];
  rows: ReactNode[][];
}) {
  return (
    <table className="status-table responsive-table ui-table">
      <thead>
        <tr>{headings.map((heading) => <th key={heading} scope="col">{heading}</th>)}</tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}
