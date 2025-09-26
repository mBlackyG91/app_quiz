// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function onLogin() {
    setLoading(true);
    setErr(null);
    const supabase = createBrowser();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div style={{ width: 360, display: "grid", gap: 10 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22 }}>Autentificare</h1>

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
        />

        <label>Parolă</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 6 }}
        />

        {err && <div style={{ color: "#dc2626", fontSize: 14 }}>{err}</div>}

        <button
          onClick={onLogin}
          disabled={loading}
          style={{
            padding: 10,
            borderRadius: 8,
            background: "#111",
            color: "#fff",
          }}
        >
          {loading ? "..." : "Login"}
        </button>
      </div>
    </main>
  );
}
