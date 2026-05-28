"use client";

import { createContext, useContext, useState, useCallback } from "react";

export interface GFIWindow {
  id: string;
  title: string;
  icon: string;
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  zIndex: number;
}

interface WMCtx {
  windows: GFIWindow[];
  openWindow: (title: string, icon: string, href: string) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  updateWindow: (id: string, updates: Partial<GFIWindow>) => void;
}

const Ctx = createContext<WMCtx | null>(null);

export function useWindowManager() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWindowManager fuera de WindowManagerProvider");
  return ctx;
}

export function WindowManagerProvider({ children }: { children: React.ReactNode }) {
  const [windows, setWindows] = useState<GFIWindow[]>([]);
  const [topZ, setTopZ] = useState(1000);

  const nextZ = useCallback(() => {
    const z = topZ + 1;
    setTopZ(z);
    return z;
  }, [topZ]);

  const openWindow = useCallback((title: string, icon: string, href: string) => {
    setWindows(ws => {
      const existing = ws.find(w => w.href === href);
      if (existing) {
        const z = topZ + 1;
        setTopZ(z);
        return ws.map(w => w.id === existing.id ? { ...w, minimized: false, zIndex: z } : w);
      }
      const z = topZ + 1;
      setTopZ(z);
      const offset = (ws.length % 8) * 28;
      return [...ws, {
        id: crypto.randomUUID(),
        title,
        icon,
        href,
        x: 80 + offset,
        y: 60 + offset,
        width: Math.min(960, window.innerWidth - 120),
        height: Math.min(640, window.innerHeight - 120),
        minimized: false,
        zIndex: z,
      }];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topZ]);

  const closeWindow = useCallback((id: string) => {
    setWindows(ws => ws.filter(w => w.id !== id));
  }, []);

  const focusWindow = useCallback((id: string) => {
    setTopZ(z => {
      const nz = z + 1;
      setWindows(ws => ws.map(w => w.id === id ? { ...w, zIndex: nz, minimized: false } : w));
      return nz;
    });
  }, []);

  const minimizeWindow = useCallback((id: string) => {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, minimized: true } : w));
  }, []);

  const restoreWindow = useCallback((id: string) => {
    focusWindow(id);
  }, [focusWindow]);

  const updateWindow = useCallback((id: string, updates: Partial<GFIWindow>) => {
    setWindows(ws => ws.map(w => w.id === id ? { ...w, ...updates } : w));
  }, []);

  void nextZ; // used indirectly via topZ closure

  return (
    <Ctx.Provider value={{ windows, openWindow, closeWindow, focusWindow, minimizeWindow, restoreWindow, updateWindow }}>
      {children}
    </Ctx.Provider>
  );
}
