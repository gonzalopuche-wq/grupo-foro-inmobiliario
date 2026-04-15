"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";

interface Category { id: string; name: string; slug: string; description: string; }
interface Tag { id: string; name: string; slug: string; }
interface Author { id: string; nombre: string; apellido: string; matricula: string | null; }
interface Topic {
  id: string; title: string; body: string; is_urgent: boolean; is_pinned: boolean;
  is_locked: boolean; status: string; accepted_reply_id: string | null;
  view_count: number; replies_count: number; last_activity_at: string; created_at: string;
  category_id: string; author_id: string;
  forum_categories?: { name: string; slug: string };
  perfiles?: Author;
  forum_topic_tags?: { forum_tags: Tag }[];
}
interface Reply {
  id: string; topic_id: string; author_id: string; body: string;
  is_accepted: boolean; is_deleted: boolean; created_at: string;
  perfiles?: Author;
  _voteCount?: number; _myVote?: number;
}

type Vista = "lista" | "detalle" | "nuevo";

const STATUS_LABEL: Record<string, string> = { open: "Abierto", resolved: "Resuelto", archived: "Archivado" };
const STATUS_COLOR: Record<string, string> = { open: "#22c55e", resolved: "#60a5fa", archived: "#6b7280" };

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
};

const initials = (p?: Author) => p ? `${p.nombre?.charAt(0) ?? ""}${p.apellido?.charAt(0) ?? ""}`.toUpperCase() : "?";
const fullName = (p?: Author) => p ? `${p.apellido ?? ""}, ${p.nombre ?? ""}` : "—";

export default function ForoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>("lista");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [replyLoading, setReplyLoading] = useState(false);

  // Filtros
  const [catFilter, setCatFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [search, setSearch] = useState("");

  // Nuevo tema
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [nCat, setNCat] = useState("");
  const [nTags, setNTags] = useState<string[]>([]);
  const [nUrgent, setNUrgent] = useState(false);
  const [nError, setNError] = useState("");
  const [nLoading, setNLoading] = useState(false);

  // Respuesta
  const [replyBody, setReplyBody] = useState("");

  // Notificaciones
  const [notifCount, setNotifCount] = useState(0);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      await Promise.all([loadCategories(), loadTags(), loadTopics(), loadSaved(data.user.id), loadNotifCount(data.user.id)]);
      setLoading(false);
    };
    init();
  }, []);

  const loadCategories = async () => {
    const { data } = await supabase.from("forum_categories").select("*").eq("is_active", true).order("sort_order");
    setCategories(data ?? []);
  };

  const loadTags = async () => {
    const { data } = await supabase.from("forum_tags").select("*").order("name");
    setTags(data ?? []);
  };

  const loadTopics = async (opts?: { cat?: string; status?: string; urgent?: boolean; q?: string }) => {
    setLoading(true);
    let q = supabase.from("forum_topics")
      .select("*, forum_categories(name,slug), perfiles(nombre,apellido,matricula), forum_topic_tags(forum_tags(id,name,slug))")
      .order("is_pinned", { ascending: false })
      .order("last_activity_at", { ascending: false });

    const cat = opts?.cat ?? catFilter;
    const st = opts?.status ?? statusFilter;
    const urg = opts?.urgent ?? urgentOnly;
    const sq = opts?.q ?? search;

    if (cat !== "todas") {
      const found = categories.find(c => c.id === cat || c.slug === cat);
      if (found) q = q.eq("category_id", found.id);
    }
    if (st !== "todas") q = q.eq("status", st);
    if (urg) q = q.eq("is_urgent", true);

    const { data } = await q;
    let result = (data as unknown as Topic[]) ?? [];

    if (sq.trim()) {
      const lower = sq.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.body.toLowerCase().includes(lower)
      );
    }

    setTopics(result);
    setLoading(false);
  };

  const loadSaved = async (uid: string) => {
    const { data } = await supabase.from("forum_saved_topics").select("topic_id").eq("user_id", uid);
    setSavedIds(new Set((data ?? []).map((r: any) => r.topic_id)));
  };

  const loadNotifCount = async (uid: string) => {
    const { count } = await supabase.from("forum_notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("is_read", false);
    setNotifCount(count ?? 0);
  };

  const openTopic = async (t: Topic) => {
    setTopic(t);
    setVista("detalle");
    setReplyBody("");
    // Incrementar view count
    await supabase.from("forum_topics").update({ view_count: t.view_count + 1 }).eq("id", t.id);
    // Cargar respuestas
    const { data } = await supabase.from("forum_replies")
      .select("*, perfiles(nombre,apellido,matricula)")
      .eq("topic_id", t.id).eq("is_deleted", false).order("created_at");
    // Cargar votos
    if (userId && data) {
      const replyIds = data.map((r: any) => r.id);
      const { data: votes } = await supabase.from("forum_reply_votes").select("reply_id,value,user_id").in("reply_id", replyIds);
      const mapped = data.map((r: any) => {
        const rv = (votes ?? []).filter((v: any) => v.reply_id === r.id);
        return { ...r, _voteCount: rv.reduce((s: number, v: any) => s + v.value, 0), _myVote: rv.find((v: any) => v.user_id === userId)?.value ?? 0 };
      });
      setReplies(mapped as Reply[]);
    } else {
      setReplies((data as unknown as Reply[]) ?? []);
    }
  };

  const submitTopic = async () => {
    setNError("");
    if (!nTitle.trim() || !nBody.trim() || !nCat) { setNError("Título, cuerpo y categoría son obligatorios."); return; }
    if (nTags.length < 1) { setNError("Seleccioná al menos 1 tag."); return; }
    setNLoading(true);
    const { data: nuevo, error } = await supabase.from("forum_topics").insert({
      author_id: userId, category_id: nCat, title: nTitle.trim(), body: nBody.trim(), is_urgent: nUrgent,
    }).select().single();
    if (error || !nuevo) { setNError("Error al publicar. Intentá de nuevo."); setNLoading(false); return; }
    // Insertar tags
    if (nTags.length > 0) {
      await supabase.from("forum_topic_tags").insert(nTags.map(tid => ({ topic_id: nuevo.id, tag_id: tid })));
    }
    setNLoading(false);
    setNTitle(""); setNBody(""); setNCat(""); setNTags([]); setNUrgent(false);
    await loadTopics();
    setVista("lista");
  };

  const submitReply = async () => {
    if (!replyBody.trim() || !topic || !userId) return;
    setReplyLoading(true);
    const { data: nueva } = await supabase.from("forum_replies").insert({
      topic_id: topic.id, author_id: userId, body: replyBody.trim(),
    }).select("*, perfiles(nombre,apellido,matricula)").single();
    if (nueva) {
      setReplies(r => [...r, { ...(nueva as unknown as Reply), _voteCount: 0, _myVote: 0 }]);
      await supabase.from("forum_topics").update({ replies_count: topic.replies_count + 1, last_activity_at: new Date().toISOString() }).eq("id", topic.id);
      setTopic(t => t ? { ...t, replies_count: t.replies_count + 1 } : t);
      // Notificar al autor del tema
      if (topic.author_id !== userId) {
        await supabase.from("forum_notifications").insert({ user_id: topic.author_id, type: "reply", topic_id: topic.id, reply_id: nueva.id });
      }
    }
    setReplyBody("");
    setReplyLoading(false);
  };

  const acceptReply = async (reply: Reply) => {
    if (!topic || topic.author_id !== userId) return;
    // Desmarcar anterior
    if (topic.accepted_reply_id) await supabase.from("forum_replies").update({ is_accepted: false }).eq("id", topic.accepted_reply_id);
    await supabase.from("forum_replies").update({ is_accepted: true }).eq("id", reply.id);
    await supabase.from("forum_topics").update({ accepted_reply_id: reply.id, status: "resolved" }).eq("id", topic.id);
    setReplies(rs => rs.map(r => ({ ...r, is_accepted: r.id === reply.id })));
    setTopic(t => t ? { ...t, accepted_reply_id: reply.id, status: "resolved" } : t);
    // Notificar al autor de la respuesta
    if (reply.author_id !== userId) {
      await supabase.from("forum_notifications").insert({ user_id: reply.author_id, type: "accepted_reply", topic_id: topic.id, reply_id: reply.id });
    }
  };

  const voteReply = async (reply: Reply, val: 1 | -1) => {
    if (!userId) return;
    const newVal = reply._myVote === val ? 0 : val;
    if (newVal === 0) {
      await supabase.from("forum_reply_votes").delete().eq("reply_id", reply.id).eq("user_id", userId);
    } else {
      await supabase.from("forum_reply_votes").upsert({ reply_id: reply.id, user_id: userId, value: newVal }, { onConflict: "reply_id,user_id" });
    }
    setReplies(rs => rs.map(r => r.id === reply.id ? { ...r, _myVote: newVal, _voteCount: (r._voteCount ?? 0) - (r._myVote ?? 0) + newVal } : r));
  };

  const toggleSave = async (topicId: string) => {
    if (!userId) return;
    if (savedIds.has(topicId)) {
      await supabase.from("forum_saved_topics").delete().eq("topic_id", topicId).eq("user_id", userId);
      setSavedIds(s => { const n = new Set(s); n.delete(topicId); return n; });
    } else {
      await supabase.from("forum_saved_topics").insert({ topic_id: topicId, user_id: userId });
      setSavedIds(s => new Set([...s, topicId]));
    }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => loadTopics({ q: val }), 350);
  };

  const applyFilter = (opts: { cat?: string; status?: string; urgent?: boolean }) => {
    const newCat = opts.cat ?? catFilter;
    const newSt = opts.status ?? statusFilter;
    const newUrg = opts.urgent ?? urgentOnly;
    if (opts.cat !== undefined) setCatFilter(opts.cat);
    if (opts.status !== undefined) setStatusFilter(opts.status);
    if (opts.urgent !== undefined) setUrgentOnly(opts.urgent);
    loadTopics({ cat: newCat, status: newSt, urgent: newUrg });
  };

  const urgentTopics = topics.filter(t => t.is_urgent && t.status === "open");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        .foro-wrap { display: flex; gap: 24px; max-width: 1200px; }
        /* SIDEBAR */
        .foro-side { width: 220px; flex-shrink: 0; display: flex; flex-direction: column; gap: 16px; }
        .foro-side-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .foro-side-title { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .foro-side-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .foro-side-item:last-child { border-bottom: none; }
        .foro-side-item:hover { background: rgba(255,255,255,0.03); }
        .foro-side-item.active { background: rgba(200,0,0,0.08); border-left: 2px solid #cc0000; }
        .foro-side-item-name { font-size: 12px; color: rgba(255,255,255,0.6); transition: color 0.15s; }
        .foro-side-item.active .foro-side-item-name { color: #fff; }
        /* MAIN */
        .foro-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 16px; }
        /* TOPBAR */
        .foro-topbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .foro-search { flex: 1; min-width: 200px; position: relative; }
        .foro-search input { width: 100%; padding: 10px 14px 10px 36px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter', sans-serif; }
        .foro-search input:focus { border-color: rgba(200,0,0,0.4); }
        .foro-search input::placeholder { color: rgba(255,255,255,0.2); }
        .foro-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 13px; color: rgba(255,255,255,0.3); pointer-events: none; }
        .foro-btn-nuevo { padding: 10px 20px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: background 0.2s; }
        .foro-btn-nuevo:hover { background: #e60000; }
        .foro-btn-urgente { padding: 10px 20px; background: rgba(234,179,8,0.12); border: 1px solid rgba(234,179,8,0.35); border-radius: 4px; color: #eab308; font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; transition: all 0.2s; }
        .foro-btn-urgente:hover { background: rgba(234,179,8,0.2); }
        /* FILTROS */
        .foro-filtros { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .foro-filtro { padding: 5px 12px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; font-size: 10px; font-weight: 600; letter-spacing: 0.08em; color: rgba(255,255,255,0.4); cursor: pointer; transition: all 0.15s; }
        .foro-filtro:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
        .foro-filtro.active { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .foro-filtro.urgente.active { border-color: #eab308; background: rgba(234,179,8,0.1); color: #eab308; }
        /* URGENTES BANNER */
        .foro-urgentes { background: rgba(234,179,8,0.06); border: 1px solid rgba(234,179,8,0.2); border-radius: 6px; padding: 14px 18px; }
        .foro-urgentes-title { font-family: 'Montserrat', sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #eab308; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
        .foro-urgentes-list { display: flex; flex-direction: column; gap: 6px; }
        .foro-urgente-item { display: flex; align-items: center; gap: 8px; cursor: pointer; }
        .foro-urgente-item:hover .foro-urgente-title { color: #eab308; }
        .foro-urgente-title { font-size: 12px; color: rgba(255,255,255,0.7); transition: color 0.15s; flex: 1; }
        .foro-urgente-time { font-size: 10px; color: rgba(255,255,255,0.3); flex-shrink: 0; }
        /* TOPIC LIST */
        .foro-topic-item { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
        .foro-topic-item:hover { border-color: rgba(200,0,0,0.25); background: rgba(14,14,14,1); }
        .foro-topic-item.urgent { border-color: rgba(234,179,8,0.3); }
        .foro-topic-item.urgent::before { content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 3px; background: #eab308; }
        .foro-topic-item.pinned::before { content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 3px; background: #60a5fa; }
        .foro-topic-top { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; }
        .foro-topic-badges { display: flex; gap: 6px; flex-wrap: wrap; }
        .foro-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 7px; border-radius: 10px; font-family: 'Montserrat', sans-serif; }
        .foro-badge.cat { background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.25); color: #ff8a80; }
        .foro-badge.urgent { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); color: #eab308; }
        .foro-badge.resolved { background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.3); color: #60a5fa; }
        .foro-badge.pinned { background: rgba(96,165,250,0.08); border: 1px solid rgba(96,165,250,0.2); color: #93c5fd; }
        .foro-topic-title { font-family: 'Montserrat', sans-serif; font-size: 14px; font-weight: 700; color: #fff; flex: 1; line-height: 1.4; }
        .foro-topic-body { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.6; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .foro-topic-footer { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
        .foro-topic-meta { font-size: 10px; color: rgba(255,255,255,0.3); display: flex; align-items: center; gap: 4px; }
        .foro-topic-tags { display: flex; gap: 4px; flex-wrap: wrap; margin-left: auto; }
        .foro-tag { font-size: 9px; color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 2px 7px; border-radius: 10px; }
        .foro-save-btn { background: none; border: none; font-size: 14px; cursor: pointer; color: rgba(255,255,255,0.25); transition: color 0.15s; padding: 2px; }
        .foro-save-btn.saved { color: #cc0000; }
        /* EMPTY */
        .foro-empty { padding: 56px 32px; text-align: center; color: rgba(255,255,255,0.2); font-size: 14px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        /* DETALLE */
        .foro-detalle { display: flex; flex-direction: column; gap: 20px; }
        .foro-back { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 12px; cursor: pointer; padding: 0; font-family: 'Inter', sans-serif; display: flex; align-items: center; gap: 6px; transition: color 0.15s; }
        .foro-back:hover { color: #fff; }
        .foro-topic-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 24px 28px; }
        .foro-topic-card-title { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 12px; line-height: 1.3; }
        .foro-topic-card-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
        .foro-avatar { width: 32px; height: 32px; border-radius: 6px; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.3); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 800; color: #cc0000; flex-shrink: 0; }
        .foro-author-name { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.7); }
        .foro-author-mat { font-size: 10px; color: rgba(255,255,255,0.3); font-family: 'Montserrat', sans-serif; }
        .foro-topic-card-body { font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.75); white-space: pre-wrap; }
        /* REPLIES */
        .foro-replies-title { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 12px; }
        .foro-reply { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 18px 22px; position: relative; }
        .foro-reply.accepted { border-color: rgba(96,165,250,0.4); background: rgba(96,165,250,0.04); }
        .foro-reply.accepted::before { content: '✓ Respuesta destacada'; position: absolute; top: -1px; right: 20px; background: #3b82f6; color: #fff; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; font-family: 'Montserrat', sans-serif; padding: 3px 10px; border-radius: 0 0 4px 4px; text-transform: uppercase; }
        .foro-reply-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .foro-reply-body { font-size: 13px; line-height: 1.75; color: rgba(255,255,255,0.7); white-space: pre-wrap; margin-bottom: 14px; }
        .foro-reply-actions { display: flex; align-items: center; gap: 10px; }
        .foro-vote-btn { display: flex; align-items: center; gap: 4px; padding: 4px 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.4); font-size: 11px; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; }
        .foro-vote-btn:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
        .foro-vote-btn.up.voted { border-color: #22c55e; background: rgba(34,197,94,0.1); color: #22c55e; }
        .foro-vote-btn.down.voted { border-color: #ef4444; background: rgba(239,68,68,0.1); color: #ef4444; }
        .foro-accept-btn { padding: 4px 12px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.3); border-radius: 3px; color: #60a5fa; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; font-family: 'Montserrat', sans-serif; transition: all 0.15s; }
        .foro-accept-btn:hover { background: rgba(59,130,246,0.2); }
        /* REPLY EDITOR */
        .foro-reply-editor { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 20px 24px; }
        .foro-reply-editor-title { font-family: 'Montserrat', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 12px; }
        .foro-textarea { width: 100%; padding: 12px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; resize: vertical; min-height: 100px; font-family: 'Inter', sans-serif; transition: border-color 0.2s; }
        .foro-textarea:focus { border-color: rgba(200,0,0,0.4); }
        .foro-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .foro-reply-submit { margin-top: 10px; padding: 10px 24px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; transition: background 0.2s; }
        .foro-reply-submit:hover:not(:disabled) { background: #e60000; }
        .foro-reply-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        /* NUEVO TEMA */
        .foro-nuevo { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 28px 32px; max-width: 700px; }
        .foro-nuevo-title { font-family: 'Montserrat', sans-serif; font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 24px; }
        .foro-nuevo-title span { color: #cc0000; }
        .fn-field { margin-bottom: 16px; }
        .fn-label { display: block; font-size: 10px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 6px; font-family: 'Montserrat', sans-serif; }
        .fn-input { width: 100%; padding: 10px 14px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter', sans-serif; }
        .fn-input:focus { border-color: rgba(200,0,0,0.4); }
        .fn-input::placeholder { color: rgba(255,255,255,0.2); }
        .fn-select { width: 100%; padding: 10px 14px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter', sans-serif; }
        .fn-tags-grid { display: flex; gap: 8px; flex-wrap: wrap; }
        .fn-tag { padding: 6px 12px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 11px; cursor: pointer; transition: all 0.15s; font-family: 'Inter', sans-serif; }
        .fn-tag.active { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .fn-urgent-toggle { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: rgba(234,179,8,0.05); border: 1px solid rgba(234,179,8,0.15); border-radius: 4px; cursor: pointer; }
        .fn-urgent-toggle.active { background: rgba(234,179,8,0.1); border-color: rgba(234,179,8,0.3); }
        .fn-urgent-icon { font-size: 18px; }
        .fn-urgent-text { flex: 1; }
        .fn-urgent-title { font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; color: #eab308; letter-spacing: 0.06em; }
        .fn-urgent-desc { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 2px; }
        .fn-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.08); border: 1px solid rgba(200,0,0,0.2); border-radius: 3px; padding: 10px 14px; margin-bottom: 14px; }
        .fn-actions { display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end; }
        .fn-btn-cancel { padding: 10px 20px; background: transparent; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: rgba(255,255,255,0.5); font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-btn-submit { padding: 10px 24px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-btn-submit:hover:not(:disabled) { background: #e60000; }
        .fn-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .fn-spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 6px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) { .foro-wrap { flex-direction: column; } .foro-side { width: 100%; } }
        @media (max-width: 600px) { .foro-nuevo { padding: 20px; } .foro-topic-card { padding: 16px; } }
      `}</style>

      {/* ── LISTA ── */}
      {vista === "lista" && (
        <div className="foro-wrap">
          {/* Sidebar categorías */}
          <aside className="foro-side">
            <div className="foro-side-box">
              <div className="foro-side-title">Categorías</div>
              <div
                className={`foro-side-item${catFilter === "todas" ? " active" : ""}`}
                onClick={() => applyFilter({ cat: "todas" })}
              >
                <span className="foro-side-item-name">Todos los temas</span>
              </div>
              {categories.map(c => (
                <div
                  key={c.id}
                  className={`foro-side-item${catFilter === c.id ? " active" : ""}`}
                  onClick={() => applyFilter({ cat: c.id })}
                >
                  <span className="foro-side-item-name">{c.name}</span>
                </div>
              ))}
            </div>
            <div className="foro-side-box">
              <div className="foro-side-title">Estado</div>
              {[["todas","Todos"],["open","Abiertos"],["resolved","Resueltos"]].map(([v,l]) => (
                <div key={v} className={`foro-side-item${statusFilter === v ? " active" : ""}`} onClick={() => applyFilter({ status: v })}>
                  <span className="foro-side-item-name">{l}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Main */}
          <div className="foro-main">
            {/* Topbar */}
            <div className="foro-topbar">
              <div className="foro-search">
                <span className="foro-search-icon">🔍</span>
                <input placeholder="Buscar en el foro..." value={search} onChange={e => handleSearch(e.target.value)} />
              </div>
              <button className="foro-btn-urgente" onClick={() => applyFilter({ urgent: !urgentOnly })}>
                ⚡ Urgentes {urgentTopics.length > 0 && `(${urgentTopics.length})`}
              </button>
              <button className="foro-btn-nuevo" onClick={() => setVista("nuevo")}>+ Nueva consulta</button>
            </div>

            {/* Urgentes banner */}
            {urgentOnly && urgentTopics.length > 0 && (
              <div className="foro-urgentes">
                <div className="foro-urgentes-title">⚡ Consultas urgentes</div>
                <div className="foro-urgentes-list">
                  {urgentTopics.slice(0, 3).map(t => (
                    <div key={t.id} className="foro-urgente-item" onClick={() => openTopic(t)}>
                      <span style={{fontSize:10,color:"#eab308"}}>▶</span>
                      <span className="foro-urgente-title">{t.title}</span>
                      <span className="foro-urgente-time">{timeAgo(t.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista de temas */}
            {loading ? (
              <div className="foro-empty">Cargando...</div>
            ) : topics.length === 0 ? (
              <div className="foro-empty">No hay temas en esta categoría todavía.</div>
            ) : (
              topics.map(t => (
                <div
                  key={t.id}
                  className={`foro-topic-item${t.is_urgent ? " urgent" : ""}${t.is_pinned ? " pinned" : ""}`}
                  onClick={() => openTopic(t)}
                >
                  <div className="foro-topic-top">
                    <div style={{flex:1}}>
                      <div className="foro-topic-badges" style={{marginBottom:8}}>
                        {t.forum_categories && <span className="foro-badge cat">{t.forum_categories.name}</span>}
                        {t.is_urgent && <span className="foro-badge urgent">⚡ Urgente</span>}
                        {t.status === "resolved" && <span className="foro-badge resolved">✓ Resuelto</span>}
                        {t.is_pinned && <span className="foro-badge pinned">📌 Fijado</span>}
                      </div>
                      <div className="foro-topic-title">{t.title}</div>
                    </div>
                    <button
                      className={`foro-save-btn${savedIds.has(t.id) ? " saved" : ""}`}
                      onClick={e => { e.stopPropagation(); toggleSave(t.id); }}
                      title={savedIds.has(t.id) ? "Quitar de guardados" : "Guardar"}
                    >
                      {savedIds.has(t.id) ? "❤️" : "🤍"}
                    </button>
                  </div>
                  <div className="foro-topic-body">{t.body}</div>
                  <div className="foro-topic-footer">
                    <span className="foro-topic-meta">👤 {fullName(t.perfiles)}</span>
                    <span className="foro-topic-meta">💬 {t.replies_count}</span>
                    <span className="foro-topic-meta">👁 {t.view_count}</span>
                    <span className="foro-topic-meta">{timeAgo(t.last_activity_at)}</span>
                    <div className="foro-topic-tags">
                      {(t.forum_topic_tags ?? []).slice(0, 3).map((tt: any) => (
                        <span key={tt.forum_tags?.id} className="foro-tag">{tt.forum_tags?.name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── DETALLE ── */}
      {vista === "detalle" && topic && (
        <div className="foro-detalle">
          <button className="foro-back" onClick={() => { setVista("lista"); loadTopics(); }}>← Volver al foro</button>

          {/* Tema */}
          <div className="foro-topic-card">
            <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {topic.forum_categories && <span className="foro-badge cat">{topic.forum_categories.name}</span>}
              {topic.is_urgent && <span className="foro-badge urgent">⚡ Urgente</span>}
              {topic.status === "resolved" && <span className="foro-badge resolved">✓ Resuelto</span>}
            </div>
            <div className="foro-topic-card-title">{topic.title}</div>
            <div className="foro-topic-card-meta">
              <div className="foro-avatar">{initials(topic.perfiles)}</div>
              <div>
                <div className="foro-author-name">{fullName(topic.perfiles)}</div>
                {topic.perfiles?.matricula && <div className="foro-author-mat">Mat. {topic.perfiles.matricula}</div>}
              </div>
              <span className="foro-topic-meta" style={{marginLeft:8}}>{timeAgo(topic.created_at)}</span>
              <span className="foro-topic-meta">👁 {topic.view_count}</span>
              <span className="foro-topic-meta">💬 {topic.replies_count}</span>
            </div>
            <div className="foro-topic-card-body">{topic.body}</div>
            {(topic.forum_topic_tags ?? []).length > 0 && (
              <div className="foro-topic-tags" style={{marginTop:16}}>
                {(topic.forum_topic_tags ?? []).map((tt: any) => (
                  <span key={tt.forum_tags?.id} className="foro-tag">{tt.forum_tags?.name}</span>
                ))}
              </div>
            )}
          </div>

          {/* Respuestas */}
          {replies.length > 0 && (
            <div>
              <div className="foro-replies-title">{replies.length} {replies.length === 1 ? "Respuesta" : "Respuestas"}</div>
              {/* Aceptada primero */}
              {[...replies].sort((a, b) => (b.is_accepted ? 1 : 0) - (a.is_accepted ? 1 : 0)).map(r => (
                <div key={r.id} className={`foro-reply${r.is_accepted ? " accepted" : ""}`} style={{marginBottom:12}}>
                  <div className="foro-reply-meta">
                    <div className="foro-avatar">{initials(r.perfiles)}</div>
                    <div>
                      <div className="foro-author-name">{fullName(r.perfiles)}</div>
                      {r.perfiles?.matricula && <div className="foro-author-mat">Mat. {r.perfiles.matricula}</div>}
                    </div>
                    <span className="foro-topic-meta" style={{marginLeft:8}}>{timeAgo(r.created_at)}</span>
                  </div>
                  <div className="foro-reply-body">{r.body}</div>
                  <div className="foro-reply-actions">
                    <button className={`foro-vote-btn up${r._myVote === 1 ? " voted" : ""}`} onClick={() => voteReply(r, 1)}>
                      ▲ <span>{(r._voteCount ?? 0) > 0 ? `+${r._voteCount}` : r._voteCount ?? 0}</span>
                    </button>
                    <button className={`foro-vote-btn down${r._myVote === -1 ? " voted" : ""}`} onClick={() => voteReply(r, -1)}>▼</button>
                    {topic.author_id === userId && !r.is_accepted && !topic.is_locked && (
                      <button className="foro-accept-btn" onClick={() => acceptReply(r)}>✓ Marcar como destacada</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Editor de respuesta */}
          {!topic.is_locked && (
            <div className="foro-reply-editor">
              <div className="foro-reply-editor-title">Tu respuesta</div>
              <textarea
                className="foro-textarea"
                placeholder="Escribí tu respuesta..."
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                disabled={replyLoading}
              />
              <button className="foro-reply-submit" onClick={submitReply} disabled={replyLoading || !replyBody.trim()}>
                {replyLoading && <span className="fn-spinner"/>}
                {replyLoading ? "Publicando..." : "Publicar respuesta"}
              </button>
            </div>
          )}
          {topic.is_locked && (
            <div style={{padding:"14px 18px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,fontSize:12,color:"rgba(255,255,255,0.35)",textAlign:"center"}}>
              🔒 Este tema está cerrado. No se aceptan nuevas respuestas.
            </div>
          )}
        </div>
      )}

      {/* ── NUEVO TEMA ── */}
      {vista === "nuevo" && (
        <div className="foro-nuevo">
          <div className="foro-nuevo-title">Nueva <span>consulta</span></div>

          <div className="fn-field">
            <label className="fn-label">Categoría *</label>
            <select className="fn-select" value={nCat} onChange={e => setNCat(e.target.value)}>
              <option value="">Seleccioná una categoría...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="fn-field">
            <label className="fn-label">Título *</label>
            <input className="fn-input" placeholder="¿Cuál es tu consulta?" value={nTitle} onChange={e => setNTitle(e.target.value)} />
          </div>

          <div className="fn-field">
            <label className="fn-label">Descripción *</label>
            <textarea className="foro-textarea" placeholder="Describí tu consulta con detalle..." value={nBody} onChange={e => setNBody(e.target.value)} style={{minHeight:140}} />
          </div>

          <div className="fn-field">
            <label className="fn-label">Tags * (seleccioná al menos 1)</label>
            <div className="fn-tags-grid">
              {tags.map(t => (
                <button
                  key={t.id}
                  type="button"
                  className={`fn-tag${nTags.includes(t.id) ? " active" : ""}`}
                  onClick={() => setNTags(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="fn-field">
            <div className={`fn-urgent-toggle${nUrgent ? " active" : ""}`} onClick={() => setNUrgent(u => !u)}>
              <span className="fn-urgent-icon">⚡</span>
              <div className="fn-urgent-text">
                <div className="fn-urgent-title">Marcar como urgente</div>
                <div className="fn-urgent-desc">Notifica a todos los miembros y aparece destacado</div>
              </div>
              <div style={{width:36,height:20,borderRadius:10,background:nUrgent?"#eab308":"rgba(255,255,255,0.1)",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                <div style={{position:"absolute",top:2,left:nUrgent?18:2,width:16,height:16,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
              </div>
            </div>
          </div>

          {nError && <div className="fn-error">{nError}</div>}

          <div className="fn-actions">
            <button className="fn-btn-cancel" onClick={() => setVista("lista")}>Cancelar</button>
            <button className="fn-btn-submit" onClick={submitTopic} disabled={nLoading}>
              {nLoading && <span className="fn-spinner"/>}
              {nLoading ? "Publicando..." : "Publicar consulta"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
