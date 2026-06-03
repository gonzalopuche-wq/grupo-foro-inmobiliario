// GET  ?folderId= → lista archivos en carpeta GFI de Drive
// POST { action: "create_folder", name } → crea carpeta
// POST { action: "upload", name, content_base64, mimeType } → sube archivo
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGoogleToken } from "../../../lib/google-token";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GFI_FOLDER_NAME = "GFI - CRM";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";

async function getUser(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const { data: { user } } = await sb.auth.getUser(token);
  return user ?? null;
}

/** Obtiene (o crea) la carpeta raíz "GFI - CRM" y persiste su id. */
async function ensureRootFolder(accessToken: string, perfil_id: string): Promise<string> {
  // Leer desde portal_credenciales
  const { data: creds } = await sb
    .from("portal_credenciales")
    .select("google_drive_folder_id")
    .eq("perfil_id", perfil_id)
    .maybeSingle();

  if (creds?.google_drive_folder_id) return creds.google_drive_folder_id as string;

  // Buscar si ya existe en Drive
  const searchRes = await fetch(
    `${DRIVE_FILES_URL}?q=name%3D'${encodeURIComponent(GFI_FOLDER_NAME)}'+and+mimeType%3D'application%2Fvnd.google-apps.folder'+and+trashed%3Dfalse&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchJson = await searchRes.json();
  const existing = (searchJson.files as { id: string }[] | undefined)?.[0];
  if (existing) {
    await sb.from("portal_credenciales").upsert(
      { perfil_id, google_drive_folder_id: existing.id, updated_at: new Date().toISOString() },
      { onConflict: "perfil_id" }
    );
    return existing.id;
  }

  // Crear la carpeta
  const createRes = await fetch(DRIVE_FILES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: GFI_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  const createJson = await createRes.json();
  const folderId = createJson.id as string;

  await sb.from("portal_credenciales").upsert(
    { perfil_id, google_drive_folder_id: folderId, updated_at: new Date().toISOString() },
    { onConflict: "perfil_id" }
  );

  return folderId;
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const accessToken = await getGoogleToken(user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 403 });
  }

  let folderId = req.nextUrl.searchParams.get("folderId");
  if (!folderId) {
    folderId = await ensureRootFolder(accessToken, user.id);
  }

  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const fields = encodeURIComponent("files(id,name,mimeType,size,modifiedTime,webViewLink)");
  const res = await fetch(
    `${DRIVE_FILES_URL}?q=${q}&fields=${fields}&orderBy=folder,name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: "drive_list_failed", detail: err }, { status: 502 });
  }

  const json = await res.json();
  return NextResponse.json({ files: json.files ?? [], rootFolderId: folderId });
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUser(req);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const accessToken = await getGoogleToken(user.id);
  if (!accessToken) {
    return NextResponse.json({ error: "google_not_connected" }, { status: 403 });
  }

  const rootFolderId = await ensureRootFolder(accessToken, user.id);
  const body = await req.json();

  if (body.action === "create_folder") {
    const { name, parentId } = body as { name: string; parentId?: string };
    if (!name) return NextResponse.json({ error: "name requerido" }, { status: 400 });

    const res = await fetch(DRIVE_FILES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId ?? rootFolderId],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: "drive_create_folder_failed", detail: err }, { status: 502 });
    }

    const json = await res.json();
    return NextResponse.json({ ok: true, folderId: json.id, name: json.name });
  }

  if (body.action === "upload") {
    const { name, content_base64, mimeType, parentId } = body as {
      name: string;
      content_base64: string;
      mimeType: string;
      parentId?: string;
    };
    if (!name || !content_base64 || !mimeType) {
      return NextResponse.json({ error: "name, content_base64 y mimeType son requeridos" }, { status: 400 });
    }

    const fileContent = Buffer.from(content_base64, "base64");
    const metadata = JSON.stringify({ name, parents: [parentId ?? rootFolderId] });
    const boundary = "gfi_boundary_" + Date.now();
    const multipart = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`),
      Buffer.from(metadata),
      Buffer.from(`\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
      fileContent,
      Buffer.from(`\r\n--${boundary}--`),
    ]);

    const res = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: "drive_upload_failed", detail: err }, { status: 502 });
    }

    const json = await res.json();
    return NextResponse.json({ ok: true, fileId: json.id, name: json.name, webViewLink: json.webViewLink });
  }

  return NextResponse.json({ error: "action no reconocida" }, { status: 400 });
}
