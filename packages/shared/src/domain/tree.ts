/**
 * Turns the flat file list into the chart the panel draws.
 *
 * The server sends rows, not a tree: a tree is a *view* of the rows, and
 * building it here keeps it pure — the same snapshot always yields the same
 * chart, on any machine, with no network involved. It is also the reason a
 * collapsed directory can say anything at all: every node carries the rolled-up
 * totals of everything beneath it, so the chart is readable before it is opened.
 */

import { DEFAULT_CHECKS, type CheckConfigMap } from "./checks.js";
import { absorb, credit, emptyTotals, fileTotals, leader } from "./tree-totals.js";
import type { TreeTotals } from "./tree-totals.js";
// Re-exported so a consumer of the chart never has to know the totals moved.
export type { TreeTotals };
import type { TreeFile } from "../contracts/tree.js";

export interface TreeNode {
  /** The segment alone — the chart indents, it does not repeat the path. */
  name: string;
  /** The full path, which is what a file's record is keyed on. */
  path: string;
  kind: "dir" | "file";
  /** Empty on a file. */
  children: TreeNode[];
  totals: TreeTotals;
  /** The row this node was built from. Null on a directory, which has no row. */
  file: TreeFile | null;
}

interface Dir {
  dirs: Map<string, Dir>;
  files: TreeFile[];
}

/**
 * Directories first, then files, each in code-unit order.
 *
 * Deliberately not `localeCompare`: collation depends on the runtime's locale
 * data, and this subsystem's whole claim is that the same snapshot produces the
 * same result everywhere.
 */
function ordered(nodes: TreeNode[]): TreeNode[] {
  return nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}

function insert(root: Dir, file: TreeFile): void {
  const segments = file.path.split("/");
  let dir = root;

  for (const segment of segments.slice(0, -1)) {
    let next = dir.dirs.get(segment);
    if (!next) {
      next = { dirs: new Map(), files: [] };
      dir.dirs.set(segment, next);
    }
    dir = next;
  }

  dir.files.push(file);
}

function fileNode(file: TreeFile, checks: CheckConfigMap): TreeNode {
  return {
    name: file.path.slice(file.path.lastIndexOf("/") + 1),
    path: file.path,
    kind: "file",
    children: [],
    totals: fileTotals(file, checks),
    file,
  };
}

function join(prefix: string, name: string): string {
  return prefix ? `${prefix}/${name}` : name;
}

/** Expands one directory, returning its node and the owner tally its parent
 *  needs — rolling the tally upward costs one pass instead of one walk per node. */
function expand(input: {
  dir: Dir;
  name: string;
  path: string;
  checks: CheckConfigMap;
}): { node: TreeNode; owners: Map<string, number> } {
  const { dir, name, path, checks } = input;
  const totals = emptyTotals();
  const owners = new Map<string, number>();
  const children: TreeNode[] = [];

  for (const [childName, childDir] of dir.dirs) {
    const child = expand({ dir: childDir, name: childName, path: join(path, childName), checks });
    children.push(child.node);
    absorb(totals, child.node.totals);
    for (const [login, lines] of child.owners) {
      owners.set(login, (owners.get(login) ?? 0) + lines);
    }
  }

  for (const file of dir.files) {
    children.push(fileNode(file, checks));
    absorb(totals, fileTotals(file, checks));
    credit(owners, file);
  }

  totals.topOwner = leader(owners);
  return { node: { name, path, kind: "dir", children: ordered(children), totals, file: null }, owners };
}

/**
 * The whole chart as one node.
 *
 * Returning the synthetic root rather than a bare list is what stops the header
 * and the chart from disagreeing: the summary is `root.totals`, computed in the
 * same pass that built `root.children`, not recomputed from the file list
 * afterwards by a second piece of arithmetic that can drift.
 */
export function buildTree(files: TreeFile[], checks: CheckConfigMap = DEFAULT_CHECKS): TreeNode {
  const root: Dir = { dirs: new Map(), files: [] };
  for (const file of files) insert(root, file);
  return expand({ dir: root, name: "", path: "", checks }).node;
}
