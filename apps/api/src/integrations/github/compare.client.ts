/**
 * What a push changed between its two ends, as one diff — what the code review
 * reads (0009 §7). Returns Results, never throws (§6).
 */

import { request, type CommitDetail, type Result } from "./github.client.js";
import { toCompareDetail, type RawCompareFiles } from "./commit.mapper.js";

export async function fetchCompareDiff(input: {
  installationId: string;
  repoFullName: string;
  base: string;
  head: string;
}): Promise<Result<CommitDetail>> {
  const { installationId, repoFullName, base, head } = input;
  const result = await request<RawCompareFiles>(installationId, `/repos/${repoFullName}/compare/${base}...${head}`);
  return result.ok ? { ok: true, data: toCompareDetail(result.data, head) } : result;
}
