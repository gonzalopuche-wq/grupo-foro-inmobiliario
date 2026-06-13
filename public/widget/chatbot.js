/*!
 * GFI® — Chatbot Web Embebible
 * Se instala en cualquier web con:
 *   <script src="https://www.foroinmobiliario.com.ar/widget/chatbot.js" data-slug="TU-SLUG" defer></script>
 * Muestra una burbuja de chat con IA que responde sobre las propiedades
 * publicadas del corredor y capta leads.
 */
(function () {
  "use strict";
  if (window.__gfiChatbotLoaded) return;
  window.__gfiChatbotLoaded = true;

  var ME = document.currentScript ||
    (function () {
      var s = document.querySelectorAll('script[src*="widget/chatbot.js"]');
      return s.length ? s[s.length - 1] : null;
    })();
  if (!ME) return;

  var SLUG = ME.getAttribute("data-slug");
  if (!SLUG) { console.warn("[GFI chatbot] falta data-slug en el <script>"); return; }
  var API = new URL(ME.src).origin + "/api/widget/" + encodeURIComponent(SLUG);

  var historial = [];   // [{role, content}]
  var leadEnviado = false;

  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "style") e.setAttribute("style", attrs[k]);
      else if (k === "html") e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }

  fetch(API + "/config")
    .then(function (r) { return r.json(); })
    .then(function (cfg) { if (cfg && cfg.ok && cfg.activo) init(cfg); })
    .catch(function () { /* silencioso */ });

  function init(cfg) {
    var color = cfg.color || "#6366F1";
    var ladoDerecha = cfg.posicion !== "bl";
    var nombre = cfg.nombre || "el corredor";

    injectStyles(color, ladoDerecha);

    var root = el("div", { id: "gfi-chatbot-root" });

    // ── Burbuja lanzadora ──
    var bubble = el("button", { id: "gfi-cb-bubble", "aria-label": "Abrir chat" });
    bubble.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';

    // ── Panel ──
    var panel = el("div", { id: "gfi-cb-panel", role: "dialog", "aria-label": "Chat" });

    var header = el("div", { id: "gfi-cb-header" });
    header.appendChild(el("div", { id: "gfi-cb-title", html: "Asistente de <b>" + escapeHtml(nombre) + "</b>" }));
    var btnClose = el("button", { id: "gfi-cb-close", "aria-label": "Cerrar" }, ["×"]);
    header.appendChild(btnClose);

    var msgs = el("div", { id: "gfi-cb-msgs" });
    var footer = el("div", { id: "gfi-cb-footer" });
    var input = el("input", { id: "gfi-cb-input", type: "text", placeholder: "Escribí tu consulta…", autocomplete: "off" });
    var send = el("button", { id: "gfi-cb-send", "aria-label": "Enviar" }, ["↑"]);
    footer.appendChild(input); footer.appendChild(send);

    var brand = el("div", { id: "gfi-cb-brand", html: 'con <a href="https://www.foroinmobiliario.com.ar" target="_blank" rel="noopener">GFI®</a>' });

    panel.appendChild(header);
    panel.appendChild(msgs);
    panel.appendChild(footer);
    panel.appendChild(brand);

    root.appendChild(panel);
    root.appendChild(bubble);
    document.body.appendChild(root);

    // Mensaje de bienvenida
    addMsg("assistant", cfg.bienvenida || "¡Hola! ¿En qué puedo ayudarte hoy?");

    function open() { root.classList.add("gfi-cb-open"); setTimeout(function () { input.focus(); }, 200); }
    function close() { root.classList.remove("gfi-cb-open"); }
    bubble.addEventListener("click", function () { root.classList.contains("gfi-cb-open") ? close() : open(); });
    btnClose.addEventListener("click", close);

    function addMsg(role, text) {
      var m = el("div", { "class": "gfi-cb-msg gfi-cb-" + role });
      m.appendChild(el("div", { "class": "gfi-cb-bubble-msg" }, [text]));
      msgs.appendChild(m);
      msgs.scrollTop = msgs.scrollHeight;
      return m;
    }

    function typing(on) {
      var ex = document.getElementById("gfi-cb-typing");
      if (on && !ex) {
        var t = el("div", { id: "gfi-cb-typing", "class": "gfi-cb-msg gfi-cb-assistant" });
        t.appendChild(el("div", { "class": "gfi-cb-bubble-msg gfi-cb-dots", html: "<span></span><span></span><span></span>" }));
        msgs.appendChild(t); msgs.scrollTop = msgs.scrollHeight;
      } else if (!on && ex) { ex.remove(); }
    }

    function enviar() {
      var q = input.value.trim();
      if (!q) return;
      input.value = "";
      addMsg("user", q);
      historial.push({ role: "user", content: q });
      typing(true);
      send.disabled = true;
      fetch(API + "/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pregunta: q, historial: historial.slice(-10) }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          typing(false); send.disabled = false;
          var resp = (d && d.respuesta) ? d.respuesta : "Disculpá, no pude responder ahora. Podés dejar tus datos y te contactamos.";
          addMsg("assistant", resp);
          historial.push({ role: "assistant", content: resp });
          maybeLeadCTA();
        })
        .catch(function () {
          typing(false); send.disabled = false;
          addMsg("assistant", "Hubo un problema de conexión. Probá de nuevo en un momento.");
        });
    }
    send.addEventListener("click", enviar);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") enviar(); });

    // CTA para dejar datos (aparece una vez, tras la 1ª respuesta)
    var ctaMostrado = false;
    function maybeLeadCTA() {
      if (ctaMostrado || leadEnviado) return;
      ctaMostrado = true;
      var cta = el("button", { "class": "gfi-cb-cta" }, ["📝 Dejar mis datos para que me contacten"]);
      cta.addEventListener("click", function () { cta.remove(); mostrarFormLead(); });
      msgs.appendChild(cta); msgs.scrollTop = msgs.scrollHeight;
    }

    function mostrarFormLead() {
      if (leadEnviado) return;
      var form = el("div", { "class": "gfi-cb-lead" });
      var n = el("input", { type: "text", placeholder: "Tu nombre", "class": "gfi-cb-lead-in" });
      var tel = el("input", { type: "tel", placeholder: "Teléfono", "class": "gfi-cb-lead-in" });
      var mail = el("input", { type: "email", placeholder: "Email (opcional)", "class": "gfi-cb-lead-in" });
      var ok = el("button", { "class": "gfi-cb-lead-send" }, ["Enviar"]);
      var err = el("div", { "class": "gfi-cb-lead-err" });
      [n, tel, mail, err, ok].forEach(function (c) { form.appendChild(c); });
      msgs.appendChild(form); msgs.scrollTop = msgs.scrollHeight;

      ok.addEventListener("click", function () {
        err.textContent = "";
        if (!n.value.trim() || (!tel.value.trim() && !mail.value.trim())) {
          err.textContent = "Poné tu nombre y un teléfono o email."; return;
        }
        ok.disabled = true; ok.textContent = "Enviando…";
        fetch(API + "/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: n.value.trim(), telefono: tel.value.trim(), email: mail.value.trim(),
            mensaje: historial.filter(function (m) { return m.role === "user"; }).map(function (m) { return m.content; }).slice(-3).join(" | "),
          }),
        })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d && d.ok) {
              leadEnviado = true; form.remove();
              addMsg("assistant", "¡Gracias! Tus datos quedaron registrados y " + nombre + " se va a contactar a la brevedad.");
            } else { ok.disabled = false; ok.textContent = "Enviar"; err.textContent = (d && d.error) || "No se pudo enviar."; }
          })
          .catch(function () { ok.disabled = false; ok.textContent = "Enviar"; err.textContent = "Error de conexión."; });
      });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function injectStyles(color, ladoDerecha) {
    var lado = ladoDerecha ? "right:20px;" : "left:20px;";
    var css = "" +
      "#gfi-chatbot-root{position:fixed;bottom:20px;" + lado + "z-index:2147483000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}" +
      "#gfi-cb-bubble{width:58px;height:58px;border-radius:50%;border:none;background:" + color + ";box-shadow:0 6px 22px rgba(0,0,0,.28);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s;" + lado + "position:absolute;bottom:0;}" +
      "#gfi-cb-bubble:hover{transform:scale(1.06);}" +
      "#gfi-cb-panel{position:absolute;bottom:72px;" + lado + "width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.32);display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;transition:opacity .2s,transform .2s;}" +
      "#gfi-chatbot-root.gfi-cb-open #gfi-cb-panel{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}" +
      "#gfi-cb-header{background:" + color + ";color:#fff;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;}" +
      "#gfi-cb-title{font-size:14px;font-weight:500;}#gfi-cb-title b{font-weight:700;}" +
      "#gfi-cb-close{background:none;border:none;color:#fff;font-size:22px;line-height:1;cursor:pointer;opacity:.85;padding:0 4px;}" +
      "#gfi-cb-close:hover{opacity:1;}" +
      "#gfi-cb-msgs{flex:1;overflow-y:auto;padding:14px;background:#f7f7f9;display:flex;flex-direction:column;gap:10px;}" +
      ".gfi-cb-msg{display:flex;}.gfi-cb-user{justify-content:flex-end;}" +
      ".gfi-cb-bubble-msg{max-width:80%;padding:9px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;}" +
      ".gfi-cb-assistant .gfi-cb-bubble-msg{background:#fff;color:#1a1a1a;border:1px solid #e6e6ea;border-bottom-left-radius:4px;}" +
      ".gfi-cb-user .gfi-cb-bubble-msg{background:" + color + ";color:#fff;border-bottom-right-radius:4px;}" +
      ".gfi-cb-dots{display:flex;gap:4px;align-items:center;}" +
      ".gfi-cb-dots span{width:7px;height:7px;border-radius:50%;background:#bbb;display:inline-block;animation:gfiBlink 1.2s infinite both;}" +
      ".gfi-cb-dots span:nth-child(2){animation-delay:.2s;}.gfi-cb-dots span:nth-child(3){animation-delay:.4s;}" +
      "@keyframes gfiBlink{0%,80%,100%{opacity:.25;}40%{opacity:1;}}" +
      ".gfi-cb-cta{margin:4px 0;padding:10px;border:1px dashed " + color + ";background:" + hexA(color, .07) + ";color:" + color + ";border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;text-align:center;}" +
      ".gfi-cb-lead{background:#fff;border:1px solid #e6e6ea;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;}" +
      ".gfi-cb-lead-in{padding:9px 11px;border:1px solid #d8d8de;border-radius:8px;font-size:14px;outline:none;}" +
      ".gfi-cb-lead-in:focus{border-color:" + color + ";}" +
      ".gfi-cb-lead-send{padding:10px;border:none;border-radius:8px;background:" + color + ";color:#fff;font-size:14px;font-weight:700;cursor:pointer;}" +
      ".gfi-cb-lead-err{color:#cc0000;font-size:12px;min-height:0;}" +
      "#gfi-cb-footer{display:flex;gap:8px;padding:10px;border-top:1px solid #ececf0;background:#fff;}" +
      "#gfi-cb-input{flex:1;border:1px solid #d8d8de;border-radius:20px;padding:9px 14px;font-size:14px;outline:none;}" +
      "#gfi-cb-input:focus{border-color:" + color + ";}" +
      "#gfi-cb-send{width:38px;height:38px;border-radius:50%;border:none;background:" + color + ";color:#fff;font-size:18px;cursor:pointer;flex-shrink:0;}" +
      "#gfi-cb-send:disabled{opacity:.5;cursor:default;}" +
      "#gfi-cb-brand{text-align:center;font-size:10px;color:#9a9aa5;padding:5px 0 7px;background:#fff;}" +
      "#gfi-cb-brand a{color:#9a9aa5;text-decoration:none;font-weight:700;}" +
      "@media(max-width:420px){#gfi-cb-panel{width:calc(100vw - 24px);height:calc(100vh - 100px);}}";
    var st = document.createElement("style");
    st.id = "gfi-cb-styles";
    st.appendChild(document.createTextNode(css));
    document.head.appendChild(st);
  }

  // Convierte #RRGGBB + alpha a rgba()
  function hexA(hex, a) {
    var h = (hex || "").replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    if (isNaN(n) || h.length !== 6) return "rgba(99,102,241," + a + ")";
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
})();
