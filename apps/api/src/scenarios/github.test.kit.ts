/**
 * What GitHub would send about a story, computed from its real repository.
 *
 * Fields are sent as GitHub sends them, whether or not the production code
 * reads them yet. The payload is GitHub's, not ours, so the day the code starts
 * reading one of them the scenarios change with it.
 *
 * Every modelling choice is here, once, so a wrong one is a one-line fix:
 *
 * | What                    | Model                                             | Source |
 * |-------------------------|---------------------------------------------------|--------|
 * | `commits`               | all of before..after, oldest first, never cut     | GitHub docs, push event: "a maximum of 2048 commits"; the 20 cap is the Events timeline's |
 * | `distinct`              | not reachable from any head GitHub held before    | GitHub docs: "distinct from any that have been pushed before" |
 * | a merge's files         | its diff against the first parent                 | not documented; it is what produced the complaint b0be5de answers |
 * | a rename in the webhook | `removed` old path + `added` new path              | the webhook has no rename field |
 * | commit API `files`      | pages of 300, each named by the last one's `Link`, 3,000 in all; with `previous_filename` | GitHub docs, "Get a commit": past 300 files, "pagination link headers for the remaining files, up to a limit of 3000" |
 * | `timestamp`             | the author date                                   | assumption |
 * | list API `since`        | compared with the committer date                  | assumption |
 * | compare API `commits`   | the base..head set, oldest first, never cut        | GitHub docs, "Compare two commits": `git log BASE..HEAD`, chronological; 250 without paging |
 * | compare `merge_base_commit` | `git merge-base base head`                     | GitHub docs, "Compare two commits" |
 * | `commits/{sha}/pulls`   | the pull request merged into `main` whose merge made the sha; none for any other base, open ones not modelled | GitHub docs, "List pull requests associated with a commit": the merged one on the default branch, open ones elsewhere |
 * | `pulls?state=closed&base=` | every pull request merged into that base, the latest first | GitHub docs, "List pull requests" |
 * | `username` / `login`    | `<login>@users.noreply.github.com`; GitHub's own address is `web-flow` | fixture convention |
 * | `repository.default_branch` | `main`                                        | GitHub docs, push event: the full repository object |
 */

import type { Git } from "./git.test.kit.js";
import { REPOSITORY, ZERO, type MergedPull, type PushEvent } from "./story.test.kit.js";

const FIELD = "\x1f";
const RECORD = "\x1e";
const FORMAT = ["%H", "%T", "%an", "%ae", "%aI", "%cn", "%ce", "%cI", "%P", "%B"].join("%x1f") + "%x1e";
const FILES_PAGE = 300;
const FILES_CAP = 3000;
const WEB = `https://github.com/${REPOSITORY}`;

interface Who {
  name: string;
  email: string;
  date: string;
}

interface Meta {
  sha: string;
  tree: string;
  author: Who;
  committer: Who;
  parents: string[];
  message: string;
}

interface Entry {
  /** git's letter: A, D, M, T, R or C. */
  status: string;
  path: string;
  previous?: string;
  additions: number;
  deletions: number;
}

export interface WebhookPush {
  ref: string;
  before: string;
  after: string;
  created: boolean;
  deleted: boolean;
  forced: boolean;
  commits: Record<string, unknown>[];
  [field: string]: unknown;
}

const API_STATUS: Record<string, string> = {
  A: "added",
  D: "removed",
  M: "modified",
  T: "changed",
  R: "renamed",
  C: "copied",
};

export class GitHubView {
  private readonly metas = new Map<string, Meta>();
  private readonly diffs = new Map<string, Entry[]>();

  constructor(
    private readonly git: Git,
    private readonly merged: readonly MergedPull[] = [],
  ) {}

  /** `GET /repos/{owner}/{repo}/commits/{sha}/pulls`: on the default branch, the merged one that made it. */
  pulls(sha: string) {
    return this.merged.filter((pull) => pull.base === "main" && pull.mergeCommit === sha).map(pullJson);
  }

  /** `GET /repos/{owner}/{repo}/pulls?state=closed&base=…&sort=updated&direction=desc`. */
  closedPulls(base: string) {
    return this.merged.filter((pull) => pull.base === base).reverse().map(pullJson);
  }

  /** The `push` webhook body for one event. */
  async webhook(event: PushEvent): Promise<WebhookPush> {
    const deleted = event.after === ZERO;
    const created = event.before === ZERO;
    const shas = deleted ? [] : await this.pushed(event);
    const [metas, fresh, forced] = await Promise.all([
      this.meta(shas),
      deleted ? new Set<string>() : this.unseen(event),
      this.forced(event),
    ]);
    await this.diffAll(metas);
    const commits = await Promise.all(metas.map((meta) => this.webhookCommit(meta, fresh.has(meta.sha))));

    return {
      ref: event.ref,
      before: event.before,
      after: event.after,
      created,
      deleted,
      forced,
      base_ref: null,
      compare: `${WEB}/compare/${event.before.slice(0, 12)}...${event.after.slice(0, 12)}`,
      commits,
      head_commit: commits.at(-1) ?? null,
      repository: { full_name: REPOSITORY, html_url: WEB, default_branch: "main" },
      pusher: { name: event.sender.login, email: event.sender.email },
      sender: { login: event.sender.login, avatar_url: "" },
    };
  }

  /** `GET /repos/{owner}/{repo}/commits/{sha}` and each page its `Link` names: 300 files to a page, 3,000 in all. */
  async commitPages(sha: string) {
    const [meta] = await this.meta([sha]);
    if (!meta) throw new Error(`no commit ${sha} in the story`);
    const files = await this.entries(meta);
    const listed = files.slice(0, FILES_CAP);
    const pages = Array.from({ length: Math.max(1, Math.ceil(listed.length / FILES_PAGE)) }, (_, at) =>
      listed.slice(at * FILES_PAGE, (at + 1) * FILES_PAGE).map(apiFile),
    );

    return pages.map((page) => ({
      sha,
      commit: {
        message: meta.message,
        author: meta.author,
        committer: meta.committer,
        tree: { sha: meta.tree },
      },
      author: account(meta.author.email),
      committer: account(meta.committer.email),
      parents: meta.parents.map((parent) => ({ sha: parent })),
      stats: totals(files),
      files: page,
    }));
  }

  /** `GET /repos/{owner}/{repo}/commits?sha=<head>&since=…`, newest first. */
  async list(head: string, since: number) {
    const metas = parseMetas(await this.git.run(["log", `--format=${FORMAT}`, head]));
    metas.forEach((meta) => this.metas.set(meta.sha, meta));
    return metas.filter((meta) => Date.parse(meta.committer.date) >= since).map(listed);
  }

  /** `GET /repos/{owner}/{repo}/compare/{base}...{head}`: the base..head set, oldest first, and where they forked. */
  async compare(base: string, head: string) {
    const [log, fork] = await Promise.all([
      this.git.run(["log", "--reverse", `--format=${FORMAT}`, `${base}..${head}`]),
      this.git.run(["merge-base", base, head]),
    ]);
    const metas = parseMetas(log);
    metas.forEach((meta) => this.metas.set(meta.sha, meta));
    return { total_commits: metas.length, commits: metas.map(listed), merge_base_commit: { sha: fork.trim() } };
  }

  /** before..after, or — for a new branch — everything no other head reaches. */
  private async pushed(event: PushEvent): Promise<string[]> {
    const exclude = event.before === ZERO ? event.heads : [event.before];
    const out = await this.git.run([
      "rev-list",
      "--reverse",
      "--topo-order",
      event.after,
      ...exclude.map((sha) => `^${sha}`),
    ]);
    return out.split("\n").filter(Boolean);
  }

  /** Commits no head GitHub held could reach: the ones never pushed before. */
  private async unseen(event: PushEvent): Promise<Set<string>> {
    const out = await this.git.run(["rev-list", event.after, ...event.heads.map((sha) => `^${sha}`)]);
    return new Set(out.split("\n").filter(Boolean));
  }

  private async forced(event: PushEvent): Promise<boolean> {
    if (event.before === ZERO || event.after === ZERO) return false;
    return !(await this.isAncestor(event.before, event.after));
  }

  private isAncestor(older: string, newer: string): Promise<boolean> {
    return this.git.run(["merge-base", "--is-ancestor", older, newer]).then(
      () => true,
      (error: unknown) => {
        // Exit status 1 is git's "no". Anything else is a failure worth seeing.
        if (error instanceof Error && "code" in error && error.code === 1) return false;
        throw error;
      },
    );
  }

  private async meta(shas: string[]): Promise<Meta[]> {
    const missing = shas.filter((sha) => !this.metas.has(sha));
    if (missing.length > 0) {
      const out = await this.git.run(["log", "--no-walk=unsorted", `--format=${FORMAT}`, ...missing]);
      parseMetas(out).forEach((meta) => this.metas.set(meta.sha, meta));
    }
    return shas.map((sha) => this.metas.get(sha)).filter((meta): meta is Meta => meta !== undefined);
  }

  /** The commit's files against its first parent, renames detected — what GitHub shows. */
  private async entries(meta: Meta): Promise<Entry[]> {
    await this.diffAll([meta]);
    return this.diffs.get(meta.sha) ?? [];
  }

  /** Every missing diff in one `diff-tree --stdin`: one process per push, not per commit. */
  private async diffAll(metas: Meta[]): Promise<void> {
    const missing = metas.filter((meta) => !this.diffs.has(meta.sha));
    if (missing.length === 0) return;

    // "<commit> <first parent>" compares against that parent alone; a root
    // commit on its own line is compared with the empty tree (--root).
    const input = missing.map((meta) => [meta.sha, ...meta.parents.slice(0, 1)].join(" ")).join("\n");
    const args = ["diff-tree", "--stdin", "--root", "--always", "-r", "-M", "-z", "--raw", "--numstat"];
    const sections = parseSections(await this.git.feed(args, `${input}\n`));
    for (const meta of missing) this.diffs.set(meta.sha, sections.get(meta.sha) ?? []);
  }

  private async webhookCommit(meta: Meta, distinct: boolean): Promise<Record<string, unknown>> {
    const files = await this.entries(meta);
    return {
      id: meta.sha,
      tree_id: meta.tree,
      distinct,
      message: meta.message,
      timestamp: meta.author.date,
      url: `${WEB}/commit/${meta.sha}`,
      author: identity(meta.author),
      committer: identity(meta.committer),
      ...webhookLists(files),
    };
  }
}

function pullJson(pull: MergedPull) {
  return { number: pull.number, merged_at: "2026-08-10T12:00:00Z", merge_commit_sha: pull.mergeCommit, head: { sha: pull.head } };
}

function parseMetas(out: string): Meta[] {
  return out
    .split(RECORD)
    .map((record) => record.replace(/^\n/, ""))
    .filter(Boolean)
    .map((record) => {
      const [sha = "", tree = "", an = "", ae = "", ad = "", cn = "", ce = "", cd = "", parents = "", message = ""] =
        record.split(FIELD);
      return {
        sha,
        tree,
        author: { name: an, email: ae, date: ad },
        committer: { name: cn, email: ce, date: cd },
        parents: parents.split(" ").filter(Boolean),
        message: message.replace(/\n+$/, ""),
      };
    });
}

interface Section {
  entries: Entry[];
  counts: Map<string, [number, number]>;
}

/**
 * `diff-tree --stdin -z --raw --numstat`: for each commit its sha, its raw
 * records, then its counts — all NUL-separated, so a sha token opens a section.
 */
function parseSections(out: string): Map<string, Entry[]> {
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
    const status = (token.split(" ").at(-1) ?? "M").charAt(0);
    const twoPaths = status === "R" || status === "C";
    const first = tokens[at + 1] ?? "";
    const path = twoPaths ? tokens[at + 2] ?? "" : first;
    section.entries.push({ status, path, ...(twoPaths && { previous: first }), additions: 0, deletions: 0 });
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

function login(email: string): string | undefined {
  if (email === "noreply@github.com") return "web-flow";
  return /^(.+)@users\.noreply\.github\.com$/.exec(email)?.[1];
}

function account(email: string): { login: string } | null {
  const name = login(email);
  return name ? { login: name } : null;
}

/** One commit as the list and compare endpoints both show it. */
function listed(meta: Meta) {
  return {
    sha: meta.sha,
    html_url: `${WEB}/commit/${meta.sha}`,
    commit: { message: meta.message, author: meta.author, committer: meta.committer },
    author: account(meta.author.email),
    committer: account(meta.committer.email),
    parents: meta.parents.map((parent) => ({ sha: parent })),
  };
}

function identity(who: Who) {
  const username = login(who.email);
  return { name: who.name, email: who.email, ...(username !== undefined && { username }) };
}

function webhookLists(files: Entry[]) {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  for (const file of files) {
    if (file.status === "A" || file.status === "C") added.push(file.path);
    else if (file.status === "D") removed.push(file.path);
    else if (file.status === "R") {
      removed.push(file.previous ?? "");
      added.push(file.path);
    } else modified.push(file.path);
  }
  return { added, removed, modified };
}

function totals(files: Entry[]) {
  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  return { additions, deletions, total: additions + deletions };
}

function apiFile(file: Entry) {
  return {
    filename: file.path,
    status: API_STATUS[file.status] ?? "modified",
    additions: file.additions,
    deletions: file.deletions,
    changes: file.additions + file.deletions,
    ...(file.previous !== undefined && { previous_filename: file.previous }),
  };
}
