/**
 * A real git repository in a temporary directory, driven the way people drive
 * one — commits, branches, merges, rebases, cherry-picks, reverts — with every
 * identity and instant fixed, so the same story always produces the same shas.
 *
 * Plain commits are written with `git fast-import`: a run of them costs one
 * process instead of two per commit, and the objects are git's own. Everything
 * with semantics — merging, resolving, replaying, reverting — is left to the
 * porcelain, because the point is git's behaviour, not a model of it.
 *
 * Isolated from the machine it runs on, on purpose:
 * - no global or system config: a signing key, a hook path or a default branch
 *   set there would change the history, or stop it being written at all;
 * - none of the caller's GIT_* variables: `verify` run from inside a git hook
 *   inherits GIT_DIR, which would point every command here at the real repository.
 */

import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { devNull, tmpdir } from "node:os";
import { dirname, join } from "node:path";

export interface Person {
  login: string;
  name: string;
  email: string;
}

function person(login: string): Person {
  const name = login.charAt(0).toUpperCase() + login.slice(1);
  return { login, name, email: `${login}@users.noreply.github.com` };
}

export const SARA = person("sara");
export const OMAR = person("omar");
export const LINA = person("lina");

/** The committer GitHub's web UI writes on every merge, squash, rebase and edit. */
export const WEB_FLOW: Person = { login: "web-flow", name: "GitHub", email: "noreply@github.com" };

/** Monday 2026-08-10, 10:00 at +03:00 — a weekday morning, clear of every time rule. */
const START = Date.parse("2026-08-10T10:00:00+03:00");
const STEP_MS = 5 * 60_000;
const MAX_BUFFER = 64 * 1024 * 1024;

export interface Change {
  write?: Record<string, string>;
  remove?: string[];
  /** Moved as-is: whether it reads as a rename is git's call, from the content. */
  move?: [from: string, to: string][];
}

export interface CommitSpec extends Change {
  on: string;
  by: Person;
  title: string;
  /** GitHub, on a web edit. Otherwise the author commits their own work. */
  committer?: Person;
  /** An exact instant (ISO 8601), for the rules that read the clock. */
  at?: string;
}

export interface MergeSpec {
  into: string;
  from: string | string[];
  by: Person;
  message: string;
  committer?: Person;
  /** `ours` records the merge and keeps nothing of the other side. */
  strategy?: "ours";
  /** Written after the merge is staged and before it is committed: a
   *  conflict's resolution, or content no side of the merge contains. */
  amend?: Change;
  at?: string;
}

interface Signature {
  author: Person;
  committer: Person;
  when: string;
}

export class Git {
  private now = START;
  private current = "main";
  /** fast-import moved the checked-out branch; index and worktree lag behind it. */
  private stale = false;

  private constructor(readonly dir: string) {}

  static async open(): Promise<Git> {
    const git = new Git(await mkdtemp(join(tmpdir(), "commander-scenario-")));
    await git.run(["init", "--quiet", "--initial-branch=main"]);
    return git;
  }

  close(): Promise<void> {
    return rm(this.dir, { recursive: true, force: true });
  }

  /** This repository's "now", in milliseconds — what the reconciler measures back from. */
  get clock(): number {
    return this.now;
  }

  run(args: string[], sign?: Signature): Promise<string> {
    return this.spawn(args, { sign: sign ?? this.sign(SARA) });
  }

  /** A command that reads its standard input. */
  feed(args: string[], input: string): Promise<string> {
    return this.spawn(args, { sign: this.sign(SARA), input });
  }

  /** A branch head, from its loose ref file when there is one — cheaper than a process. */
  async resolve(ref: string): Promise<string> {
    return (await this.tip(ref === "HEAD" ? this.current : ref)) ?? (await this.run(["rev-parse", ref])).trim();
  }

  async createBranch(name: string, from: string): Promise<void> {
    await this.run(["branch", name, from]);
  }

  async commit(spec: CommitSpec): Promise<string> {
    const [sha] = await this.commits([spec]);
    return sha ?? "";
  }

  /** Consecutive commits on one branch, written in a single fast-import. */
  async commits(specs: CommitSpec[]): Promise<string[]> {
    const branch = specs[0]?.on ?? "";
    if (!branch || specs.some((spec) => spec.on !== branch)) throw new Error("commits(): one branch per run");

    const marks = join(this.dir, ".git", "scenario-marks");
    const stream = this.stream(specs, await this.tip(branch));
    await this.feed(["fast-import", "--quiet", `--export-marks=${marks}`], stream);
    if (branch === this.current) this.stale = true;
    return readMarks(await readFile(marks, "utf8"));
  }

  async merge(spec: MergeSpec): Promise<string> {
    await this.checkout(spec.into);
    const sign = this.tick(spec.by, spec.committer, spec.at);
    const heads = Array.isArray(spec.from) ? spec.from : [spec.from];
    const strategy = spec.strategy ? ["--strategy", spec.strategy] : [];
    const staged = this.run(["merge", "--no-ff", "--no-commit", ...strategy, ...heads], sign);

    // A conflict stops the merge half-way. With a resolution supplied that is the
    // story working as written; without one, the conflict is a bug in the story.
    await (spec.amend ? staged.catch(expectConflict) : staged);
    if (spec.amend) await this.apply(spec.amend);

    await this.run(["add", "--all"]);
    await this.run(["commit", "--quiet", "--message", spec.message], sign);
    return this.resolve("HEAD");
  }

  async squash(spec: { into: string; from: string; by: Person; committer: Person; message: string }) {
    await this.checkout(spec.into);
    const sign = this.tick(spec.by, spec.committer);
    await this.run(["merge", "--squash", "--quiet", spec.from], sign);
    await this.run(["commit", "--quiet", "--message", spec.message], sign);
    return this.resolve("HEAD");
  }

  /** Replays commits one by one. Git keeps each original author; `committer` signs. */
  async cherryPick(spec: { onto: string; shas: string[]; committer: Person }): Promise<string> {
    await this.checkout(spec.onto);
    for (const sha of spec.shas) {
      await this.run(["cherry-pick", "--allow-empty", sha], this.tick(spec.committer));
    }
    return this.resolve("HEAD");
  }

  async rebase(spec: { branch: string; onto: string; by: Person }): Promise<string> {
    await this.checkout(spec.branch);
    await this.run(["rebase", "--quiet", spec.onto], this.tick(spec.by));
    return this.resolve("HEAD");
  }

  /** `git revert -m 1`: undoes everything a merge brought, as one new commit. */
  async revertMerge(spec: { on: string; merge: string; by: Person }): Promise<string> {
    await this.checkout(spec.on);
    await this.run(["revert", "--no-edit", "-m", "1", spec.merge], this.tick(spec.by));
    return this.resolve("HEAD");
  }

  /** Moves a branch to any commit, forward or back — what precedes a force push. */
  async reset(spec: { branch: string; to: string }): Promise<void> {
    await this.checkout(spec.branch);
    await this.run(["reset", "--hard", "--quiet", spec.to]);
  }

  /** Commits reachable from `head` and not from `base`, oldest first. */
  async between(base: string, head: string): Promise<string[]> {
    const out = await this.run(["rev-list", "--reverse", "--topo-order", head, `^${base}`]);
    return out.split("\n").filter(Boolean);
  }

  private spawn(args: string[], options: { sign: Signature; input?: string }): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = environment(this.dir, options.sign);
      const child = execFile("git", args, { cwd: this.dir, env, maxBuffer: MAX_BUFFER }, (error, stdout) =>
        error ? reject(Object.assign(error, { stdout })) : resolve(stdout),
      );
      // Most commands never read their input, and under load one can exit before
      // it is written: the closed pipe then raises EPIPE here, which failed
      // unrelated scenarios at random. The command's own result still arrives
      // through the callback above, so that is where a real failure is reported.
      child.stdin?.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code !== "EPIPE") reject(error);
      });
      child.stdin?.end(options.input ?? "");
    });
  }

  /** A branch's head, or null for a branch that does not exist yet. */
  private async tip(branch: string): Promise<string | null> {
    const loose = await readFile(join(this.dir, ".git", "refs", "heads", branch), "utf8").catch(
      // Not a loose ref — packed, or not a branch at all. git itself will know.
      () => "",
    );
    if (loose.trim()) return loose.trim();
    const out = await this.run(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).catch(
      // Exit status 1 is git saying the branch does not exist, which is an answer.
      () => "",
    );
    return out.trim() || null;
  }

  /** The fast-import commands for a run of commits, the first one on `parent`. */
  private stream(specs: CommitSpec[], parent: string | null): string {
    return specs
      .map((spec, index) => {
        const sign = this.tick(spec.by, spec.committer, spec.at);
        const from = index === 0 ? parent : `:${index}`;
        return [
          `commit refs/heads/${spec.on}`,
          `mark :${index + 1}`,
          `author ${sign.author.name} <${sign.author.email}> ${sign.when}`,
          `committer ${sign.committer.name} <${sign.committer.email}> ${sign.when}`,
          data(`${spec.title}\n`),
          ...(from ? [`from ${from}`] : []),
          ...(spec.move ?? []).map(([source, target]) => `R ${source} ${target}`),
          ...(spec.remove ?? []).map((path) => `D ${path}`),
          ...Object.entries(spec.write ?? {}).map(([path, text]) => `M 100644 inline ${path}\n${data(text)}`),
          "",
        ].join("\n");
      })
      .join("\n");
  }

  private async checkout(branch: string): Promise<void> {
    if (this.stale) {
      await this.run(["reset", "--hard", "--quiet"]);
      this.stale = false;
    }
    if (branch === this.current) return;
    await this.run(["switch", "--quiet", branch]);
    this.current = branch;
  }

  private async apply(change: Change): Promise<void> {
    for (const [path, content] of Object.entries(change.write ?? {})) {
      await mkdir(dirname(join(this.dir, path)), { recursive: true });
      await writeFile(join(this.dir, path), content);
    }
    for (const path of change.remove ?? []) await unlink(join(this.dir, path));
    for (const [from, to] of change.move ?? []) {
      await mkdir(dirname(join(this.dir, to)), { recursive: true });
      await rename(join(this.dir, from), join(this.dir, to));
    }
  }

  /** Advances the clock (or sets it, for an exact instant) and signs with it. */
  private tick(author: Person, committer?: Person, at?: string): Signature {
    this.now = at ? Date.parse(at) : this.now + STEP_MS;
    return this.sign(author, committer);
  }

  private sign(author: Person, committer?: Person): Signature {
    return { author, committer: committer ?? author, when: `${Math.floor(this.now / 1000)} +0300` };
  }
}

/** fast-import's `data` command: an exact byte count, then the bytes. */
function data(text: string): string {
  return `data ${Buffer.byteLength(text)}\n${text}`;
}

/** `--export-marks` output, `:<n> <sha>` per line, in mark order. */
function readMarks(text: string): string[] {
  return text
    .split("\n")
    .map((line) => /^:(\d+) ([0-9a-f]{40})$/.exec(line))
    .filter((match): match is RegExpExecArray => match !== null)
    .sort((a, b) => Number(a[1]) - Number(b[1]))
    .map((match) => match[2] ?? "");
}

/** A merge that stopped on a conflict is expected; any other failure is not. */
function expectConflict(error: unknown): void {
  const output = error instanceof Error && "stdout" in error ? String(error.stdout) : "";
  if (!output.includes("CONFLICT")) throw error;
}

function environment(home: string, sign: Signature): NodeJS.ProcessEnv {
  return {
    PATH: process.env["PATH"] ?? "",
    HOME: home,
    LC_ALL: "C",
    GIT_CONFIG_GLOBAL: devNull,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_EDITOR: "true",
    GIT_MERGE_AUTOEDIT: "no",
    GIT_AUTHOR_NAME: sign.author.name,
    GIT_AUTHOR_EMAIL: sign.author.email,
    GIT_AUTHOR_DATE: sign.when,
    GIT_COMMITTER_NAME: sign.committer.name,
    GIT_COMMITTER_EMAIL: sign.committer.email,
    GIT_COMMITTER_DATE: sign.when,
  };
}
