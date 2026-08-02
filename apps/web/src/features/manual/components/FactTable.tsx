import type { ReactNode } from "react";

interface FactTableProps {
  /** Column headings. Their count defines the table's width. */
  head: string[];
  /** Rows, each the same length as `head`. The first cell is the row's subject. */
  rows: ReactNode[][];
}

/**
 * The evidence under an article.
 *
 * Every table in this manual is filled from the constants the platform actually
 * runs on — the retry ladder from `retryDelayMs`, the severities from
 * `RULE_SEVERITY`, the shifts from `STAGE_SHIFT`. Nothing here is transcribed
 * by hand, because a manual that restates a number is a manual that will one
 * day disagree with the code and be believed anyway.
 */
export function FactTable({ head, rows }: FactTableProps) {
  return (
    <div className="scroll-x">
      <table className="facts">
        <thead>
          <tr>
            {head.map((label) => (
              <th scope="col" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, row) => (
            <tr key={String(cells[0]) || row}>
              {cells.map((cell, column) =>
                column === 0 ? (
                  <th scope="row" key={column}>
                    {cell}
                  </th>
                ) : (
                  <td key={column}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
