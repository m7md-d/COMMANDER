import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { pageVariants } from "@/shared/lib/motion";

interface PageTransitionProps {
  /** Changing this remounts the child, which is what replays the entrance. */
  routeKey: string;
  children: ReactNode;
}

/**
 * The entrance a page makes when the route changes.
 *
 * Lives here rather than in the layout so framer-motion stays inside the design
 * system (apps/web/CONSTITUTION.md §8): swapping the animation library must be a
 * change to one folder, and a `motion.div` in `app/` was the one place that
 * would have been missed.
 */
export function PageTransition({ routeKey, children }: PageTransitionProps) {
  return (
    <motion.div key={routeKey} variants={pageVariants} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}
