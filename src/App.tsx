import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { RolePreviewProvider } from "@/hooks/useRolePreview";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import PublicLayout from "@/components/public/PublicLayout";
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

// Public pages
import Landing from "./pages/public/Landing";
import About from "./pages/public/About";
import CustomHats from "./pages/public/CustomHats";
import DTFTransfers from "./pages/public/DTFTransfers";
import EmbroideryService from "./pages/public/EmbroideryService";
import ScreenPrintService from "./pages/public/ScreenPrintService";

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
                {/* Public pages */}
                <Route path="/" element={<PublicLayout><Landing /></PublicLayout>} />
                <Route path="/about" element={<PublicLayout><About /></PublicLayout>} />
                <Route path="/custom-hats" element={<PublicLayout><CustomHats /></PublicLayout>} />
                <Route path="/dtf-transfers" element={<PublicLayout><DTFTransfers /></PublicLayout>} />
                <Route path="/embroidery-service" element={<PublicLayout><EmbroideryService /></PublicLayout>} />
                <Route path="/screen-print-service" element={<PublicLayout><ScreenPrintService /></PublicLayout>} />

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
