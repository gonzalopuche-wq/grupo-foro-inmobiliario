"use client";
import { useEffect } from "react";

export default function FichaVistaTracker({ propiedadId }: { propiedadId: string }) {
  useEffect(() => {
    fetch("/api/cartera/vista", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propiedad_id: propiedadId }),
    }).catch(() => {});
  }, [propiedadId]);
  return null;
}
