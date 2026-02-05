import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { PublicOnlyRoute } from "./auth/PublicOnlyRoute";
import AuthGate from "./auth/AuthGate";
import { AppLayout } from "./components/layout";
import Dashboard from "./pages/Dashboard";
import WeeklyFocusPage from "./pages/WeeklyFocusPage";
import DecisionsPage from "./pages/DecisionsPage";
import KeywordsPage from "./pages/KeywordsPage";
import ProductsPage from "./pages/ProductsPage";
import SignalsPage from "./pages/SignalsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes - only for non-authenticated users */}
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <AuthGate />
                </PublicOnlyRoute>
              }
            />

            {/* Protected routes with layout */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="weekly-focus" element={<WeeklyFocusPage />} />
              <Route path="seo-focus" element={<WeeklyFocusPage />} />
              <Route path="decisions" element={<DecisionsPage />} />
              <Route path="decision-drafts" element={<DecisionsPage defaultView="drafts" />} />
              <Route path="keywords" element={<KeywordsPage />} />
              <Route path="signals" element={<SignalsPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
