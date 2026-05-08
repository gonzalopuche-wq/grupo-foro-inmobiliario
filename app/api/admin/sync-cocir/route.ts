import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

export const dynamic = "force-dynamic";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    export async function GET() {
      try {
          const url = "https://cocir.org.ar/paginas/matriculados";

              const html = await fetch(url).then(r => r.text());

                  const $ = cheerio.load(html);

                      const registros: any[] = [];

                          $("table tr").each((_, el) => {
                                const tds = $(el).find("td");

                                      if (tds.length >= 4) {
                                              registros.push({
                                                        matricula: $(tds[0]).text().trim(),
                                                                  apellido: $(tds[1]).text().trim(),
                                                                            nombre: $(tds[2]).text().trim(),
                                                                                      estado: $(tds[3]).text().trim(),
                                                                                                inmobiliaria: tds[4]
                                                                                                            ? $(tds[4]).text().trim()
                                                                                                                        : null,
                                                                                                                                });
                                                                                                                                      }
                                                                                                                                          });

                                                                                                                                              await sb.from("cocir_padron").delete().neq("matricula", "");

                                                                                                                                                  const { error } = await sb
                                                                                                                                                        .from("cocir_padron")
                                                                                                                                                              .insert(registros);

                                                                                                                                                                  if (error) {
                                                                                                                                                                        return NextResponse.json({
                                                                                                                                                                                error: error.message,
                                                                                                                                                                                      }, { status: 500 });
                                                                                                                                                                                          }

                                                                                                                                                                                              return NextResponse.json({
                                                                                                                                                                                                    ok: true,
                                                                                                                                                                                                          total: registros.length,
                                                                                                                                                                                                              });

                                                                                                                                                                                                                } catch (e: any) {
                                                                                                                                                                                                                    return NextResponse.json({
                                                                                                                                                                                                                          error: e.message,
                                                                                                                                                                                                                              }, { status: 500 });
                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                }