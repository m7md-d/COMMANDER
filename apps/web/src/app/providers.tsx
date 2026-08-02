import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { BrowserRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { queryClient } from "./query-client";
import { I18nProvider } from "@/shared/i18n/I18nProvider";
import { ThemeProvider } from "@/shared/hooks/useTheme";
import { ToastProvider } from "@/shared/hooks/useToast";

/**
 * Provider order matters: I18n and Theme sit outside Toast because a toast
 * renders translated text, and outside Query because an error boundary may
 * need to render a message before any data exists.
 *
 * MotionConfig is not optional decoration. The `!important` block in base.css
 * neutralises CSS transitions under `prefers-reduced-motion`, but it cannot
 * touch animations framer-motion drives from JavaScript — `reducedMotion="user"`
 * is what makes the setting apply to those too.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <I18nProvider>
          <ToastProvider>
            <QueryClientProvider client={queryClient}>
              <BrowserRouter>{children}</BrowserRouter>
            </QueryClientProvider>
          </ToastProvider>
        </I18nProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
