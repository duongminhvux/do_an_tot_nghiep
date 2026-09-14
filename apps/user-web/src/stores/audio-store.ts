"use client";
import { create } from "zustand";
interface AudioState { activeId: string | null; setActive: (id: string | null) => void; }
export const useAudioStore = create<AudioState>((set) => ({ activeId: null, setActive: (activeId) => set({ activeId }) }));
