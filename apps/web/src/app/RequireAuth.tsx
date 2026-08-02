import { Navigate, Outlet } from "react-router-dom";

/**
 * Gate for the working pages. The headquarters itself is public — you may look
 * at the post with its screens dark — but everything that reads or writes real
 * data sits behind this, and sends an unauthenticated visitor to sign in.
 */
export function RequireAuth({ authenticated }: { authenticated: boolean }) {
  return authenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
