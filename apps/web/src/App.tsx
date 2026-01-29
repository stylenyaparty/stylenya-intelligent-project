import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { PublicOnlyRoute } from "./auth/PublicOnlyRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import WeeklyFocusPage from "./pages/WeeklyFocusPage";
import DecisionsPage from "./pages/DecisionsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Rutas públicas SOLO para no autenticados */}
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            }
          />

          {/* Rutas protegidas */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          >
            {/* default */}
            <Route index element={<Navigate to="weekly-focus" replace />} />
            <Route path="weekly-focus" element={<WeeklyFocusPage />} />
            <Route path="decisions" element={<DecisionsPage />} />
          </Route>

          {/* redirect root */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
