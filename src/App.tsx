import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
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
import NotFound from "./pages/NotFound";

function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route
                path="/"
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
