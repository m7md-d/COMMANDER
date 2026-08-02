/**
 * Reading a blob's numbers. One pass, three measurements, no parser.
 *
 * The bar these have to clear is not "usually right" — a wrong number here
 * becomes a violation recorded against a person. So each measurement is either
 * exactly computable from the bytes or it is **not taken**, and the two that
 * cannot be computed exactly are not attempted at all: longest *function* and
 * true nesting depth need a real parser per language, and a parser that is
 * approximately right is a machine for producing false accusations.
 *
 * What is here instead is named after what it actually measures. `braceDepth`
 * is brace nesting, not "complexity"; `longestLine` is characters, not
 * "readability". Naming a measurement after the thing you wish it proved is how
 * a metric ends up defended rather than trusted.
 */

export interface BlobMeasurement {
  lines: number;
  /**
   * Deepest brace nesting, or null when we could not read the file confidently.
   *
   * Null is not a failure path bolted on — it is the point. See `scanBraces`.
   */
  braceDepth: number | null;
  /** Characters in the longest line. Exact for any text, in any language. */
  longestLine: number;
}

/** Lines the way `wc -l` counts them, plus a final line with no newline after it. */
export function countLines(content: string): number {
  if (content.length === 0) return 0;
  // A file ending in a newline has no line after it; one that does not still has
  // a final line, and dropping it would under-count every such file by one.
  return content.split("\n").length - (content.endsWith("\n") ? 1 : 0);
}

export function longestLineLength(content: string): number {
  let longest = 0;
  let start = 0;

  for (let index = 0; index <= content.length; index += 1) {
    if (index === content.length || content[index] === "\n") {
      // Trailing \r on CRLF files is not a character anybody sees.
      const end = index > start && content[index - 1] === "\r" ? index - 1 : index;
      longest = Math.max(longest, end - start);
      start = index + 1;
    }
  }

  return longest;
}

type Mode = "code" | "line-comment" | "block-comment" | "single" | "double" | "template";

/** Quote characters and the string mode each one opens. */
const QUOTES: Record<string, Mode> = { "'": "single", '"': "double", "`": "template" };

/**
 * Deepest `{` nesting, ignoring braces inside comments and strings.
 *
 * **The balance check is the whole design.** Every construct this scanner does
 * not model — a regular-expression literal holding an unmatched brace, a
 * language whose blocks are not braces at all — leaves the depth non-zero at the
 * end of the file. That is treated as "we could not read this", and null is
 * returned. So the scanner does not need to be complete; it needs to *notice*
 * when it was wrong, and a construct it misreads costs a measurement rather than
 * producing a confident wrong one.
 *
 * Template interpolations are read as part of the string. Braces inside `${…}`
 * are expressions rather than blocks, so skipping them under-counts nothing that
 * matters and can never over-count.
 */
export function scanBraces(content: string): number | null {
  let mode: Mode = "code";
  let depth = 0;
  let deepest = 0;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index] ?? "";
    const next = content[index + 1] ?? "";

    if (mode === "code") {
      if (char === "/" && next === "/") mode = "line-comment";
      else if (char === "/" && next === "*") mode = "block-comment";
      else if (QUOTES[char]) mode = QUOTES[char] as Mode;
      else if (char === "{") deepest = Math.max(deepest, (depth += 1));
      else if (char === "}") depth -= 1;
      // A closing brace with nothing open means we misread something earlier.
      if (depth < 0) return null;
      continue;
    }

    if (mode === "line-comment") {
      if (char === "\n") mode = "code";
      continue;
    }

    if (mode === "block-comment") {
      if (char === "*" && next === "/") {
        mode = "code";
        index += 1;
      }
      continue;
    }

    // Inside a string: an escape consumes the next character whatever it is, so
    // a quote after a backslash does not close anything.
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "\n" && mode !== "template") {
      // An unterminated single-line string means our reading has gone wrong.
      return null;
    }
    if (QUOTES[char] === mode) mode = "code";
  }

  return mode === "code" && depth === 0 ? deepest : null;
}

export function measureContent(content: string): BlobMeasurement {
  return {
    lines: countLines(content),
    braceDepth: scanBraces(content),
    longestLine: longestLineLength(content),
  };
}
