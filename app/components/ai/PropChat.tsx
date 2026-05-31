"use client";
import { useChat } from "ai/react";
import { useRef, useEffect } from "react";

interface PropCardMiniProps {
  id: string;
  titulo: string;
  operacion: string;
  tipo: string;
  precio: number | null;
  moneda: string;
  zona?: string | null;
  ciudad?: string | null;
  dormitorios?: number | null;
  banos?: number | null;
  superficie_cubierta?: number | null;
  foto?: string | null;
  slug: string;
}

function PropCardMini({ id, titulo, operacion, tipo, precio, moneda, zona, ciudad, dormitorios, superficie_cubierta, foto, slug }: PropCardMiniProps) {
  const precioStr = precio
    ? (moneda === "USD" ? `USD ${precio.toLocaleString("es-AR")}` : `$ ${precio.toLocaleString("es-AR")}`)
    : null;
  return (
    <a
      href={`/web/${slug}/propiedad/${id}`}
      style={{
        display: "flex", gap: 10, background: "#fff",
        border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden",
        textDecoration: "none", color: "inherit",
        transition: "box-shadow 0.15s",
      }}
    >
      <div style={{ width: 80, minWidth: 80, height: 70, background: "#f3f4f6", overflow: "hidden" }}>
        {foto
          ? <img src={foto} alt={titulo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: 20, color: "#9ca3af" }}>🏠</div>
        }
      </div>
      <div style={{ padding: "8px 10px 8px 0", flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{titulo}</div>
        {(zona || ciudad) && (
          <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>📍 {[zona, ciudad].filter(Boolean).join(", ")}</div>
        )}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {precioStr && <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{precioStr}</span>}
          {dormitorios && <span style={{ fontSize: 10, background: "#f3f4f6", padding: "1px 5px", borderRadius: 3 }}>🛏 {dormitorios}</span>}
          {superficie_cubierta && <span style={{ fontSize: 10, background: "#f3f4f6", padding: "1px 5px", borderRadius: 3 }}>📐 {superficie_cubierta}m²</span>}
          <span style={{ fontSize: 10, color: "#6b7280" }}>{operacion} · {tipo}</span>
        </div>
      </div>
    </a>
  );
}

function ToolResult({ toolName, result, slug }: { toolName: string; result: any; slug: string }) {
  if (toolName !== "searchProperties" || !result?.propiedades) return null;
  const { propiedades, total } = result;
  if (total === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>
        {total} propiedad{total !== 1 ? "es" : ""} encontrada{total !== 1 ? "s" : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {propiedades.slice(0, 6).map((p: any) => (
          <PropCardMini key={p.id} {...p} slug={slug} />
        ))}
      </div>
    </div>
  );
}

interface Props {
  slug: string;
  placeholder?: string;
}

export default function PropChat({ slug, placeholder = "Ej: busco departamento 2 dormitorios en venta hasta USD 100.000" }: Props) {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({
    api: `/api/web/${slug}/chat`,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 0 }}>
      {messages.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0 20px", color: "#6b7280", fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✨</div>
          <div style={{ fontWeight: 600, color: "#111827", marginBottom: 4 }}>Buscador inteligente</div>
          <div>Describí lo que buscás y te ayudo a encontrarlo</div>
        </div>
      )}

      {messages.length > 0 && (
        <div style={{ maxHeight: 480, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: "0 0 12px", marginBottom: 12 }}>
          {messages.map(msg => (
            <div key={msg.id} style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "85%", padding: "8px 12px",
                background: msg.role === "user" ? "#111827" : "#f3f4f6",
                color: msg.role === "user" ? "#fff" : "#111827",
                borderRadius: msg.role === "user" ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
                fontSize: 13, lineHeight: "1.5",
              }}>
                {msg.content || (isLoading && msg.role === "assistant" ? "Buscando..." : null)}
              </div>

              {msg.toolInvocations?.map(inv => (
                inv.state === "result" && (
                  <div key={inv.toolCallId} style={{ maxWidth: "90%", width: "100%" }}>
                    <ToolResult toolName={inv.toolName} result={inv.result} slug={slug} />
                  </div>
                )
              ))}
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div style={{ fontSize: 13, color: "#6b7280", padding: "4px 12px" }}>Buscando propiedades...</div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", color: "#b91c1c", fontSize: 12, marginBottom: 10 }}>
          {error.message}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={isLoading}
          style={{
            flex: 1, padding: "10px 14px", border: "1px solid #d1d5db",
            borderRadius: 8, fontSize: 14, outline: "none", fontFamily: "inherit",
            background: isLoading ? "#f9fafb" : "#fff",
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            padding: "10px 20px", background: "#111827", color: "#fff",
            border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600,
            cursor: isLoading ? "wait" : "pointer", fontFamily: "inherit",
            opacity: isLoading || !input.trim() ? 0.6 : 1,
          }}
        >
          {isLoading ? "..." : "✨"}
        </button>
      </form>
    </div>
  );
}
