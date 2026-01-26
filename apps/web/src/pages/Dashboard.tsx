import { useAuth } from "../auth/useAuth";

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p><b>Email:</b> {user?.email}</p>
      <p><b>Role:</b> {user?.role}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
