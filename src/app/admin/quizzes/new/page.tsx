"use client";

import { useState } from "react";
import { createBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function NewQuiz() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const onSave = async () => {
    setLoading(true);
    setErr(null);
    const supabase = createBrowser();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErr("Nu ești autentificat.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("quizzes")
      .insert({
        title,
        description,
        is_published: isPublished,
        created_by: user.id,
      })
      .select("id")
      .single();

    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (data?.id) router.replace(`/admin/quizzes/${data.id}`);
  };

  return (
    <div style={{ padding: 24, maxWidth: 680 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>
        Chestionar nou
      </h1>

      <label>Titlu</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{
          padding: 8,
          border: "1px solid #ccc",
          borderRadius: 6,
          width: "100%",
        }}
      />

      <label style={{ marginTop: 12, display: "block" }}>Descriere</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        style={{
          padding: 8,
          border: "1px solid #ccc",
          borderRadius: 6,
          width: "100%",
        }}
      />

      <label
        style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}
      >
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
        />
        Publică
      </label>

      {err && <div style={{ color: "#dc2626", marginTop: 8 }}>{err}</div>}

      <button
        onClick={onSave}
        disabled={loading}
        style={{
          marginTop: 12,
          padding: "10px 14px",
          background: "#111",
          color: "#fff",
          borderRadius: 8,
        }}
      >
        {loading ? "..." : "Salvează"}
      </button>
    </div>
  );
}
