'use client'
import { useState, useEffect, useRef } from 'react'

const STATS = [
  { valor: '2ª', label: 'Circunscripción COCIR', sub: 'Rosario y zona' },
  { valor: '500+', label: 'Corredores activos', sub: 'y creciendo' },
  { valor: '12', label: 'Módulos integrados', sub: 'en una sola plataforma' },
  { valor: '100%', label: 'Hecho en Argentina', sub: 'para el mercado local' },
]

const MODULOS = [
  { icon: '🏠', titulo: 'Cartera Digital', desc: 'Gestión completa de propiedades con fotos, planos, documentos y publicación automática.' },
  { icon: '👥', titulo: 'CRM Inmobiliario', desc: 'Contactos, seguimiento de leads, interacciones y propuestas personalizadas.' },
  { icon: '🤝', titulo: 'Red GFI (MIR)', desc: 'Mercado interno de colaboración entre corredores de la 2ª Circunscripción.' },
  { icon: '🤖', titulo: 'Asistente IA', desc: 'Generación de descripciones, análisis de mercado, contratos y respuestas automáticas.' },
  { icon: '📊', titulo: 'Estadísticas de Mercado', desc: 'Datos reales del mercado de Rosario: precios, zonas, tendencias en tiempo real.' },
  { icon: '📅', titulo: 'Eventos & Capacitación', desc: 'Agenda de cursos, seminarios y eventos del sector inmobiliario.' },
]

const VIDEOS = [
  {
    titulo: 'GFI — La plataforma que el corredor inmobiliario argentino necesitaba',
    desc: 'Conocé todo lo que incluye la membresía GFI y cómo transforma el día a día del corredor.',
    duracion: '3:45',
    tag: 'Presentación general',
  },
  {
    titulo: 'Cartera + CRM: tu negocio organizado en un solo lugar',
    desc: 'Mostramos el flujo completo: desde captar una propiedad hasta cerrar el negocio con el CRM.',
    duracion: '2:20',
    tag: 'Demo del producto',
  },
  {
    titulo: 'Red GFI: colaboración entre corredores de Rosario',
    desc: 'Cómo funciona el mercado interno de referidos y colaboración entre miembros de GFI.',
    duracion: '1:50',
    tag: 'Red de colaboración',
  },
  {
    titulo: 'IA al servicio del corredor inmobiliario',
    desc: 'En tiempo real: generación de descripciones, análisis de mercado y propuestas de captación.',
    duracion: '2:10',
    tag: 'Inteligencia Artificial',
  },
]

function VideoPlaceholder({ video, destacado = false }: { video: typeof VIDEOS[0]; destacado?: boolean }) {
  const [hover, setHover] = useState(false)
  const ratio = destacado ? '56.25%' : '56.25%'

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: `1px solid ${hover ? 'rgba(153,0,0,0.4)' : 'rgba(255,255,255,0.08)'}`,
        transition: 'border-color 0.3s, transform 0.3s, box-shadow 0.3s',
        transform: hover ? 'translateY(-4px)' : 'none',
        boxShadow: hover ? '0 12px 40px rgba(153,0,0,0.2)' : '0 4px 20px rgba(0,0,0,0.3)',
        background: '#111',
        cursor: 'default',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Placeholder de video */}
      <div style={{ position: 'relative', paddingBottom: ratio, background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 50%, #0d0d0d 100%)' }}>
        {/* Patrón de fondo */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />

        {/* Logo GFI de fondo */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: 0.04, fontSize: 120, fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#fff',
          userSelect: 'none', pointerEvents: 'none',
        }}>GFI</div>

        {/* Tag */}
        <div style={{
          position: 'absolute', top: 16, left: 16,
          background: 'rgba(153,0,0,0.9)', color: '#fff',
          fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', textTransform: 'uppercase',
          padding: '4px 10px', borderRadius: 4,
        }}>{video.tag}</div>

        {/* Botón de play */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 12,
        }}>
          <div style={{
            width: destacado ? 80 : 64, height: destacado ? 80 : 64, borderRadius: '50%',
            background: 'rgba(153,0,0,0.15)', border: '2px solid rgba(153,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.3s, transform 0.3s',
            transform: hover ? 'scale(1.1)' : 'scale(1)',
          }}>
            <div style={{
              width: 0, height: 0,
              borderStyle: 'solid',
              borderWidth: `${destacado ? 14 : 11}px 0 ${destacado ? 14 : 11}px ${destacado ? 24 : 20}px`,
              borderColor: `transparent transparent transparent #990000`,
              marginLeft: 4,
            }} />
          </div>
          <span style={{
            fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>Video próximamente</span>
        </div>

        {/* Duración */}
        <div style={{
          position: 'absolute', bottom: 12, right: 12,
          background: 'rgba(0,0,0,0.8)', color: 'rgba(255,255,255,0.7)',
          fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 600,
          padding: '3px 8px', borderRadius: 4,
        }}>{video.duracion}</div>
      </div>

      {/* Info */}
      <div style={{ padding: '18px 20px 20px' }}>
        <p style={{
          margin: '0 0 8px', fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
          fontSize: destacado ? 17 : 14, color: '#fff', lineHeight: 1.4,
        }}>{video.titulo}</p>
        <p style={{
          margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6,
          fontFamily: 'Inter, sans-serif',
        }}>{video.desc}</p>
      </div>
    </div>
  )
}

function StatCard({ valor, label, sub }: typeof STATS[0]) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} style={{
      textAlign: 'center', padding: '32px 24px',
      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 16,
      opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)',
      transition: 'opacity 0.7s ease, transform 0.7s ease',
    }}>
      <div style={{
        fontFamily: 'Montserrat, sans-serif', fontWeight: 800,
        fontSize: 52, color: '#990000', lineHeight: 1,
        marginBottom: 8,
      }}>{valor}</div>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>{sub}</div>
    </div>
  )
}

export default function LanzamientoPage() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ background: '#0a0a0a', color: '#fff', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        
        * { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        .lanz-btn-primary { display:inline-block; background:#990000; color:#fff; font-family:'Montserrat',sans-serif; font-size:14px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; text-decoration:none; padding:14px 32px; border-radius:8px; transition:background 0.2s,transform 0.2s,box-shadow 0.2s; }
        .lanz-btn-primary:hover { background:#e60000; transform:translateY(-2px); box-shadow:0 8px 24px rgba(153,0,0,0.4); }
        .lanz-btn-outline { display:inline-block; background:transparent; color:#fff; font-family:'Montserrat',sans-serif; font-size:14px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; text-decoration:none; padding:13px 32px; border-radius:8px; border:1px solid rgba(255,255,255,0.25); transition:border-color 0.2s,background 0.2s,transform 0.2s; }
        .lanz-btn-outline:hover { border-color:rgba(255,255,255,0.6); background:rgba(255,255,255,0.05); transform:translateY(-2px); }
        .mod-card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:24px; transition:border-color 0.25s,background 0.25s,transform 0.25s; }
        .mod-card:hover { border-color:rgba(153,0,0,0.3); background:rgba(153,0,0,0.04); transform:translateY(-3px); }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrolled ? 'rgba(10,10,10,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255,255,255,0.07)' : 'none',
        transition: 'background 0.3s, backdrop-filter 0.3s, border-color 0.3s',
      }}>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em' }}>
          GFI<span style={{ color: '#990000' }}>®</span>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="#videos" className="lanz-btn-outline" style={{ padding: '8px 20px', fontSize: 12 }}>Ver videos</a>
          <a href="/registro" className="lanz-btn-primary" style={{ padding: '9px 20px', fontSize: 12 }}>Registrarme</a>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '120px 24px 80px', textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Fondo radial */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(153,0,0,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 800 }}>
          <div style={{
            display: 'inline-block', background: 'rgba(153,0,0,0.12)', border: '1px solid rgba(153,0,0,0.3)',
            borderRadius: 100, padding: '6px 18px', marginBottom: 32,
            fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.15em', textTransform: 'uppercase', color: '#990000',
          }}>● Plataforma en lanzamiento · 2ª Circunscripción COCIR</div>

          <h1 style={{
            fontFamily: 'Montserrat, sans-serif', fontWeight: 900,
            fontSize: 'clamp(40px, 8vw, 80px)', lineHeight: 1.05,
            margin: '0 0 24px', letterSpacing: '-0.03em',
          }}>
            La plataforma que el<br />
            <span style={{
              background: 'linear-gradient(135deg, #990000, #ff4444)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>corredor inmobiliario</span><br />
            estaba esperando.
          </h1>

          <p style={{
            fontSize: 18, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7,
            margin: '0 auto 48px', maxWidth: 580,
          }}>
            GFI® reúne en un solo lugar todo lo que necesitás para gestionar tu negocio inmobiliario: cartera, CRM, red de colaboración, estadísticas de mercado e inteligencia artificial.
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/registro" className="lanz-btn-primary">Quiero ser miembro</a>
            <a href="#videos" className="lanz-btn-outline">Ver cómo funciona</a>
          </div>

          {/* Badges */}
          <div style={{
            marginTop: 56, display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap',
          }}>
            {['✓ Sin comisiones entre miembros', '✓ Matrícula COCIR verificada', '✓ Todo en una plataforma'].map(b => (
              <span key={b} style={{
                fontSize: 13, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif',
              }}>{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section style={{ padding: '80px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20,
        }}>
          {STATS.map(s => <StatCard key={s.label} {...s} />)}
        </div>
      </section>

      {/* ── VIDEOS ── */}
      <section id="videos" style={{ padding: '80px 24px 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            display: 'inline-block', background: 'rgba(153,0,0,0.1)', border: '1px solid rgba(153,0,0,0.25)',
            borderRadius: 100, padding: '5px 16px', marginBottom: 20,
            fontFamily: 'Montserrat, sans-serif', fontSize: 10, fontWeight: 700,
            letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(153,0,0,0.8)',
          }}>Próximamente</div>
          <h2 style={{
            fontFamily: 'Montserrat, sans-serif', fontWeight: 800,
            fontSize: 'clamp(28px, 5vw, 44px)', margin: '0 0 16px', letterSpacing: '-0.02em',
          }}>Mirá GFI en acción</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', maxWidth: 500, margin: '0 auto', lineHeight: 1.6 }}>
            Estamos preparando los videos. En breve podrás ver demos en vivo de cada módulo.
          </p>
        </div>

        {/* Video principal */}
        <div style={{ marginBottom: 24 }}>
          <VideoPlaceholder video={VIDEOS[0]} destacado />
        </div>

        {/* Grid de 3 videos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {VIDEOS.slice(1).map(v => <VideoPlaceholder key={v.titulo} video={v} />)}
        </div>

        {/* Nota para el admin */}
        <div style={{
          marginTop: 32, padding: '16px 24px', background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 20 }}>💡</span>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
            <strong style={{ color: 'rgba(255,255,255,0.5)' }}>Para activar los videos:</strong> reemplazá cada bloque de placeholder con un{' '}
            <code style={{ background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 3 }}>
              {'<iframe src="https://www.youtube.com/embed/VIDEO_ID" allow="autoplay" allowFullScreen />'}
            </code>
          </p>
        </div>
      </section>

      {/* ── MÓDULOS ── */}
      <section style={{ padding: '80px 24px', background: 'rgba(255,255,255,0.015)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{
              fontFamily: 'Montserrat, sans-serif', fontWeight: 800,
              fontSize: 'clamp(28px, 5vw, 40px)', margin: '0 0 16px', letterSpacing: '-0.02em',
            }}>Todo lo que incluye tu membresía</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', maxWidth: 480, margin: '0 auto' }}>
              12 módulos integrados. Una sola plataforma. Un solo precio mensual.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {MODULOS.map(m => (
              <div key={m.titulo} className="mod-card">
                <div style={{ fontSize: 28, marginBottom: 12 }}>{m.icon}</div>
                <h3 style={{
                  fontFamily: 'Montserrat, sans-serif', fontWeight: 700,
                  fontSize: 16, margin: '0 0 8px', color: '#fff',
                }}>{m.titulo}</h3>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA CORREDORES ── */}
      <section style={{ padding: '100px 24px', maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(153,0,0,0.08) 0%, rgba(153,0,0,0.03) 100%)',
          border: '1px solid rgba(153,0,0,0.2)', borderRadius: 24,
          padding: '64px 48px',
        }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>🏡</div>
          <h2 style={{
            fontFamily: 'Montserrat, sans-serif', fontWeight: 800,
            fontSize: 'clamp(24px, 4vw, 36px)', margin: '0 0 16px', letterSpacing: '-0.02em',
          }}>¿Sos corredor matriculado en COCIR?</h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', margin: '0 0 36px', lineHeight: 1.7, maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
            Unite a GFI® hoy. Verificamos tu matrícula en el padrón COCIR y tenés acceso inmediato a toda la plataforma.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/registro" className="lanz-btn-primary">Registrarme como corredor</a>
            <a href="/login" className="lanz-btn-outline">Ya tengo cuenta</a>
          </div>
          <p style={{ marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
            El acceso requiere matrícula vigente en la 2ª Circunscripción COCIR.
          </p>
        </div>
      </section>

      {/* ── CTA SPONSORS ── */}
      <section style={{ padding: '0 24px 100px', maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 24, padding: '48px',
        }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>🤝</div>
          <h2 style={{
            fontFamily: 'Montserrat, sans-serif', fontWeight: 800,
            fontSize: 'clamp(20px, 3vw, 28px)', margin: '0 0 12px',
          }}>¿Querés llegar a los corredores de Rosario?</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', margin: '0 0 28px', lineHeight: 1.7 }}>
            GFI® ofrece espacios de sponsoreo con alcance directo a los corredores inmobiliarios de la 2ª Circunscripción. Contactanos para conocer las opciones.
          </p>
          <a
            href="mailto:admin@foroinmobiliario.com.ar?subject=Consulta%20sponsoreo%20GFI"
            className="lanz-btn-outline"
          >Contactar para sponsorear</a>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '32px 24px',
        display: 'flex', flexWrap: 'wrap', gap: 16,
        alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 1100, margin: '0 auto',
      }}>
        <div>
          <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
            GFI<span style={{ color: '#990000' }}>®</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Grupo Foro Inmobiliario · Rosario, Santa Fe
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <a href="/login" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Ingresar</a>
          <a href="/registro" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Registrarse</a>
          <a href="mailto:admin@foroinmobiliario.com.ar" style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>Contacto</a>
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>
          © {new Date().getFullYear()} GFI® — 2ª Circunscripción COCIR
        </div>
      </footer>
    </div>
  )
}
