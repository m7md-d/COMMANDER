import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useTranslate } from "@/shared/i18n/I18nProvider";

/** pathname → the page's own title key. A new route is one line here. */
const ROUTE_TITLES: Record<string, string> = {
  "/": "app.name",
  "/login": "auth.signIn",
  "/overview": "overview.title",
  "/repositories": "repos.title",
  "/dossiers": "dossier.title",
  "/prompts": "prompt.title",
  "/deliveries": "delivery.title",
  "/settings": "settings.title",
  "/setup": "setup.title",
};

/**
 * Sets the document title per route (docs/UI-AUDIT.md §13). A ten-page panel had
 * ten identical browser tabs and a history with no landmarks; now each entry
 * reads "<page> — COMMANDER". Centralised here, not per page, so the title
 * changes exactly when the location does and a new route costs one line.
 */
export function useDocumentTitle(): void {
  const t = useTranslate();
  const { pathname } = useLocation();

  useEffect(() => {
    const brand = t("app.brand");
    // A front's file is the one route carrying an id. It is titled by what it
    // is rather than by which one, because the repository name lives in a query
    // this hook deliberately does not subscribe to.
    const key = pathname.startsWith("/repositories/")
      ? "front.designation"
      : pathname.startsWith("/manual")
        ? "manual.title"
        : ROUTE_TITLES[pathname];
    document.title = key ? `${t(key)} — ${brand}` : brand;
  }, [pathname, t]);
}
