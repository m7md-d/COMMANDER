/**
 * Exact structural measurements, taken with the language's own parser.
 *
 * The earlier reasoning against a parser was against *writing* one: a homemade
 * approximation is a machine for false accusations. It was never an argument
 * against using a real one, and TypeScript's is already in this image — so the
 * two measurements the project's own constitution actually names (function
 * length, nesting depth) can be taken exactly rather than guessed at from
 * braces.
 *
 * What this buys beyond the brace scanner:
 *
 * - **JSX comes back into scope.** `className={…}` is an expression container,
 *   not a block, and an AST knows the difference where a brace counter cannot.
 * - **Function length at all.** No amount of brace counting finds where a
 *   function starts.
 * - **Object and type literals stop counting as nesting**, which they never were.
 *
 * Pure: text in, numbers out. No file system, no program, no type checking —
 * this reads syntax, and syntax is all it claims to read.
 */

import ts from "typescript";

export interface SyntaxReading {
  /** Lines spanned by the longest function, method, accessor or arrow body. */
  functionLines: number | null;
  /** Deepest nesting of real blocks — control flow, function and module bodies. */
  nestingDepth: number | null;
}

const UNREADABLE: SyntaxReading = { functionLines: null, nestingDepth: null };

/** What TypeScript should treat the file as, decided by its extension. */
function scriptKind(path: string): ts.ScriptKind | null {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".ts")) return ts.ScriptKind.TS;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.(js|mjs|cjs)$/.test(path)) return ts.ScriptKind.JS;
  return null;
}

/**
 * Blocks, and only blocks.
 *
 * An object literal, a type literal and a JSX expression are all braces and none
 * of them is nesting. Naming the node kinds is what separates this from counting
 * `{` — and it is the entire reason a `.tsx` file no longer scores two levels
 * deeper than its `.ts` twin for writing ordinary markup.
 */
function isBlock(node: ts.Node): boolean {
  return (
    ts.isBlock(node) ||
    ts.isModuleBlock(node) ||
    ts.isCaseBlock(node) ||
    // A class body is structure rather than control flow, but a method inside it
    // is genuinely one level in — leaving it out would rate every class method
    // as shallower than the same function written free-standing.
    ts.isClassDeclaration(node) ||
    ts.isClassExpression(node)
  );
}

function isFunctionLike(node: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/**
 * Reads one file, or declines to.
 *
 * A file with a syntax error is not measured. The parser recovers from damage
 * and would hand back a plausible tree, and a plausible tree is precisely what
 * must not become a number here — the same rule the brace scanner's balance
 * check enforces, applied at a level where it can actually be checked.
 */
export function readSyntax(path: string, content: string): SyntaxReading {
  const kind = scriptKind(path);
  if (kind === null) return UNREADABLE;

  const transpiled = ts.transpileModule(content, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.Latest, jsx: ts.JsxEmit.Preserve, allowJs: true },
  });
  if ((transpiled.diagnostics ?? []).length > 0) return UNREADABLE;

  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, false, kind);
  let deepest = 0;
  let longest = 0;

  const walk = (node: ts.Node, depth: number): void => {
    const next = isBlock(node) ? depth + 1 : depth;
    deepest = Math.max(deepest, next);

    if (isFunctionLike(node)) {
      const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line;
      const end = source.getLineAndCharacterOfPosition(node.getEnd()).line;
      longest = Math.max(longest, end - start + 1);
    }

    node.forEachChild((child) => walk(child, next));
  };

  source.forEachChild((node) => walk(node, 0));
  return { functionLines: longest, nestingDepth: deepest };
}
