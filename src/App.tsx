import { useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { RolePreviewProvider } from "@/hooks/useRolePreview";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Jobs = lazy(() => import("./pages/Jobs"));
const Embroidery = lazy(() => import("./pages/Embroidery"));
const ScreenPrint = lazy(() => import("./pages/ScreenPrint"));
const DTF = lazy(() => import("./pages/DTF"));
const Leather = lazy(() => import("./pages/Leather"));
const Settings = lazy(() => import("./pages/Settings"));
const Team = lazy(() => import("./pages/Team"));
const Financials = lazy(() => import("./pages/Financials"));
const Integrations = lazy(() => import("./pages/Integrations"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ActionItems = lazy(() => import("./pages/ActionItems"));
const Customers = lazy(() => import("./pages/Customers"));
const Messages = lazy(() => import("./pages/Messages"));
const Install = lazy(() => import("./pages/Install"));
const ArtworkLibrary = lazy(() => import("./pages/ArtworkLibrary"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Quotes = lazy(() => import("./pages/Quotes"));
const Knowledge = lazy(() => import("./pages/Knowledge"));
const QuoteApproval = lazy(() => import("./pages/QuoteApproval"));

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
                <Route path="/install" element={<Install />} />
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
