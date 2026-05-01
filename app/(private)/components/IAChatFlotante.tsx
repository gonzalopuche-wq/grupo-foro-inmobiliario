'use client'

import { useState, useRef, useEffect } from 'react'

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
      const res = await fetch('/api/ia-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: texto, historial }),
      })
      const { respuesta } = await res.json()
      setMensajes(prev => [...prev, { rol: 'ia', texto: respuesta, ts: Date.now() }])
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
        .gfi-chat-btn { position: fixed; bottom: 24px; right: 24px; width: 52px; height: 52px; border-radius: 50%; background: #cc0000; border: none; cursor: pointer; z-index: 9000; display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 4px 20px rgba(204,0,0,0.4); transition: transform 0.2s, box-shadow 0.2s; }
        .gfi-chat-btn:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(204,0,0,0.5); }
        .gfi-chat-window { position: fixed; bottom: 88px; right: 24px; width: 340px; max-height: 520px; background: #141414; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; z-index: 9000; display: flex; flex-direction: column; box-shadow: 0 8px 40px rgba(0,0,0,0.5); animation: chatSlideIn 0.25s ease; }
        @keyframes chatSlideIn { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: none; } }
        .gfi-chat-header { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.07); display: flex; align-items: center; justify-content: space-between; }
        .gfi-chat-body { flex: 1; overflow-y: auto; padding: 14px 14px 8px; display: flex; flex-direction: column; gap: 10px; min-height: 200px; max-height: 340px; }
        .gfi-msg { max-width: 85%; padding: 9px 13px; border-radius: 10px; font-size: 13px; line-height: 1.5; }
        .gfi-msg-user { background: rgba(204,0,0,0.15); border: 1px solid rgba(204,0,0,0.2); color: #fff; align-self: flex-end; border-bottom-right-radius: 3px; }
        .gfi-msg-ia { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); align-self: flex-start; border-bottom-left-radius: 3px; }
        .gfi-chat-input-row { padding: 10px 12px; border-top: 1px solid rgba(255,255,255,0.07); display: flex; gap: 8px; align-items: center; }
        .gfi-chat-input { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff; padding: 8px 12px; font-size: 13px; font-family: inherit; outline: none; }
        .gfi-chat-input:focus { border-color: rgba(204,0,0,0.4); }
        .gfi-chat-send { width: 34px; height: 34px; border-radius: 8px; background: #cc0000; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; opacity: 1; transition: opacity 0.15s; }
        .gfi-chat-send:disabled { opacity: 0.4; cursor: default; }
        .gfi-typing { display: flex; gap: 4px; align-items: center; padding: 4px 2px; }
        .gfi-dot { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.4); animation: gfiDot 1.2s infinite; }
        .gfi-dot:nth-child(2) { animation-delay: 0.2s; }
        .gfi-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes gfiDot { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.1); } }
        @media (max-width: 480px) { .gfi-chat-window { width: calc(100vw - 32px); right: 16px; bottom: 80px; } .gfi-chat-btn { right: 16px; bottom: 16px; } }
      `}</style>

      {/* Botón flotante */}
      <button className="gfi-chat-btn" onClick={() => setAbierto(a => !a)} title="Asistente IA GFI">
        {abierto ? '✕' : '🤖'}
      </button>

      {/* Ventana de chat */}
      {abierto && (
        <div className="gfi-chat-window">
          {/* Header */}
          <div className="gfi-chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(204,0,0,0.15)', border: '1px solid rgba(204,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
              <div>
                <div style={{ fontFamily: 'Montserrat,sans-serif', fontSize: 13, fontWeight: 700, color: '#fff' }}>Asistente GFI®</div>
                <div style={{ fontSize: 10, color: '#22c55e', fontFamily: 'Montserrat,sans-serif', fontWeight: 600 }}>● En línea</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {mensajes.length > 1 && (
                <button onClick={limpiar} title="Limpiar conversación" style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.35)', fontSize: 11, padding: '4px 8px', cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
                  Limpiar
                </button>
              )}
              <button onClick={() => setAbierto(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: 4 }}>✕</button>
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
