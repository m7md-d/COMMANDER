import { Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "@/features/auth/hooks";
import { useTranslate } from "@/shared/i18n/I18nProvider";
import { useDocumentTitle } from "./useDocumentTitle";
import { AppLayout } from "./AppLayout";
import { RequireAuth } from "./RequireAuth";
import { LoginPage } from "@/pages/LoginPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { HeadquartersPage } from "@/pages/HeadquartersPage";
import { RepositoriesPage } from "@/pages/RepositoriesPage";
import { FrontPage } from "@/pages/FrontPage";
import { DossierPage } from "@/pages/DossierPage";
import { PromptsPage } from "@/pages/PromptsPage";
import { DeliveriesPage } from "@/pages/DeliveriesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SetupPage } from "@/pages/SetupPage";
import { ManualPage } from "@/pages/ManualPage";

/**
 * The headquarters is public; the work behind it is not.
 *
 * An unauthenticated visitor reaches the post and sees its screens go dark —
 * the data calls 401, which the CRTs render as "signal lost". Every other route
 * is wrapped in RequireAuth and bounces to /login. The shell therefore renders
 * before the session resolves, rather than flashing a login wall at everyone.
 */
export function AppRouter() {
  const t = useTranslate();
  const session = useSession();
  useDocumentTitle();

  if (session.isPending) {
    return <p className="empty-state">{t("state.loading")}</p>;
  }

  const authenticated = session.data?.authenticated ?? false;
  const configured = session.data?.configured ?? true;

  return (
    <Routes>
      <Route
        path="/login"
        element={authenticated ? <Navigate to="/" replace /> : <LoginPage configured={configured} />}
      />

      <Route element={<AppLayout authenticated={authenticated} />}>
        <Route index element={<HeadquartersPage />} />

        <Route element={<RequireAuth authenticated={authenticated} />}>
          <Route path="overview" element={<OverviewPage />} />
          <Route path="repositories" element={<RepositoriesPage />} />
          <Route path="repositories/:id" element={<FrontPage />} />
          <Route path="dossiers" element={<DossierPage />} />
          <Route path="prompts" element={<PromptsPage />} />

          {/* Enlistment and rules became sections of a front's file. Bookmarks
              land on the board, which is where a front is chosen anyway. */}
          <Route path="members" element={<Navigate to="/repositories" replace />} />
          <Route path="rules" element={<Navigate to="/repositories" replace />} />
          <Route path="deliveries" element={<DeliveriesPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="setup" element={<SetupPage />} />
          <Route path="manual" element={<Navigate to="/manual/path" replace />} />
          <Route path="manual/:section" element={<ManualPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
