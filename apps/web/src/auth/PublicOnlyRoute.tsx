import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AuthContext } from "./AuthContext";

export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) return <div style={{ padding: 16 }}>Loading...</div>;
  if (user) return <Navigate to="/" replace />;

  return <>{children}</>;
}
