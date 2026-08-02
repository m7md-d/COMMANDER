import { Link, Outlet, useLocation } from "react-router-dom";
import { PageTransition } from "@/shared/components/PageTransition";
import { useI18n } from "@/shared/i18n/I18nProvider";
import { useRouteFocus } from "@/shared/hooks/useRouteFocus";
import { Button } from "@/shared/components/Button";
import { Menu, type MenuSection } from "@/shared/components/Menu";
import { BackButton } from "@/shared/components/BackButton";
import { Wordmark } from "@/shared/components/Wordmark";
import { SessionControls } from "./SessionControls";
import { NAV_GROUPS } from "./nav-items";

/**
 * The shell is a bar and a stage. Navigation is a compact menu anchored to the
 * bar — never a rail that eats the width, never an overlay that covers the page.
 *
 * The bar carries the way back (a history arrow, not just the logo), the brand
 * as a link home, and the menu. Session settings live inside the menu, off the
 * bar, because they are touched rarely and were only cluttering it.
 */
export function AppLayout({ authenticated }: { authenticated: boolean }) {
  const { t } = useI18n();
  const location = useLocation();
  const contentRef = useRouteFocus();

  const sections: MenuSection[] = NAV_GROUPS.map((group) => ({
    key: group.key,
    label: t(`nav.group${group.key}`),
    links: group.items.map((item) => ({
      key: item.key,
      label: t(`nav.${item.key}`),
      to: item.to,
      end: item.end,
    })),
  }));

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t("nav.skipToContent")}
      </a>

      <header className="command-bar">
        {/* Home is the post; the arrow is one step back through history. */}
        {location.pathname !== "/" ? <BackButton /> : null}

        <Link to="/" className="command-bar-brand" aria-label={t("app.name")}>
          <Wordmark compact />
        </Link>

        <div className="spacer" />

        {authenticated ? (
          <Menu
            sections={sections}
            footer={
              <>
                <p className="stencil menu-footer-label">{t("nav.session")}</p>
                <SessionControls />
              </>
            }
            trigger={
              <Button variant="primary" aria-haspopup="menu">
                {t("nav.menu")}
              </Button>
            }
          />
        ) : (
          // A link that looks like the primary action: sign-in is a navigation,
          // not a mutation, so it is an anchor wearing the button's classes.
          <Link to="/login" className="btn btn-primary">
            {t("auth.signIn")}
          </Link>
        )}
      </header>

      <div className="wire" aria-hidden="true" />

      <main className="app-main" id="main">
        {/* Focus lands here on every navigation so the change is announced. */}
        <div className="app-content" ref={contentRef} tabIndex={-1}>
          <PageTransition routeKey={location.pathname}>
            <Outlet />
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
