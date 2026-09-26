/**
 * Who answers for what a push holds.
 *
 * A verdict is a charge and a person, and a right charge on the wrong person is
 * a wrong verdict. The policy these hold the code to: whoever pushed answers for
 * what the push did — landing on the trunk unreviewed, rewriting it, deleting
 * it, pushing a heap at once. Whoever wrote a commit answers for what the commit
 * holds: its message, its hour, what it did to a file. Whoever lands someone
 * else's crossing on the trunk shares it with its author — the catalog in
 * `checks.test.ts` holds those. When the evidence names nobody, nobody is
 * charged.
 */

import { LINA, SARA, type Person } from "./git.test.kit.js";
import { charged, runCatalog, type Scenario } from "./judge.test.kit.js";
import { modules, seed, type Story } from "./story.test.kit.js";

const FEATURE = "feature/export";

/** An address GitHub cannot tie to an account: a contractor, a laptop's default identity. */
const GUEST: Person = { login: "guest", name: "Guest Contributor", email: "guest@example.com" };

const edit = (stamp: string) => modules({ dir: "src/export", count: 2, stamp });

/** Seed; Sara's two commits on her branch — the first titled 'wip' — pushed to a branch this front does not watch. */
async function sarasBranch(story: Story) {
  await seed(story);
  await story.branch(FEATURE, "main");
  await story.commit({ on: FEATURE, by: SARA, title: "wip", write: edit("draft") });
  await story.commit({ on: FEATURE, by: SARA, title: "Export the ledger as CSV", write: edit("csv") });
  await story.push(FEATURE, SARA);
}

const scenarios: Scenario[] = [
  {
    id: "two-authors-one-pusher",
    title: "Lina's 'wip' and Sara's 'temp' on main, pushed together by Sara",
    story: async (story) => {
      await seed(story);
      await story.commit({ on: "main", by: LINA, title: "wip", write: edit("lina") });
      await story.commit({ on: "main", by: SARA, title: "temp", write: edit("sara") });
      await story.push("main", SARA);
    },
    expect: charged("direct_push@sara", "lazy_message@lina", "lazy_message@sara"),
  },
  {
    id: "commit-by-an-unlinked-author",
    title: "a 'wip' written under an address GitHub cannot tie to an account, pushed to main by Sara",
    story: async (story) => {
      await seed(story);
      await story.commit({ on: "main", by: GUEST, title: "wip", write: edit("guest") });
      await story.push("main", SARA);
    },
    expect: charged("direct_push@sara"),
  },
  {
    id: "contributors-branch-pushed-to-main-by-a-maintainer",
    title: "Lina pushes Sara's branch, 'wip' and all, straight to main, on a front that watches main only",
    front: { watch: ["main"] },
    story: async (story) => {
      await sarasBranch(story);
      await story.push(FEATURE, LINA, { to: "main" });
    },
    expect: charged("direct_push@lina", "lazy_message@sara"),
  },
  {
    id: "contributors-branch-pushed-by-a-maintainer-webhook-lost",
    title: "the same push, its webhook lost, recovered by the reconciler",
    front: { watch: ["main"] },
    story: async (story) => {
      await sarasBranch(story);
      await story.push(FEATURE, LINA, { to: "main", lost: true });
      story.reconcile();
    },
    expect: charged("direct_push@lina", "lazy_message@sara"),
    defect: {
      observed: charged("lazy_message@sara"),
      because:
        "The reconciler cannot know Lina pushed: git records that Sara wrote and committed these, and nothing about who pushed them. Her 'wip' is hers on either road; the direct push is charged to nobody. Grouped by author, as before, it was charged to Sara (reconciled-direct-push).",
    },
  },
];

runCatalog("Who answers", scenarios);
