import { useState } from "react";
import type { TreeNode } from "@commander/shared";
import { TreeFigures } from "./TreeFigures";

interface TreeRowProps {
  node: TreeNode;
  totalBytes: number;
  selected: string | null;
  onSelect: (path: string) => void;
}

/**
 * One node of the chart, and its subtree.
 *
 * A directory is a native `<details>`: disclosure, keyboard operation and the
 * expanded/collapsed announcement all come from the element, and no roving
 * tabindex has to be written or maintained. The same instinct as the stage
 * ladder's native radios — the platform already solved this one.
 *
 * Children mount on first open rather than being rendered and hidden, because a
 * `<details>` keeps closed content in the DOM: a four-thousand-file project
 * would otherwise pay for every row it is not showing.
 */
export function TreeRow({ node, totalBytes, selected, onSelect }: TreeRowProps) {
  const [open, setOpen] = useState(false);

  if (node.kind === "file") {
    return (
      <button
        type="button"
        className="chart-row chart-file"
        // aria-pressed, not aria-current: picking a file opens its record, it
        // does not navigate. apps/web/CONSTITUTION.md §7 reserves aria-current
        // for the navigation item you are actually on.
        aria-pressed={selected === node.path}
        onClick={() => onSelect(node.path)}
      >
        <span className="chart-name ltr">{node.name}</span>
        <TreeFigures totals={node.totals} totalBytes={totalBytes} kind="file" />
      </button>
    );
  }

  return (
    <details
      className="chart-branch"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="chart-row chart-dir">
        <span className="chart-name ltr">{node.name}</span>
        <TreeFigures totals={node.totals} totalBytes={totalBytes} kind="dir" />
      </summary>

      {open ? (
        <div className="chart-children">
          {node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              totalBytes={totalBytes}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </details>
  );
}
