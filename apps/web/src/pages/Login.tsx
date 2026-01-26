import { useState } from "react";
import { useAuth } from "../auth/useAuth";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();

  const [email, setEmail] = useState("admin@stylenya.com");
  const [password, setPassword] = useState("Admin123!Admin123!");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      nav("/", { replace: true });
    } catch (e: any) {
      setError(e?.message ?? "Login failed");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "80px auto" }}>
      <h1>Login</h1>
      <form onSubmit={onSubmit}>
        <div style={{ display: "grid", gap: 12 }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
          <button type="submit">Sign in</button>
          {error && <p>{error}</p>}
        </div>
      </form>
    </div>
  );
}
