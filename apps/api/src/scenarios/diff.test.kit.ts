/**
 * git's own account of what each commit changed, read the way GitHub reports
 * it: `diff-tree --stdin -z --raw --numstat`, one process per push. Split from
 * `github.test.kit.ts`, which builds GitHub's JSON from these entries.
 */

export interface Entry {
  /** git's letter: A, D, M, T, R or C. */
  status: string;
  path: string;
  previous?: string;
  /** The blob the commit left at `path`. */
  blob: string;
  additions: number;
  deletions: number;
}

interface Section {
  entries: Entry[];
  counts: Map<string, [number, number]>;
}

/**
 * `diff-tree --stdin -z --raw --numstat`: for each commit its sha, its raw
 * records, then its counts — all NUL-separated, so a sha token opens a section.
 */
export function parseSections(out: string): Map<string, Entry[]> {
  const tokens = out.split("\0");
  const sections = new Map<string, Section>();
  let current: Section | undefined;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i] ?? "";
    if (/^[0-9a-f]{40}$/.test(token)) {
      current = { entries: [], counts: new Map() };
      sections.set(token, current);
    } else if (current) {
      i += readRecord(tokens, i, current);
    }
  }
  return new Map([...sections].map(([sha, section]) => [sha, withCounts(section)]));
}

/** One raw record or one count at `tokens[at]`; returns how many path tokens followed it. */
function readRecord(tokens: string[], at: number, section: Section): number {
  const token = tokens[at] ?? "";
  if (token.startsWith(":")) {
    const fields = token.split(" ");
    const status = (fields.at(-1) ?? "M").charAt(0);
    const blob = fields[3] ?? "";
    const twoPaths = status === "R" || status === "C";
    const first = tokens[at + 1] ?? "";
    const path = twoPaths ? tokens[at + 2] ?? "" : first;
    section.entries.push({ status, path, blob, ...(twoPaths && { previous: first }), additions: 0, deletions: 0 });
    return twoPaths ? 2 : 1;
  }

  const count = /^([\d-]+)\t([\d-]+)\t(.*)$/.exec(token);
  if (!count) return 0;
  // A rename's count carries no path of its own: the old and new paths follow it.
  const path = count[3] || (tokens[at + 2] ?? "");
  section.counts.set(path, [Number(count[1]) || 0, Number(count[2]) || 0]);
  return count[3] ? 0 : 2;
}

function withCounts(section: Section): Entry[] {
  return section.entries.map((entry) => {
    const [additions, deletions] = section.counts.get(entry.path) ?? [0, 0];
    return { ...entry, additions, deletions };
  });
}
