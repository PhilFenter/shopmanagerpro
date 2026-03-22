import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { RolePreviewProvider } from "@/hooks/useRolePreview";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import Embroidery from "./pages/Embroidery";
import ScreenPrint from "./pages/ScreenPrint";
import DTF from "./pages/DTF";
import Leather from "./pages/Leather";
import Settings from "./pages/Settings";
import Team from "./pages/Team";
import Financials from "./pages/Financials";
import Integrations from "./pages/Integrations";

import NotFound from "./pages/NotFound";
import ActionItems from "./pages/ActionItems";
import Customers from "./pages/Customers";
import Messages from "./pages/Messages";
import Install from "./pages/Install";
import ArtworkLibrary from "./pages/ArtworkLibrary";
import Inventory from "./pages/Inventory";
import Quotes from "./pages/Quotes";

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
                <Route path="*" element={<NotFound />} />
              </Routes>
            </RolePreviewProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
