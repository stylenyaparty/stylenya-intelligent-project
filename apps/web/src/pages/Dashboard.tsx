import { Link, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Dashboard</h1>
          <div style={{ marginTop: 6, opacity: 0.8 }}>
            <b>Email:</b> {user?.email} &nbsp; | &nbsp; <b>Role:</b> {user?.role}
          </div>
        </div>
        <button onClick={logout}>Logout</button>
      </div>

      <hr style={{ margin: "16px 0" }} />

      <nav style={{ display: "flex", gap: 12 }}>
        <Link to="/dashboard/weekly-focus">Weekly Focus</Link>
        <Link to="/dashboard/decisions">Decisions</Link>
      </nav>

      <div style={{ marginTop: 16 }}>
        <Outlet />
      </div>
    </div>
  );
}
