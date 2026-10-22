"use client";

import { createContext, useContext } from "react";
import type { AudioIdentity } from "@/services/toeic-attempt.service";

export interface ToeicAudioPolicy {
  restricted: boolean;
  disabled: boolean;
  counts: Record<string, number>;
  requestPlay: (identity: AudioIdentity) => Promise<number>;
}

const AudioPolicyContext = createContext<ToeicAudioPolicy | null>(null);
export const ToeicAudioPolicyProvider = AudioPolicyContext.Provider;
export const useToeicAudioPolicy = () => useContext(AudioPolicyContext);
