import type { ReactNode } from "react";

interface ArticleProps {
  title: string;
  /** The claim, in one or two sentences. Anything longer is two articles. */
  body: string;
  children?: ReactNode;
}

/**
 * One numbered point of the manual: a stencilled heading, the claim, then the
 * evidence if there is any.
 *
 * The shape is deliberate — a manual read by someone with a problem is scanned
 * for the heading that matches it, not read from the top. So every article is
 * findable alone, and none of them depends on having read the one above.
 */
export function Article({ title, body, children }: ArticleProps) {
  return (
    <article className="article">
      <h3 className="article-title">{title}</h3>
      <p className="article-body">{body}</p>
      {children}
    </article>
  );
}
