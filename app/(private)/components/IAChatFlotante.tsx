'use client'

import { useState, useRef, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface Mensaje {
  rol: 'user' | 'ia'
  texto: string
  ts: number
}

export default function IAChatFlotante() {
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (abierto) {
      setTimeout(() => inputRef.current?.focus(), 100)
      if (mensajes.length === 0) {
        setMensajes([{
          rol: 'ia',
          texto: '¡Hola! Soy el asistente IA de GFI®. Puedo ayudarte con la plataforma, redacción de textos, cálculos inmobiliarios o consultas del sector. ¿En qué te ayudo?',
          ts: Date.now(),
        }])
      }
    }
  }, [abierto])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  const enviar = async () => {
    const texto = input.trim()
    if (!texto || cargando) return
    setInput('')

    const userMsg: Mensaje = { rol: 'user', texto, ts: Date.now() }
    setMensajes(prev => [...prev, userMsg])
    setCargando(true)

    try {
      const historial = mensajes.map(m => ({ rol: m.rol === 'user' ? 'user' : 'assistant', texto: m.texto }))
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/ia-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ mensaje: texto, historial }),
      })

      if (!res.ok) {
        const msg = res.status === 429 ? 'Demasiadas consultas, esperá un momento.' : 'Error al conectar con la IA.'
        setMensajes(prev => [...prev, { rol: 'ia', texto: msg, ts: Date.now() }])
        setCargando(false)
        return
      }
      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let textoAcumulado = ''
      let primerChunk = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data)
            if (parsed.error) {
              setMensajes(prev => [...prev, { rol: 'ia', texto: parsed.error, ts: Date.now() }])
              setCargando(false)
              break
            }
            if (parsed.text) {
              textoAcumulado += parsed.text
              if (primerChunk) {
                primerChunk = false
                setCargando(false)
                setMensajes(prev => [...prev, { rol: 'ia', texto: textoAcumulado, ts: Date.now() }])
              } else {
                setMensajes(prev => {
                  const msgs = [...prev]
                  msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], texto: textoAcumulado }
                  return msgs
                })
              }
            }
          } catch { /* ignorar errores de parse */ }
        }
      }

      if (primerChunk) {
        setMensajes(prev => [...prev, { rol: 'ia', texto: 'No pude generar una respuesta. Intentá de nuevo.', ts: Date.now() }])
      }
    } catch {
      setMensajes(prev => [...prev, { rol: 'ia', texto: 'Error al conectar con la IA. Intentá de nuevo.', ts: Date.now() }])
    } finally {
      setCargando(false)
    }
  }

  const limpiar = () => setMensajes([])

  return (
    <>
      <style>{`
        /* ── Chat Flotante GFI® ── */
        .gfi-chat-btn {
          position: fixed; bottom: 24px; right: 24px;
          width: 54px; height: 54px; border-radius: 50%;
          background: linear-gradient(135deg, #cc0000 0%, #e8002d 100%);
          border: none; cursor: pointer; z-index: 9000;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          box-shadow: 0 4px 20px rgba(204,0,0,0.45), 0 0 0 0 rgba(204,0,0,0.3);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .gfi-chat-btn:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 0 8px 32px rgba(204,0,0,0.60), 0 0 0 8px rgba(204,0,0,0.08);
        }

        /* Window */
        .gfi-chat-window {
          position: fixed; bottom: 92px; right: 24px;
          width: 348px; max-height: 540px;
          background: #0f1219;
          border: 1px solid #252a35;
          border-top: 1px solid rgba(204,0,0,0.25);
          border-radius: 14px;
          z-index: 9000; display: flex; flex-direction: column;
          box-shadow: 0 16px 56px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.03) inset;
          animation: chatSlideIn 0.22s cubic-bezier(0.4,0,0.2,1);
          overflow: hidden;
        }
        @keyframes chatSlideIn {
          from { opacity: 0; transform: translateY(14px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Header */
        .gfi-chat-header {
          padding: 14px 16px;
          border-bottom: 1px solid #1c2030;
          display: flex; align-items: center; justify-content: space-between;
          background: linear-gradient(90deg, rgba(204,0,0,0.07) 0%, transparent 60%);
          flex-shrink: 0;
        }

        /* Messages body */
        .gfi-chat-body {
          flex: 1; overflow-y: auto; padding: 14px 12px 8px;
          display: flex; flex-direction: column; gap: 8px;
          min-height: 200px; max-height: 360px;
          scrollbar-width: thin; scrollbar-color: rgba(204,0,0,0.3) transparent;
        }
        .gfi-chat-body::-webkit-scrollbar { width: 3px; }
        .gfi-chat-body::-webkit-scrollbar-thumb { background: rgba(204,0,0,0.3); border-radius: 2px; }

        /* Messages */
        .gfi-msg {
          max-width: 86%; padding: 9px 13px;
          border-radius: 10px; font-size: 13px; line-height: 1.55;
          font-family: 'Inter', sans-serif;
        }
        .gfi-msg-user {
          background: rgba(204,0,0,0.14);
          border: 1px solid rgba(204,0,0,0.25);
          color: #f0f4f8;
          align-self: flex-end;
          border-bottom-right-radius: 3px;
        }
        .gfi-msg-ia {
          background: #161b24;
          border: 1px solid #252a35;
          color: #8892a4;
          align-self: flex-start;
          border-bottom-left-radius: 3px;
        }
        .gfi-msg-ia strong { color: #f0f4f8; }

        /* Input row */
        .gfi-chat-input-row {
          padding: 10px 12px;
          border-top: 1px solid #1c2030;
          display: flex; gap: 8px; align-items: center;
          background: #0d1017;
          flex-shrink: 0;
        }
        .gfi-chat-input {
          flex: 1; background: #111318;
          border: 1px solid #252a35; border-radius: 8px;
          color: #f0f4f8; padding: 9px 12px;
          font-size: 13px; font-family: 'Inter', sans-serif;
          outline: none; transition: border-color 0.15s;
        }
        .gfi-chat-input:focus {
          border-color: rgba(204,0,0,0.5);
          box-shadow: 0 0 0 3px rgba(204,0,0,0.10);
        }
        .gfi-chat-input::placeholder { color: #4a5568; }
        .gfi-chat-send {
          width: 36px; height: 36px; border-radius: 8px;
          background: linear-gradient(135deg, #cc0000 0%, #e8002d 100%);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; flex-shrink: 0;
          transition: all 0.15s;
          box-shadow: 0 2px 8px rgba(204,0,0,0.35);
        }
        .gfi-chat-send:hover:not(:disabled) { transform: scale(1.08); box-shadow: 0 4px 14px rgba(204,0,0,0.50); }
        .gfi-chat-send:disabled { opacity: 0.35; cursor: default; box-shadow: none; }

        /* Typing */
        .gfi-typing { display: flex; gap: 4px; align-items: center; padding: 4px 2px; }
        .gfi-dot { width: 6px; height: 6px; border-radius: 50%; background: #4a5568; animation: gfiDot 1.2s infinite; }
        .gfi-dot:nth-child(2) { animation-delay: 0.2s; }
        .gfi-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes gfiDot { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.1); } }

        @media (max-width: 480px) {
          .gfi-chat-window { width: calc(100vw - 24px); right: 12px; bottom: 84px; }
          .gfi-chat-btn { right: 16px; bottom: 78px; }
        }
      `}</style>

      {/* Botón flotante */}
      <button className="gfi-chat-btn" onClick={() => setAbierto(a => !a)} title="Asistente IA GFI">
        {abierto ? '✕' : '◈'}
      </button>

      {/* Ventana de chat */}
      {abierto && (
        <div className="gfi-chat-window">
          {/* Header */}
          <div className="gfi-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 8,
                background: 'linear-gradient(135deg, rgba(204,0,0,0.20) 0%, rgba(204,0,0,0.08) 100%)',
                border: '1px solid rgba(204,0,0,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, boxShadow: '0 0 12px rgba(204,0,0,0.20)',
              }}>◈</div>
              <div>
                <div style={{ fontFamily: "'Montserrat',sans-serif", fontSize: 13, fontWeight: 800, color: '#f0f4f8', letterSpacing: '0.04em' }}>Asistente GFI®</div>
                <div style={{ fontSize: 9, color: '#10b981', fontFamily: "'Montserrat',sans-serif", fontWeight: 700, letterSpacing: '0.10em', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 5px #10b981', display: 'inline-block' }} />
                  EN LÍNEA
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {mensajes.length > 1 && (
                <button onClick={limpiar} title="Limpiar conversación" style={{
                  background: 'transparent', border: '1px solid #252a35',
                  borderRadius: 6, color: '#8892a4', fontSize: 10,
                  padding: '4px 10px', cursor: 'pointer',
                  fontFamily: "'Montserrat',sans-serif", fontWeight: 700,
                  letterSpacing: '0.06em', textTransform: 'uppercase', transition: 'all 0.15s',
                }}>
                  Limpiar
                </button>
              )}
              <button onClick={() => setAbierto(false)} style={{
                background: 'transparent', border: '1px solid #252a35',
                borderRadius: 6, color: '#4a5568', fontSize: 16,
                cursor: 'pointer', lineHeight: 1, padding: '4px 8px', transition: 'all 0.15s',
              }}>✕</button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="gfi-chat-body">
            {mensajes.map((m, i) => (
              <div key={i} className={`gfi-msg ${m.rol === 'user' ? 'gfi-msg-user' : 'gfi-msg-ia'}`}>
                {m.texto}
              </div>
            ))}
            {cargando && (
              <div className="gfi-msg gfi-msg-ia">
                <div className="gfi-typing">
                  <div className="gfi-dot" />
                  <div className="gfi-dot" />
                  <div className="gfi-dot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="gfi-chat-input-row">
            <input
              ref={inputRef}
              className="gfi-chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
              placeholder="Escribí tu consulta..."
              disabled={cargando}
            />
            <button className="gfi-chat-send" onClick={enviar} disabled={!input.trim() || cargando}>
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  )
}
