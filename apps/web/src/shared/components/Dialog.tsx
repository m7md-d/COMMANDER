import type { ReactNode } from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { fadeVariants, riseVariants } from "@/shared/lib/motion";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Rendered under the title and wired to aria-describedby by Radix. */
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * The one wrapper around Radix's dialog (web CONSTITUTION §8): focus trap,
 * Escape, scroll lock, `aria-modal` and the labelling relationships come from
 * the primitive; every visual decision comes from our own classes.
 *
 * `forceMount` on the portal is what lets AnimatePresence run the exit
 * animation — without it Radix unmounts the tree the instant `open` flips and
 * there is nothing left to animate out.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <RadixDialog.Portal forceMount>
            <RadixDialog.Overlay asChild forceMount>
              <motion.div
                className="scrim"
                variants={fadeVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              />
            </RadixDialog.Overlay>

            <RadixDialog.Content asChild forceMount>
              <motion.div
                className="dialog"
                variants={riseVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <RadixDialog.Title className="dialog-title">{title}</RadixDialog.Title>
                {description ? (
                  <RadixDialog.Description className="hint">{description}</RadixDialog.Description>
                ) : null}
                {children}
                {footer ? <div className="dialog-footer">{footer}</div> : null}
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        ) : null}
      </AnimatePresence>
    </RadixDialog.Root>
  );
}
