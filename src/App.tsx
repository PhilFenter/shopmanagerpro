import { useState, lazy, Suspense, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { RolePreviewProvider } from "@/hooks/useRolePreview";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";

// Auto-reload once when a dynamic import fails (stale bundle after redeploy).
const RELOAD_KEY = "lovable:chunk-reloaded";
function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(() =>
    factory().catch((err) => {
      const msg = String(err?.message || err);
      const isChunkError =
        /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk|Load failed/i.test(
          msg
        );
      if (isChunkError && typeof window !== "undefined") {
        try {
          if (!sessionStorage.getItem(RELOAD_KEY)) {
            sessionStorage.setItem(RELOAD_KEY, "1");
            window.location.reload();
            return new Promise<{ default: T }>(() => {});
          }
        } catch {
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    })
  );
}

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    try {
      sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      // ignore
    }
  });
}

const Auth = lazyWithReload(() => import("./pages/Auth"));
const Dashboard = lazyWithReload(() => import("./pages/Dashboard"));
const Jobs = lazyWithReload(() => import("./pages/Jobs"));
const Embroidery = lazyWithReload(() => import("./pages/Embroidery"));
const ScreenPrint = lazyWithReload(() => import("./pages/ScreenPrint"));
const DTF = lazyWithReload(() => import("./pages/DTF"));
const Leather = lazyWithReload(() => import("./pages/Leather"));
const Settings = lazyWithReload(() => import("./pages/Settings"));
const Team = lazyWithReload(() => import("./pages/Team"));
const Financials = lazyWithReload(() => import("./pages/Financials"));
const Integrations = lazyWithReload(() => import("./pages/Integrations"));
const NotFound = lazyWithReload(() => import("./pages/NotFound"));
const ActionItems = lazyWithReload(() => import("./pages/ActionItems"));
const Customers = lazyWithReload(() => import("./pages/Customers"));
const Messages = lazyWithReload(() => import("./pages/Messages"));
const Install = lazyWithReload(() => import("./pages/Install"));
const ArtworkLibrary = lazyWithReload(() => import("./pages/ArtworkLibrary"));
const Inventory = lazyWithReload(() => import("./pages/Inventory"));
const Quotes = lazyWithReload(() => import("./pages/Quotes"));
const Knowledge = lazyWithReload(() => import("./pages/Knowledge"));
const Training = lazyWithReload(() => import("./pages/Training"));
const Skills = lazyWithReload(() => import("./pages/Skills"));
const QuoteApproval = lazyWithReload(() => import("./pages/QuoteApproval"));
const QuoteDetail = lazyWithReload(() => import("./pages/QuoteDetail"));
const PurchaseOrders = lazyWithReload(() => import("./pages/PurchaseOrders"));
const Handoffs = lazyWithReload(() => import("./pages/Handoffs"));

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <RolePreviewProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Root redirects to dashboard (auth guard will send to /auth if not logged in) */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />

                  {/* Auth */}
                  <Route path="/auth" element={<Auth />} />

                  {/* Protected app pages */}
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Dashboard />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/jobs"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Jobs />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/jobs/:id"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Jobs />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/embroidery"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Embroidery />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/screen-print"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ScreenPrint />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dtf"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <DTF />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/leather"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Leather />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Settings />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/team"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Team />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/financials"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Financials />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/integrations"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Integrations />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/action-items"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ActionItems />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/customers"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Customers />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/messages"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Messages />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/artwork"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <ArtworkLibrary />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/inventory"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Inventory />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/quotes"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Quotes />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/quotes/:id"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <QuoteDetail />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/purchase-orders"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <PurchaseOrders />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/handoffs"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Handoffs />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/install" element={<Install />} />
                  <Route path="/quote/approve/:token" element={<QuoteApproval />} />
                  <Route
                    path="/knowledge"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Knowledge />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/training"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Training />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/skills"
                    element={
                      <ProtectedRoute>
                        <AppLayout>
                          <Skills />
                        </AppLayout>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </RolePreviewProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
