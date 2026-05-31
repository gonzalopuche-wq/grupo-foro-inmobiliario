/**
 * diagnose-dom.ts
 *
 * Usa agent-browser para inspeccionar el DOM de Zonaprop y Argenprop
 * y detectar los selectores correctos para scraping.
 *
 * Requiere agent-browser instalado:
 *   npx agent-browser install
 *
 * USO:
 *   npx tsx scripts/diagnose-dom.ts
 */

import { execSync } from "child_process";

const AB = process.platform === "win32"
  ? ".\\node_modules\\.bin\\agent-browser.cmd"
  : "./node_modules/.bin/agent-browser";

function ab(cmd: string, timeoutMs = 30000): string {
  try {
    return execSync(`"${AB}" ${cmd}`, { timeout: timeoutMs, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (e: any) {
    return e.stdout?.trim() ?? "";
  }
}

async function inspectUrl(url: string, label: string) {
  process.stdout.write(`\n────────────────────────────────────────\n`);
  process.stdout.write(`Inspeccionando: ${label}\n`);
  process.stdout.write(`URL: ${url}\n`);
  process.stdout.write(`────────────────────────────────────────\n`);

  // Abrir página
  ab(`open "${url}"`, 20000);

  // Esperar hasta que no sea CF challenge
  let title = "";
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    title = ab("get title", 5000);
    if (title.length > 5 && !title.toLowerCase().includes("just a moment") && !title.toLowerCase().includes("cloudflare")) break;
    process.stdout.write(`  ⏳ CF challenge (${i + 1}s): "${title}"\n`);
  }
  process.stdout.write(`  Título: "${title}"\n\n`);

  // Intentar esperar selector de listing
  process.stdout.write(`  Esperando [data-postingid]...\n`);
  const waitResult = ab(`wait "[data-postingid]"`, 20000);
  process.stdout.write(`  wait result: "${waitResult}"\n`);

  // Contar elementos
  const countZP = ab(`eval "document.querySelectorAll('[data-postingid]').length"`, 10000);
  const countAP = ab(`eval "document.querySelectorAll('[data-id]').length"`, 10000);
  const countArticle = ab(`eval "document.querySelectorAll('article').length"`, 10000);
  process.stdout.write(`  [data-postingid]: ${countZP}\n`);
  process.stdout.write(`  [data-id]: ${countAP}\n`);
  process.stdout.write(`  article: ${countArticle}\n\n`);

  // Si hay data-postingid, extraer primer card
  if (countZP && countZP !== "0") {
    const firstCard = ab(`eval "JSON.stringify((() => { const el = document.querySelector('[data-postingid]'); if (!el) return null; return { tag: el.tagName, attrs: Object.fromEntries(Array.from(el.attributes).map(a => [a.name, a.value])), href: el.querySelector('a')?.getAttribute('href') || '', text: (el.textContent || '').slice(0, 200) }; })()"`, 10000);
    process.stdout.write(`  Primer [data-postingid] card:\n${firstCard}\n\n`);
  }

  // Si hay data-id, extraer primer card
  if (countAP && parseInt(countAP) > 3) {
    const firstCard = ab(`eval "JSON.stringify((() => { const el = document.querySelector('[data-id]'); if (!el) return null; return { tag: el.tagName, attrs: Object.fromEntries(Array.from(el.attributes).map(a => [a.name, a.value])), href: el.querySelector('a')?.getAttribute('href') || '', text: (el.textContent || '').slice(0, 200) }; })()"`, 10000);
    process.stdout.write(`  Primer [data-id] card:\n${firstCard}\n\n`);
  }

  // Si hay articles, inspeccionar
  if (countArticle && parseInt(countArticle) > 3) {
    const firstArticle = ab(`eval "JSON.stringify((() => { const el = document.querySelector('article'); if (!el) return null; return { attrs: Object.fromEntries(Array.from(el.attributes).map(a => [a.name, a.value])), outerHTML: el.outerHTML.slice(0, 800) }; })()"`, 10000);
    process.stdout.write(`  Primer <article>:\n${firstArticle}\n\n`);
  }

  // Si no encontramos nada, dump del body HTML
  if ((!countZP || countZP === "0") && (!countAP || parseInt(countAP) <= 3) && (!countArticle || parseInt(countArticle) <= 3)) {
    process.stdout.write(`  ⚠️ Sin cards encontradas. Inspeccionando DOM...\n\n`);

    // Accesibility tree snapshot
    process.stdout.write(`  📋 Snapshot (accessibility tree):\n`);
    const snapshot = ab(`snapshot`, 15000);
    process.stdout.write(snapshot.slice(0, 3000) + "\n\n");

    // Window globals con listing data
    const globals = ab(`eval "JSON.stringify(Object.keys(window).filter(k => k.toLowerCase().includes('listing') || k.toLowerCase().includes('posting') || k.toLowerCase().includes('initial') || k.toLowerCase().includes('store') || k.toLowerCase().includes('state')).slice(0, 20))"`, 10000);
    process.stdout.write(`  Window globals de listings: ${globals}\n\n`);

    // Scripts inline
    const inlineScripts = ab(`eval "JSON.stringify(Array.from(document.querySelectorAll('script:not([src])')).filter(s => { const t = s.textContent || ''; return t.includes('postingId') || t.includes('listings') || t.includes('postings') || t.includes('INITIAL'); }).map(s => (s.id ? '[' + s.id + '] ' : '') + (s.textContent || '').slice(0, 300)).slice(0, 3))"`, 10000);
    process.stdout.write(`  Scripts inline con listings: ${inlineScripts}\n\n`);
  }

  // Cerrar
  ab(`close`, 5000);
}

async function main() {
  // Verificar que agent-browser está disponible
  const version = ab(`--version`, 5000);
  if (!version) {
    console.error("❌ agent-browser no encontrado. Instalar con:");
    console.error("   npx agent-browser install");
    process.exit(1);
  }
  console.log(`✅ agent-browser ${version}\n`);

  await inspectUrl("https://www.zonaprop.com.ar/departamentos-venta-rosario.html", "Zonaprop - departamentos venta");
  await inspectUrl("https://www.argenprop.com/departamentos/venta/rosario", "Argenprop - departamentos venta");
}

main().catch(console.error);
