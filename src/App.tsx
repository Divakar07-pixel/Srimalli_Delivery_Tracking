import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ToastProvider } from "@/hooks/useToast";
import { useThemeSync } from "@/hooks/useThemeSync";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { AdminShell } from "@/components/layout/AdminShell";

// Public pages load eagerly — this is the surface most visitors hit first,
// with no login, so it should be fast on a first load.
import { Landing } from "@/pages/public/Landing";
import { Track } from "@/pages/public/Track";
import { TrackDetail } from "@/pages/public/TrackDetail";

// Admin pages are code-split: only fetched once someone actually navigates
// into /admin, keeping the public bundle small.
const Login = lazy(() => import("@/pages/admin/Login").then((m) => ({ default: m.Login })));
const ForgotPassword = lazy(() => import("@/pages/admin/ForgotPassword").then((m) => ({ default: m.ForgotPassword })));
const ResetPassword = lazy(() => import("@/pages/admin/ResetPassword").then((m) => ({ default: m.ResetPassword })));
const Dashboard = lazy(() => import("@/pages/admin/Dashboard").then((m) => ({ default: m.Dashboard })));
const Orders = lazy(() => import("@/pages/admin/Orders").then((m) => ({ default: m.Orders })));
const OrderDetail = lazy(() => import("@/pages/admin/OrderDetail").then((m) => ({ default: m.OrderDetail })));
const AddOrder = lazy(() => import("@/pages/admin/AddOrder").then((m) => ({ default: m.AddOrder })));
const AdminSettings = lazy(() => import("@/pages/admin/Settings").then((m) => ({ default: m.AdminSettings })));

function AdminFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/** Restores the route saved by the GitHub Pages 404 fallback. */
function GitHubPagesRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const target = new URLSearchParams(location.search).get("redirect");
    if (target?.startsWith("/") && !target.startsWith("//")) {
      navigate(target, { replace: true });
    }
  }, [location.search, navigate]);

  return null;
}

function App() {
  // Public pages follow system theme by default; the admin shell re-syncs
  // to the saved preference once settings load (see AdminShell/Settings).
  useThemeSync("system");

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <GitHubPagesRedirect />
          <Routes>
            {/* Public */}
            <Route path="/" element={<Landing />} />
            <Route path="/track" element={<Track />} />
            <Route path="/track/:reference" element={<TrackDetail />} />

            {/* Admin auth */}
            <Route
              path="/admin/login"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <Login />
                </Suspense>
              }
            />
            <Route
              path="/admin/forgot-password"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <ForgotPassword />
                </Suspense>
              }
            />
            <Route
              path="/admin/reset-password"
              element={
                <Suspense fallback={<AdminFallback />}>
                  <ResetPassword />
                </Suspense>
              }
            />

            {/* Admin (protected) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AdminShell />}>
                <Route
                  path="/admin"
                  element={
                    <Suspense fallback={<AdminFallback />}>
                      <Dashboard />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/orders"
                  element={
                    <Suspense fallback={<AdminFallback />}>
                      <Orders />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/orders/new"
                  element={
                    <Suspense fallback={<AdminFallback />}>
                      <AddOrder />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/orders/:id"
                  element={
                    <Suspense fallback={<AdminFallback />}>
                      <OrderDetail />
                    </Suspense>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <Suspense fallback={<AdminFallback />}>
                      <AdminSettings />
                    </Suspense>
                  }
                />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
