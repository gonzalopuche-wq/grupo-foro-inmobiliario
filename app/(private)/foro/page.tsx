"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import PerfilRapidoModal from "./PerfilRapidoModal";

// ── TYPES ──────────────────────────────────────────────────────────────
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
  is_accepted: boolean; created_at: string;
  perfiles?: Author;
  _voteCount?: number; _myVote?: number;
}
interface ChatMsg {
  id: string; user_id: string; body: string; created_at: string;
  perfiles?: Author;
}

type MainTab = "temas" | "chat" | "faq";
type Vista = "lista" | "detalle" | "nuevo";

// ── HELPERS ─────────────────────────────────────────────────────────────
const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
};
const initials = (p?: Author) => p ? `${p.nombre?.charAt(0) ?? ""}${p.apellido?.charAt(0) ?? ""}`.toUpperCase() : "?";
const fullName = (p?: Author) => p ? `${p.apellido ?? ""}, ${p.nombre ?? ""}` : "—";

// ── WA / TG GROUPS ──────────────────────────────────────────────────────
const WA_GROUPS = [
  { name: "Foro Inmobiliario", sub: "1025 miembros", url: "https://chat.whatsapp.com/CShHa28oS2P2OWJrotLp3j", main: true },
  { name: "Ventas — Búsqueda", sub: "", url: "https://chat.whatsapp.com/KfqcLrP6GprKPDSzgwd8MG", main: false },
  { name: "Ventas — Ofrecidos", sub: "", url: "https://chat.whatsapp.com/CsqIVRLe2gh33wQYK7qe5p", main: false },
  { name: "Alquileres — Búsqueda", sub: "", url: "https://chat.whatsapp.com/KkfMBkfrgdA8XhQUlWiRLs", main: false },
  { name: "Alquileres — Ofrecidos", sub: "", url: "https://chat.whatsapp.com/FfjzdHlTeCYIHleSuhQJlP", main: false },
  { name: "Cotizaciones", sub: "", url: "https://chat.whatsapp.com/F4Tp8bGBZ7670HPmu4RvIn", main: false },
  { name: "Tasaciones", sub: "", url: "https://chat.whatsapp.com/GwtTHC2Qol90kUSZ46HEQk", main: false },
];
const TG_GROUPS = [
  { name: "Foro Inmobiliario", sub: "400 miembros", url: "https://t.me/foroinmobiliario", main: true },
  { name: "Ventas — Búsqueda", sub: "", url: "https://t.me/ventasbusqueda", main: false },
  { name: "Ventas — Ofrecidos", sub: "", url: "https://t.me/ventasofrecidos", main: false },
  { name: "Alquileres — Búsqueda", sub: "", url: "https://t.me/alquileresbusqueda", main: false },
  { name: "Alquileres — Ofrecidos", sub: "", url: "https://t.me/alquileresofrecidos", main: false },
];

// ── COMPONENT ────────────────────────────────────────────────────────────
export default function ForoPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<Author | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("temas");
  const [vista, setVista] = useState<Vista>("lista");
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [replyLoading, setReplyLoading] = useState(false);
  const [catFilter, setCatFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todas");
  const [search, setSearch] = useState("");

  // Nuevo tema
  const [nTitle, setNTitle] = useState("");
  const [nBody, setNBody] = useState("");
  const [nCat, setNCat] = useState("");
  const [nTags, setNTags] = useState<string[]>([]);
  const [nUrgent, setNUrgent] = useState(false);
  const [nError, setNError] = useState("");
  const [nLoading, setNLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [perfilRapidoId, setPerfilRapidoId] = useState<string | null>(null);

  // Chat
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  <div className="f-chat-avatar" style={{cursor:"pointer"}} onClick={() => setPerfilRapidoId(m.user_id)}>
  {initials(m.perfiles)}
</div>

  // FAQ
  const [faqTopics, setFaqTopics] = useState<Topic[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.href = "/login"; return; }
      setUserId(data.user.id);
      const { data: perfil } = await supabase.from("perfiles").select("id,nombre,apellido,matricula").eq("id", data.user.id).single();
      if (perfil) setUserProfile(perfil as Author);
      await Promise.all([loadCategories(), loadTags(), loadSaved(data.user.id), loadFaq()]);
      await loadTopics({ cat: "todas", status: "todas", q: "" });
      await loadChat();
      subscribeChat();
    };
    init();
    return () => { supabase.channel("forum_chat").unsubscribe(); };
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  const loadCategories = async () => {
    const { data } = await supabase.from("forum_categories").select("*").eq("is_active", true).order("sort_order");
    setCategories(data ?? []);
  };

  const loadTags = async () => {
    const { data } = await supabase.from("forum_tags").select("*").order("name");
    setTags(data ?? []);
  };

  const loadTopics = async (opts?: { cat?: string; status?: string; q?: string }) => {
    setLoading(true);
    const cat = opts?.cat !== undefined ? opts.cat : "todas";
    const st = opts?.status !== undefined ? opts.status : "todas";
    const sq = opts?.q !== undefined ? opts.q : "";
    let query = supabase.from("forum_topics")
      .select("*, forum_categories(name,slug), perfiles(nombre,apellido,matricula), forum_topic_tags(forum_tags(id,name,slug))")
      .order("is_pinned", { ascending: false })
      .order("last_activity_at", { ascending: false });
    if (cat !== "todas") {
      const found = categories.find(c => c.id === cat);
      if (found) query = query.eq("category_id", found.id);
    }
    if (st !== "todas") query = query.eq("status", st);
    const { data } = await query;
    let result = (data as unknown as Topic[]) ?? [];
    if (sq.trim()) {
      const lower = sq.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(lower) || t.body.toLowerCase().includes(lower));
    }
    setTopics(result);
    setLoading(false);
  };

  const loadFaq = async () => {
    const { data } = await supabase.from("forum_topics")
      .select("*, forum_categories(name,slug), perfiles(nombre,apellido,matricula), forum_topic_tags(forum_tags(id,name,slug))")
      .eq("status", "resolved").order("last_activity_at", { ascending: false }).limit(20);
    setFaqTopics((data as unknown as Topic[]) ?? []);
  };

  const loadSaved = async (uid: string) => {
    const { data } = await supabase.from("forum_saved_topics").select("topic_id").eq("user_id", uid);
    setSavedIds(new Set((data ?? []).map((r: any) => r.topic_id)));
  };

  const loadChat = async () => {
    const { data } = await supabase.from("forum_chat_messages")
      .select("*, perfiles(nombre,apellido,matricula)")
      .order("created_at", { ascending: true }).limit(100);
    setChatMsgs((data as unknown as ChatMsg[]) ?? []);
  };

  const subscribeChat = () => {
    supabase.channel("forum_chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "forum_chat_messages" }, async (payload) => {
        const { data } = await supabase.from("forum_chat_messages")
          .select("*, perfiles(nombre,apellido,matricula)").eq("id", payload.new.id).single();
        if (data) setChatMsgs(prev => [...prev, data as unknown as ChatMsg]);
      })
      .subscribe();
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !userId) return;
    setChatLoading(true);
    await supabase.from("forum_chat_messages").insert({ user_id: userId, body: chatInput.trim() });
    setChatInput("");
    setChatLoading(false);
  };

  const openTopic = async (t: Topic) => {
    setTopic(t);
    setVista("detalle");
    setReplyBody("");
    await supabase.from("forum_topics").update({ view_count: t.view_count + 1 }).eq("id", t.id);
    const { data } = await supabase.from("forum_replies")
      .select("*, perfiles(nombre,apellido,matricula)")
      .eq("topic_id", t.id).eq("is_deleted", false).order("created_at");
    if (userId && data) {
      const replyIds = data.map((r: any) => r.id);
      const { data: votes } = await supabase.from("forum_reply_votes").select("reply_id,value,user_id").in("reply_id", replyIds);
      setReplies(data.map((r: any) => ({ ...r, _voteCount: (votes ?? []).filter((v: any) => v.reply_id === r.id).reduce((s: number, v: any) => s + v.value, 0), _myVote: (votes ?? []).find((v: any) => v.reply_id === r.id && v.user_id === userId)?.value ?? 0 })) as Reply[]);
    } else setReplies((data as unknown as Reply[]) ?? []);
  };

  const submitTopic = async () => {
    setNError("");
    if (!nTitle.trim() || !nBody.trim() || !nCat) { setNError("Título, cuerpo y categoría son obligatorios."); return; }
    if (nTags.length < 1) { setNError("Seleccioná al menos 1 tag."); return; }
    setNLoading(true);
    const { data: nuevo, error } = await supabase.from("forum_topics").insert({ author_id: userId, category_id: nCat, title: nTitle.trim(), body: nBody.trim(), is_urgent: nUrgent }).select().single();
    if (error || !nuevo) { setNError("Error al publicar. Intentá de nuevo."); setNLoading(false); return; }
    if (nTags.length > 0) await supabase.from("forum_topic_tags").insert(nTags.map(tid => ({ topic_id: nuevo.id, tag_id: tid })));
    setNLoading(false);
    setNTitle(""); setNBody(""); setNCat(""); setNTags([]); setNUrgent(false);
    setCatFilter("todas");
    setStatusFilter("todas");
    setSearch("");
    await loadTopics({ cat: "todas", status: "todas", q: "" });
    setVista("lista");
  };

  const submitReply = async () => {
    if (!replyBody.trim() || !topic || !userId) return;
    setReplyLoading(true);
    const { data: nueva } = await supabase.from("forum_replies").insert({ topic_id: topic.id, author_id: userId, body: replyBody.trim() }).select("*, perfiles(nombre,apellido,matricula)").single();
    if (nueva) {
      setReplies(r => [...r, { ...(nueva as unknown as Reply), _voteCount: 0, _myVote: 0 }]);
      await supabase.from("forum_topics").update({ replies_count: topic.replies_count + 1, last_activity_at: new Date().toISOString() }).eq("id", topic.id);
      setTopic(t => t ? { ...t, replies_count: t.replies_count + 1 } : t);
      if (topic.author_id !== userId) await supabase.from("forum_notifications").insert({ user_id: topic.author_id, type: "reply", topic_id: topic.id, reply_id: nueva.id });
    }
    setReplyBody("");
    setReplyLoading(false);
  };

  const acceptReply = async (reply: Reply) => {
    if (!topic || topic.author_id !== userId) return;
    if (topic.accepted_reply_id) await supabase.from("forum_replies").update({ is_accepted: false }).eq("id", topic.accepted_reply_id);
    await supabase.from("forum_replies").update({ is_accepted: true }).eq("id", reply.id);
    await supabase.from("forum_topics").update({ accepted_reply_id: reply.id, status: "resolved" }).eq("id", topic.id);
    setReplies(rs => rs.map(r => ({ ...r, is_accepted: r.id === reply.id })));
    setTopic(t => t ? { ...t, accepted_reply_id: reply.id, status: "resolved" } : t);
    if (reply.author_id !== userId) await supabase.from("forum_notifications").insert({ user_id: reply.author_id, type: "accepted_reply", topic_id: topic.id, reply_id: reply.id });
  };

  const voteReply = async (reply: Reply, val: 1 | -1) => {
    if (!userId) return;
    const newVal = reply._myVote === val ? 0 : val;
    if (newVal === 0) await supabase.from("forum_reply_votes").delete().eq("reply_id", reply.id).eq("user_id", userId);
    else await supabase.from("forum_reply_votes").upsert({ reply_id: reply.id, user_id: userId, value: newVal }, { onConflict: "reply_id,user_id" });
    setReplies(rs => rs.map(r => r.id === reply.id ? { ...r, _myVote: newVal, _voteCount: (r._voteCount ?? 0) - (r._myVote ?? 0) + newVal } : r));
  };

  const toggleSave = async (topicId: string) => {
    if (!userId) return;
    if (savedIds.has(topicId)) { await supabase.from("forum_saved_topics").delete().eq("topic_id", topicId).eq("user_id", userId); setSavedIds(s => { const n = new Set(s); n.delete(topicId); return n; }); }
    else { await supabase.from("forum_saved_topics").insert({ topic_id: topicId, user_id: userId }); setSavedIds(s => new Set([...s, topicId])); }
  };

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => loadTopics({ q: val }), 350);
  };

  const applyFilter = (opts: { cat?: string; status?: string }) => {
    const newCat = opts.cat ?? catFilter;
    const newSt = opts.status ?? statusFilter;
    if (opts.cat !== undefined) setCatFilter(opts.cat);
    if (opts.status !== undefined) setStatusFilter(opts.status);
    loadTopics({ cat: newCat, status: newSt });
  };

  const TopicCard = ({ t, onClick }: { t: Topic; onClick: () => void }) => (
    <div className={`f-topic${t.is_urgent ? " urgent" : ""}${t.is_pinned ? " pinned" : ""}`} onClick={onClick}>
      <div className="f-topic-top">
        <div style={{ flex: 1 }}>
          <div className="f-topic-badges">
            {t.forum_categories && <span className="f-badge cat">{t.forum_categories.name}</span>}
            {t.is_urgent && <span className="f-badge urg">⚡ Urgente</span>}
            {t.status === "resolved" && <span className="f-badge res">✓ Resuelto</span>}
            {t.is_pinned && <span className="f-badge pin">📌 Fijado</span>}
          </div>
          <div className="f-topic-title">{t.title}</div>
        </div>
        <button className={`f-save${savedIds.has(t.id) ? " saved" : ""}`} onClick={e => { e.stopPropagation(); toggleSave(t.id); }}>{savedIds.has(t.id) ? "❤️" : "🤍"}</button>
      </div>
      <div className="f-topic-body">{t.body}</div>
      <div className="f-topic-footer">
        <span className="f-meta">👤 {fullName(t.perfiles)}</span>
        <span className="f-meta">💬 {t.replies_count}</span>
        <span className="f-meta">👁 {t.view_count}</span>
        <span className="f-meta">{timeAgo(t.last_activity_at)}</span>
        <div className="f-tags-row">
          {(t.forum_topic_tags ?? []).slice(0, 3).map((tt: any) => <span key={tt.forum_tags?.id} className="f-tag">{tt.forum_tags?.name}</span>)}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Inter:wght@300;400;500&display=swap');
        /* LAYOUT */
        .f-layout { display: grid; grid-template-columns: 180px 1fr 240px; gap: 20px; align-items: start; }
        /* LEFT SIDEBAR */
        .f-left { display: flex; flex-direction: column; gap: 12px; position: sticky; top: 80px; }
        .f-side-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .f-side-title { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(255,255,255,0.3); padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .f-side-item { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 12px; color: rgba(255,255,255,0.55); }
        .f-side-item:last-child { border-bottom: none; }
        .f-side-item:hover { background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.8); }
        .f-side-item.active { background: rgba(200,0,0,0.08); color: #fff; border-left: 2px solid #cc0000; }
        /* CENTER */
        .f-center { min-width: 0; display: flex; flex-direction: column; gap: 14px; }
        /* TABS */
        .f-tabs { display: flex; gap: 4px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 4px; }
        .f-tab { flex: 1; padding: 9px; border: none; border-radius: 4px; background: transparent; color: rgba(255,255,255,0.4); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: all 0.2s; }
        .f-tab:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.04); }
        .f-tab.active { background: rgba(200,0,0,0.15); color: #fff; border: 1px solid rgba(200,0,0,0.3); }
        /* TOPBAR */
        .f-topbar { display: flex; align-items: center; gap: 10px; }
        .f-search { flex: 1; position: relative; }
        .f-search input { width: 100%; padding: 9px 14px 9px 34px; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; transition: border-color 0.2s; font-family: 'Inter',sans-serif; }
        .f-search input:focus { border-color: rgba(200,0,0,0.4); }
        .f-search input::placeholder { color: rgba(255,255,255,0.2); }
        .f-search-ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); font-size: 12px; color: rgba(255,255,255,0.3); }
        .f-btn-nuevo { padding: 9px 18px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        .f-btn-nuevo:hover { background: #e60000; }
        .f-btn-urgente { padding: 9px 14px; background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.3); border-radius: 4px; color: #eab308; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; white-space: nowrap; }
        /* FILTROS */
        .f-filtros { display: flex; gap: 6px; flex-wrap: wrap; }
        .f-filtro { padding: 5px 11px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 10px; cursor: pointer; transition: all 0.15s; font-family: 'Inter',sans-serif; }
        .f-filtro:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
        .f-filtro.active { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        /* TOPIC CARDS */
        .f-topic { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 14px 18px; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; }
        .f-topic:hover { border-color: rgba(200,0,0,0.25); }
        .f-topic.urgent { border-color: rgba(234,179,8,0.25); }
        .f-topic.urgent::before, .f-topic.pinned::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
        .f-topic.urgent::before { background: #eab308; }
        .f-topic.pinned::before { background: #60a5fa; }
        .f-topic-top { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 7px; }
        .f-topic-badges { display: flex; gap: 5px; flex-wrap: wrap; margin-bottom: 6px; }
        .f-badge { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; padding: 2px 6px; border-radius: 10px; font-family: 'Montserrat',sans-serif; }
        .f-badge.cat { background: rgba(200,0,0,0.1); border: 1px solid rgba(200,0,0,0.2); color: #ff8a80; }
        .f-badge.urg { background: rgba(234,179,8,0.1); border: 1px solid rgba(234,179,8,0.25); color: #eab308; }
        .f-badge.res { background: rgba(96,165,250,0.1); border: 1px solid rgba(96,165,250,0.25); color: #60a5fa; }
        .f-badge.pin { background: rgba(96,165,250,0.07); border: 1px solid rgba(96,165,250,0.15); color: #93c5fd; }
        .f-topic-title { font-family: 'Montserrat',sans-serif; font-size: 13px; font-weight: 700; color: #fff; line-height: 1.4; }
        .f-topic-body { font-size: 12px; color: rgba(255,255,255,0.4); line-height: 1.5; margin-bottom: 9px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .f-topic-footer { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .f-meta { font-size: 10px; color: rgba(255,255,255,0.3); }
        .f-tags-row { display: flex; gap: 4px; flex-wrap: wrap; margin-left: auto; }
        .f-tag { font-size: 9px; color: rgba(255,255,255,0.3); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); padding: 2px 6px; border-radius: 10px; }
        .f-save { background: none; border: none; font-size: 13px; cursor: pointer; color: rgba(255,255,255,0.25); transition: color 0.15s; padding: 2px; flex-shrink: 0; }
        .f-save.saved { color: #cc0000; }
        /* CHAT */
        .f-chat { display: flex; flex-direction: column; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; height: calc(100vh - 200px); min-height: 400px; }
        .f-chat-header { padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 8px; }
        .f-chat-header-title { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: rgba(255,255,255,0.6); }
        .f-chat-live { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.4)}50%{box-shadow:0 0 0 6px rgba(34,197,94,0)} }
        .f-chat-msgs { flex: 1; overflow-y: auto; padding: 16px 18px; display: flex; flex-direction: column; gap: 12px; }
        .f-chat-msgs::-webkit-scrollbar { width: 4px; }
        .f-chat-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .f-chat-msg { display: flex; gap: 10px; align-items: flex-start; }
        .f-chat-msg.mine { flex-direction: row-reverse; }
        .f-chat-avatar { width: 28px; height: 28px; border-radius: 5px; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.25); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 800; color: #cc0000; flex-shrink: 0; }
        .f-chat-bubble { max-width: 75%; }
        .f-chat-name { font-size: 10px; color: rgba(255,255,255,0.35); margin-bottom: 3px; font-family: 'Montserrat',sans-serif; font-weight: 600; }
        .f-chat-msg.mine .f-chat-name { text-align: right; }
        .f-chat-text { padding: 8px 12px; border-radius: 8px; font-size: 13px; color: rgba(255,255,255,0.85); line-height: 1.5; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); word-break: break-word; }
        .f-chat-msg.mine .f-chat-text { background: rgba(200,0,0,0.12); border-color: rgba(200,0,0,0.2); }
        .f-chat-time { font-size: 9px; color: rgba(255,255,255,0.2); margin-top: 3px; }
        .f-chat-msg.mine .f-chat-time { text-align: right; }
        .f-chat-input { border-top: 1px solid rgba(255,255,255,0.06); padding: 12px 14px; display: flex; gap: 8px; }
        .f-chat-input input { flex: 1; padding: 9px 12px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .f-chat-input input:focus { border-color: rgba(200,0,0,0.35); }
        .f-chat-input input::placeholder { color: rgba(255,255,255,0.2); }
        .f-chat-send { padding: 9px 16px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; }
        .f-chat-send:hover { background: #e60000; }
        .f-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
        /* DETALLE */
        .f-detalle { display: flex; flex-direction: column; gap: 16px; }
        .f-back { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 12px; cursor: pointer; padding: 0; font-family: 'Inter',sans-serif; display: flex; align-items: center; gap: 5px; }
        .f-back:hover { color: #fff; }
        .f-card { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 22px 26px; }
        .f-card-title { font-family: 'Montserrat',sans-serif; font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 12px; line-height: 1.3; }
        .f-card-meta { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
        .f-avatar { width: 30px; height: 30px; border-radius: 5px; background: rgba(200,0,0,0.15); border: 1px solid rgba(200,0,0,0.25); display: flex; align-items: center; justify-content: center; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 800; color: #cc0000; flex-shrink: 0; }
        .f-card-body { font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.75); white-space: pre-wrap; }
        .f-replies-title { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 10px; }
        .f-reply { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 16px 20px; margin-bottom: 10px; position: relative; }
        .f-reply.accepted { border-color: rgba(96,165,250,0.35); background: rgba(96,165,250,0.04); }
        .f-reply.accepted::after { content: '✓ Respuesta destacada'; position: absolute; top: -1px; right: 16px; background: #3b82f6; color: #fff; font-size: 8px; font-weight: 700; letter-spacing: 0.12em; font-family: 'Montserrat',sans-serif; padding: 3px 10px; border-radius: 0 0 4px 4px; text-transform: uppercase; }
        .f-reply-meta { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .f-reply-body { font-size: 13px; line-height: 1.7; color: rgba(255,255,255,0.7); white-space: pre-wrap; margin-bottom: 12px; }
        .f-reply-actions { display: flex; align-items: center; gap: 8px; }
        .f-vote { display: flex; align-items: center; gap: 3px; padding: 3px 9px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 3px; color: rgba(255,255,255,0.4); font-size: 11px; cursor: pointer; transition: all 0.15s; }
        .f-vote.up.voted { border-color: #22c55e; background: rgba(34,197,94,0.09); color: #22c55e; }
        .f-vote.down.voted { border-color: #ef4444; background: rgba(239,68,68,0.09); color: #ef4444; }
        .f-accept-btn { padding: 3px 10px; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.25); border-radius: 3px; color: #60a5fa; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; font-family: 'Montserrat',sans-serif; }
        .f-editor { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 18px 22px; }
        .f-editor-title { font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 10px; }
        .f-textarea { width: 100%; padding: 10px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; resize: vertical; min-height: 90px; font-family: 'Inter',sans-serif; }
        .f-textarea:focus { border-color: rgba(200,0,0,0.35); }
        .f-textarea::placeholder { color: rgba(255,255,255,0.2); }
        .f-submit { margin-top: 9px; padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
        .f-submit:hover:not(:disabled) { background: #e60000; }
        .f-submit:disabled { opacity: 0.55; cursor: not-allowed; }
        /* NUEVO */
        .f-nuevo { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 24px 28px; max-width: 680px; }
        .f-nuevo-title { font-family: 'Montserrat',sans-serif; font-size: 16px; font-weight: 800; color: #fff; margin-bottom: 20px; }
        .f-nuevo-title span { color: #cc0000; }
        .fn-field { margin-bottom: 14px; }
        .fn-label { display: block; font-size: 9px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.38); margin-bottom: 5px; font-family: 'Montserrat',sans-serif; }
        .fn-input { width: 100%; padding: 9px 13px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .fn-input:focus { border-color: rgba(200,0,0,0.4); }
        .fn-input::placeholder { color: rgba(255,255,255,0.2); }
        .fn-select { width: 100%; padding: 9px 13px; background: rgba(14,14,14,0.95); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 13px; outline: none; font-family: 'Inter',sans-serif; }
        .fn-tags { display: flex; gap: 7px; flex-wrap: wrap; }
        .fn-tag { padding: 5px 11px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.4); font-size: 11px; cursor: pointer; transition: all 0.15s; font-family: 'Inter',sans-serif; }
        .fn-tag.active { border-color: #cc0000; background: rgba(200,0,0,0.1); color: #fff; }
        .fn-urg { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: rgba(234,179,8,0.05); border: 1px solid rgba(234,179,8,0.15); border-radius: 4px; cursor: pointer; }
        .fn-urg.active { background: rgba(234,179,8,0.09); border-color: rgba(234,179,8,0.28); }
        .fn-urg-t { font-family: 'Montserrat',sans-serif; font-size: 11px; font-weight: 700; color: #eab308; }
        .fn-urg-d { font-size: 11px; color: rgba(255,255,255,0.32); margin-top: 1px; }
        .fn-error { font-size: 12px; color: #ff4444; background: rgba(200,0,0,0.07); border: 1px solid rgba(200,0,0,0.18); border-radius: 3px; padding: 9px 13px; margin-bottom: 12px; }
        .fn-actions { display: flex; gap: 10px; margin-top: 18px; justify-content: flex-end; }
        .fn-cancel { padding: 9px 18px; background: transparent; border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; color: rgba(255,255,255,0.45); font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-submit { padding: 9px 22px; background: #cc0000; border: none; border-radius: 4px; color: #fff; font-family: 'Montserrat',sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
        .fn-submit:hover:not(:disabled) { background: #e60000; }
        .fn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
        .fn-spinner { display: inline-block; width: 11px; height: 11px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin-right: 5px; vertical-align: middle; }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* RIGHT SIDEBAR */
        .f-right { display: flex; flex-direction: column; gap: 14px; position: sticky; top: 80px; }
        .f-right-box { background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
        .f-right-title { font-family: 'Montserrat',sans-serif; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 6px; }
        .f-right-title.wa { color: #25d366; }
        .f-right-title.tg { color: #2aabee; }
        .f-right-title.faq { color: rgba(255,255,255,0.3); }
        .f-ext-link { display: flex; align-items: center; justify-content: space-between; padding: 9px 14px; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.15s; gap: 8px; }
        .f-ext-link:last-child { border-bottom: none; }
        .f-ext-link:hover { background: rgba(255,255,255,0.03); }
        .f-ext-link.main { background: rgba(37,211,102,0.04); border-left: 2px solid #25d366; }
        .f-ext-link.main-tg { background: rgba(42,171,238,0.04); border-left: 2px solid #2aabee; }
        .f-ext-name { font-size: 11px; color: rgba(255,255,255,0.6); flex: 1; }
        .f-ext-link.main .f-ext-name { color: #fff; font-weight: 600; }
        .f-ext-sub { font-size: 9px; color: rgba(255,255,255,0.25); white-space: nowrap; }
        .f-ext-arrow { font-size: 11px; color: rgba(255,255,255,0.2); flex-shrink: 0; }
        .f-faq-item { padding: 9px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; transition: background 0.15s; }
        .f-faq-item:last-child { border-bottom: none; }
        .f-faq-item:hover { background: rgba(255,255,255,0.03); }
        .f-faq-title { font-size: 11px; color: rgba(255,255,255,0.6); line-height: 1.4; margin-bottom: 3px; }
        .f-faq-meta { font-size: 9px; color: rgba(255,255,255,0.25); }
        /* EMPTY */
        .f-empty { padding: 48px 24px; text-align: center; color: rgba(255,255,255,0.2); font-size: 13px; font-style: italic; background: rgba(14,14,14,0.9); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; }
        /* RESPONSIVE */
        @media (max-width: 1100px) { .f-layout { grid-template-columns: 160px 1fr; } .f-right { display: none; } }
        @media (max-width: 700px) { .f-layout { grid-template-columns: 1fr; } .f-left { position: static; flex-direction: row; overflow-x: auto; } .f-side-box { min-width: 160px; } }
      `}</style>

      <div className="f-layout">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="f-left">
          <div className="f-side-box">
            <div className="f-side-title">Categorías</div>
            <div className={`f-side-item${catFilter === "todas" ? " active" : ""}`} onClick={() => applyFilter({ cat: "todas" })}>Todos los temas</div>
            {categories.map(c => (
              <div key={c.id} className={`f-side-item${catFilter === c.id ? " active" : ""}`} onClick={() => { setMainTab("temas"); applyFilter({ cat: c.id }); }}>{c.name}</div>
            ))}
          </div>
          <div className="f-side-box">
            <div className="f-side-title">Estado</div>
            {[["todas","Todos"],["open","Abiertos"],["resolved","Resueltos"]].map(([v,l]) => (
              <div key={v} className={`f-side-item${statusFilter === v ? " active" : ""}`} onClick={() => applyFilter({ status: v })}>{l}</div>
            ))}
          </div>
        </aside>

        {/* ── CENTER ── */}
        <div className="f-center">
          {/* Tabs */}
          <div className="f-tabs">
            <button className={`f-tab${mainTab === "temas" ? " active" : ""}`} onClick={() => { setMainTab("temas"); setVista("lista"); }}>💬 Temas</button>
            <button className={`f-tab${mainTab === "chat" ? " active" : ""}`} onClick={() => setMainTab("chat")}>⚡ Chat en vivo</button>
            <button className={`f-tab${mainTab === "faq" ? " active" : ""}`} onClick={() => setMainTab("faq")}>✓ Resueltos</button>
          </div>
<div className="f-avatar" style={{cursor:"pointer"}} onClick={() => setPerfilRapidoId(r.author_id)}>
  {initials(r.perfiles)}
</div>
          {/* ── TAB TEMAS ── */}
          {mainTab === "temas" && vista === "lista" && (
            <>
              <div className="f-topbar">
                <div className="f-search">
                  <span className="f-search-ico">🔍</span>
                  <input placeholder="Buscar en el foro..." value={search} onChange={e => handleSearch(e.target.value)} />
                </div>
                <button className="f-btn-urgente" onClick={() => applyFilter({ status: "todas" })}>⚡ Urgentes</button>
                <button className="f-btn-nuevo" onClick={() => { setMainTab("temas"); setVista("nuevo"); }}>+ Nueva consulta</button>
              </div>
              <div className="f-filtros">
                {[["todas","Todos"],["open","Abiertos"],["resolved","Resueltos"]].map(([v,l]) => (
                  <button key={v} className={`f-filtro${statusFilter === v ? " active" : ""}`} onClick={() => applyFilter({ status: v })}>{l}</button>
                ))}
              </div>
              {loading ? <div className="f-empty">Cargando...</div> :
               topics.length === 0 ? <div className="f-empty">No hay temas todavía. ¡Publicá la primera consulta!</div> :
               topics.map(t => <TopicCard key={t.id} t={t} onClick={() => openTopic(t)} />)
              }
            </>
          )}

          {/* ── DETALLE TEMA ── */}
          {mainTab === "temas" && vista === "detalle" && topic && (
            <div className="f-detalle">
              <button className="f-back" onClick={() => { setVista("lista"); loadTopics(); }}>← Volver</button>
              <div className="f-card">
                <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                  {topic.forum_categories && <span className="f-badge cat">{topic.forum_categories.name}</span>}
                  {topic.is_urgent && <span className="f-badge urg">⚡ Urgente</span>}
                  {topic.status === "resolved" && <span className="f-badge res">✓ Resuelto</span>}
                </div>
                <div className="f-card-title">{topic.title}</div>
                <div className="f-card-meta">
                  <div className="f-avatar">{initials(topic.perfiles)}</div>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.7)"}}>{fullName(topic.perfiles)}</div>
                    {topic.perfiles?.matricula && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'Montserrat',sans-serif"}}>Mat. {topic.perfiles.matricula}</div>}
                  </div>
                  <span className="f-meta" style={{marginLeft:6}}>{timeAgo(topic.created_at)}</span>
                  <span className="f-meta">👁 {topic.view_count}</span>
                  <span className="f-meta">💬 {topic.replies_count}</span>
                </div>
                <div className="f-card-body">{topic.body}</div>
                {(topic.forum_topic_tags ?? []).length > 0 && (
                  <div className="f-tags-row" style={{marginTop:14}}>
                    {(topic.forum_topic_tags ?? []).map((tt: any) => <span key={tt.forum_tags?.id} className="f-tag">{tt.forum_tags?.name}</span>)}
                  </div>
                )}
              </div>
              {replies.length > 0 && (
                <div>
                  <div className="f-replies-title">{replies.length} {replies.length === 1 ? "Respuesta" : "Respuestas"}</div>
                  {[...replies].sort((a,b) => (b.is_accepted?1:0)-(a.is_accepted?1:0)).map(r => (
                    <div key={r.id} className={`f-reply${r.is_accepted?" accepted":""}`}>
                      <div className="f-reply-meta">
                        <div className="f-avatar">{initials(r.perfiles)}</div>
                        <div>
                          <div style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,0.7)"}}>{fullName(r.perfiles)}</div>
                          {r.perfiles?.matricula && <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'Montserrat',sans-serif"}}>Mat. {r.perfiles.matricula}</div>}
                        </div>
                        <span className="f-meta" style={{marginLeft:6}}>{timeAgo(r.created_at)}</span>
                      </div>
                      <div className="f-reply-body">{r.body}</div>
                      <div className="f-reply-actions">
                        <button className={`f-vote up${r._myVote===1?" voted":""}`} onClick={() => voteReply(r,1)}>▲ {(r._voteCount??0)>0?`+${r._voteCount}`:r._voteCount??0}</button>
                        <button className={`f-vote down${r._myVote===-1?" voted":""}`} onClick={() => voteReply(r,-1)}>▼</button>
                        {topic.author_id === userId && !r.is_accepted && !topic.is_locked && (
                          <button className="f-accept-btn" onClick={() => acceptReply(r)}>✓ Marcar destacada</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!topic.is_locked ? (
                <div className="f-editor">
                  <div className="f-editor-title">Tu respuesta</div>
                  <textarea className="f-textarea" placeholder="Escribí tu respuesta..." value={replyBody} onChange={e => setReplyBody(e.target.value)} disabled={replyLoading} />
                  <button className="f-submit" onClick={submitReply} disabled={replyLoading || !replyBody.trim()}>
                    {replyLoading && <span className="fn-spinner"/>}{replyLoading ? "Publicando..." : "Publicar respuesta"}
                  </button>
                </div>
              ) : (
                <div style={{padding:"12px 16px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,fontSize:12,color:"rgba(255,255,255,0.3)",textAlign:"center"}}>🔒 Tema cerrado</div>
              )}
            </div>
            {perfilRapidoId && (
  <PerfilRapidoModal
    perfilId={perfilRapidoId}
    miUserId={userId}
    onClose={() => setPerfilRapidoId(null)}
  />
)}
          )}

          {/* ── NUEVO TEMA ── */}
          {mainTab === "temas" && vista === "nuevo" && (
            <div className="f-nuevo">
              <div className="f-nuevo-title">Nueva <span>consulta</span></div>
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
                <textarea className="f-textarea" placeholder="Describí tu consulta con detalle..." value={nBody} onChange={e => setNBody(e.target.value)} style={{minHeight:120}} />
              </div>
              <div className="fn-field">
                <label className="fn-label">Tags * (al menos 1)</label>
                <div className="fn-tags">
                  {tags.map(t => (
                    <button key={t.id} type="button" className={`fn-tag${nTags.includes(t.id)?" active":""}`} onClick={() => setNTags(prev => prev.includes(t.id) ? prev.filter(x=>x!==t.id) : [...prev,t.id])}>{t.name}</button>
                  ))}
                </div>
              </div>
              <div className="fn-field">
                <div className={`fn-urg${nUrgent?" active":""}`} onClick={() => setNUrgent(u=>!u)}>
                  <span style={{fontSize:16}}>⚡</span>
                  <div style={{flex:1}}><div className="fn-urg-t">Marcar como urgente</div><div className="fn-urg-d">Notifica a todos y aparece destacado</div></div>
                  <div style={{width:34,height:18,borderRadius:9,background:nUrgent?"#eab308":"rgba(255,255,255,0.1)",position:"relative",transition:"background 0.2s",flexShrink:0}}>
                    <div style={{position:"absolute",top:2,left:nUrgent?18:2,width:14,height:14,borderRadius:"50%",background:"#fff",transition:"left 0.2s"}}/>
                  </div>
                </div>
              </div>
              {nError && <div className="fn-error">{nError}</div>}
              <div className="fn-actions">
                <button className="fn-cancel" onClick={() => setVista("lista")}>Cancelar</button>
                <button className="fn-submit" onClick={submitTopic} disabled={nLoading}>
                  {nLoading && <span className="fn-spinner"/>}{nLoading ? "Publicando..." : "Publicar consulta"}
                </button>
              </div>
            </div>
          )}

          {/* ── TAB CHAT ── */}
          {mainTab === "chat" && (
            <div className="f-chat">
              <div className="f-chat-header">
                <div className="f-chat-live"/>
                <span className="f-chat-header-title">Chat General — En vivo</span>
                <span style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginLeft:"auto"}}>Mensajes en tiempo real</span>
              </div>
              <div className="f-chat-msgs">
                {chatMsgs.length === 0 && <div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",fontSize:13,fontStyle:"italic",marginTop:32}}>No hay mensajes todavía. ¡Sé el primero!</div>}
                {chatMsgs.map(m => (
                  <div key={m.id} className={`f-chat-msg${m.user_id === userId ? " mine" : ""}`}>
                    <div className="f-chat-avatar">{initials(m.perfiles)}</div>
                    <div className="f-chat-bubble">
                      <div className="f-chat-name">{fullName(m.perfiles)}{m.perfiles?.matricula ? ` · Mat. ${m.perfiles.matricula}` : ""}</div>
                      <div className="f-chat-text">{m.body}</div>
                      <div className="f-chat-time">{timeAgo(m.created_at)}</div>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef}/>
              </div>
              <div className="f-chat-input">
                <input
                  placeholder="Escribí un mensaje..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                  disabled={chatLoading}
                />
                <button className="f-chat-send" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>Enviar</button>
              </div>
            </div>
          )}

          {/* ── TAB FAQ / RESUELTOS ── */}
          {mainTab === "faq" && (
            <>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:11,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"rgba(255,255,255,0.4)"}}>Últimas consultas resueltas</div>
                <button className="f-btn-nuevo" onClick={() => { setMainTab("temas"); setVista("nuevo"); }}>+ Nueva consulta</button>
              </div>
              {faqTopics.length === 0 ? <div className="f-empty">No hay consultas resueltas todavía.</div> :
               faqTopics.map(t => <TopicCard key={t.id} t={t} onClick={() => { setMainTab("temas"); openTopic(t); }} />)
              }
            </>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ── */}
        <aside className="f-right">
          {/* WhatsApp */}
          <div className="f-right-box">
            <div className="f-right-title wa">💬 Grupos WhatsApp</div>
            {WA_GROUPS.map(g => (
              <a key={g.name} href={g.url} target="_blank" rel="noopener noreferrer" className={`f-ext-link${g.main?" main":""}`}>
                <span className="f-ext-name">{g.name}</span>
                {g.sub && <span className="f-ext-sub">{g.sub}</span>}
                <span className="f-ext-arrow">↗</span>
              </a>
            ))}
          </div>
          {/* Telegram */}
          <div className="f-right-box">
            <div className="f-right-title tg">✈️ Grupos Telegram</div>
            {TG_GROUPS.map(g => (
              <a key={g.name} href={g.url} target="_blank" rel="noopener noreferrer" className={`f-ext-link${g.main?" main-tg":""}`}>
                <span className="f-ext-name">{g.name}</span>
                {g.sub && <span className="f-ext-sub">{g.sub}</span>}
                <span className="f-ext-arrow">↗</span>
              </a>
            ))}
          </div>
          {/* Últimas resueltas */}
          <div className="f-right-box">
            <div className="f-right-title faq">✓ Últimas resueltas</div>
            {faqTopics.slice(0,5).map(t => (
              <div key={t.id} className="f-faq-item" onClick={() => { setMainTab("temas"); openTopic(t); }}>
                <div className="f-faq-title">{t.title}</div>
                <div className="f-faq-meta">{t.forum_categories?.name} · {timeAgo(t.last_activity_at)}</div>
              </div>
            ))}
            {faqTopics.length === 0 && <div style={{padding:"12px 14px",fontSize:11,color:"rgba(255,255,255,0.2)",fontStyle:"italic"}}>Sin resueltas todavía</div>}
          </div>
        </aside>
      </div>
    </>
  );
}
