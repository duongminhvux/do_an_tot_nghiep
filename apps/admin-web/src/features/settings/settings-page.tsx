"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Save, ShieldCheck } from "lucide-react";
import type { Permission } from "@listenup/domain";
import {
  adminSiteSettingsApi,
  adminTtsApi,
  type AdminSiteSettings,
  type TtsSettingsDto,
} from "@/lib/api/client";
import { useAdminSession } from "@/stores/admin-session";
import { RequirePermission } from "@/components/security/require-permission";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { ErrorState, TableSkeleton } from "@/components/ui/states";

export function SettingsPage({
  type,
}: {
  type: "site" | "tts" | "profile" | "personal";
}) {
  const permission: Permission | undefined =
    type === "site"
      ? "site-settings:update"
      : type === "tts"
        ? "tts-settings:update"
        : undefined;
  const content =
    type === "site" ? (
      <SiteSettings />
    ) : type === "tts" ? (
      <TtsSettings />
    ) : (
      <ProfileSettings type={type} />
    );
  return permission ? (
    <RequirePermission permission={permission}>{content}</RequirePermission>
  ) : (
    content
  );
}

function SiteSettings() {
  const user = useAdminSession((state) => state.user)!;
  const [form, setForm] = useState<Partial<AdminSiteSettings>>({});
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => adminSiteSettingsApi.get(user),
  });
  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);
  const save = async () => {
    setStatus("Saving…");
    try {
      const saved = await adminSiteSettingsApi.save(user, form);
      setForm(saved);
      setStatus("Saved");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to save settings.",
      );
    }
  };
  if (query.isLoading) return <TableSkeleton />;
  if (query.error) return <ErrorState message={query.error.message} />;
  return (
    <div>
      <PageHeader
        title="Site Settings"
        description="Manage the public brand and contact details stored by the API."
      />
      <section className="admin-surface p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Platform name">
            <input
              value={form.siteName ?? ""}
              onChange={(event) =>
                setForm({ ...form, siteName: event.target.value })
              }
            />
          </Field>
          <Field label="Primary color">
            <input
              type="color"
              value={form.primaryColor ?? "#2563EB"}
              onChange={(event) =>
                setForm({ ...form, primaryColor: event.target.value })
              }
            />
          </Field>
          <Field label="Support email">
            <input
              type="email"
              value={form.contactEmail ?? ""}
              onChange={(event) =>
                setForm({ ...form, contactEmail: event.target.value })
              }
            />
          </Field>
          <Field label="Contact phone">
            <input
              value={form.contactPhone ?? ""}
              onChange={(event) =>
                setForm({ ...form, contactPhone: event.target.value })
              }
            />
          </Field>
          <Field label="Address" wide>
            <input
              value={form.address ?? ""}
              onChange={(event) =>
                setForm({ ...form, address: event.target.value })
              }
            />
          </Field>
          <Field label="Footer text" wide>
            <textarea
              className="min-h-28 py-3"
              value={form.footerText ?? ""}
              onChange={(event) =>
                setForm({ ...form, footerText: event.target.value })
              }
            />
          </Field>
          <Field label="Logo media ID">
            <input
              value={form.logoMediaId ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  logoMediaId: event.target.value || undefined,
                })
              }
            />
          </Field>
          <Field label="Favicon media ID">
            <input
              value={form.faviconMediaId ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  faviconMediaId: event.target.value || undefined,
                })
              }
            />
          </Field>
        </div>
      </section>
      <SaveRow status={status} onSave={save} />
    </div>
  );
}

function TtsSettings() {
  const user = useAdminSession((state) => state.user)!;
  const [form, setForm] = useState<TtsSettingsDto>({
    enabled: true,
    provider: "kokoro",
    defaultLanguage: "en-US",
    defaultVoiceId: "af_heart",
    defaultSpeed: 1,
    providerConfigured: false,
    providerHealthy: false,
  });
  const [status, setStatus] = useState("");
  const query = useQuery({
    queryKey: ["tts-settings"],
    queryFn: () => adminTtsApi.settings(user),
    refetchInterval: 5_000,
  });
  const voicesQuery = useQuery({
    queryKey: ["tts-voices"],
    queryFn: () => adminTtsApi.voices(user),
    refetchInterval: 10_000,
  });
  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);
  const availableVoices = (voicesQuery.data?.voices ?? []).filter(
    (voice) => voice.language === form.defaultLanguage,
  );
  const save = async () => {
    setStatus("Saving…");
    try {
      const saved = await adminTtsApi.saveSettings(user, {
        enabled: form.enabled,
        provider: form.provider,
        defaultLanguage: form.defaultLanguage,
        defaultVoiceId: form.defaultVoiceId,
        defaultSpeed: form.defaultSpeed,
      });
      setForm(saved);
      setStatus("Saved");
      await query.refetch();
      await voicesQuery.refetch();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Unable to save settings.",
      );
    }
  };
  if (query.isLoading) return <TableSkeleton />;
  if (query.error) return <ErrorState message={query.error.message} />;
  return (
    <div>
      <PageHeader
        title="TTS Settings"
        description="Local Kokoro-82M runs inside Docker and is called only by the NestJS backend."
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <section className="admin-surface p-5">
          <h2 className="font-bold">Local provider defaults</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <Field label="Active provider">
              <input readOnly value={form.provider} className="bg-slate-50" />
            </Field>
            <Field label="Provider status">
              <input
                readOnly
                value={
                  form.providerHealthy
                    ? "Ready"
                    : form.providerConfigured
                      ? "Configured, not ready"
                      : "Not configured"
                }
                className="bg-slate-50"
              />
            </Field>
            <Field label="Default language">
              <select
                value={form.defaultLanguage}
                onChange={(event) => {
                  const language = event.target.value;
                  const firstVoice = (voicesQuery.data?.voices ?? []).find(
                    (voice) => voice.language === language,
                  );
                  setForm({
                    ...form,
                    defaultLanguage: language,
                    defaultVoiceId: firstVoice?.id ?? form.defaultVoiceId,
                  });
                }}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
              </select>
            </Field>
            <Field label="Default voice">
              <select
                value={form.defaultVoiceId}
                disabled={!availableVoices.length}
                onChange={(event) =>
                  setForm({ ...form, defaultVoiceId: event.target.value })
                }
              >
                {!availableVoices.length && (
                  <option value={form.defaultVoiceId}>
                    {form.defaultVoiceId || "No voices available"}
                  </option>
                )}
                {availableVoices.map((voice) => (
                  <option key={voice.id} value={voice.id}>
                    {voice.name} ({voice.id}){voice.gender ? ` · ${voice.gender}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Default speed">
              <input
                type="number"
                min={0.5}
                max={2}
                step={0.05}
                value={form.defaultSpeed}
                onChange={(event) =>
                  setForm({ ...form, defaultSpeed: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Runtime">
              <input
                readOnly
                value={
                  [form.device, form.gpuName].filter(Boolean).join(" · ") ||
                  "Waiting for Kokoro service"
                }
                className="bg-slate-50"
              />
            </Field>
          </div>
          {form.providerError && (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {form.providerError}
            </p>
          )}
        </section>
        <aside className="admin-surface p-5">
          <ShieldCheck className="size-6 text-blue-600" />
          <h2 className="mt-3 font-bold">Local-only TTS</h2>
          <p className="mt-2 text-sm text-slate-500">
            Kokoro runs locally in the <code>tts-service</code> container. No
            cloud API key is stored or sent to the browser. The backend writes
            generated WAV files into the existing media storage.
          </p>
          <div className="mt-4 space-y-1 text-xs text-slate-500">
            <p>Model: {form.model ?? "Kokoro-82M"}</p>
            <p>GPU: {form.gpuName ?? "Not detected"}</p>
          </div>
        </aside>
      </div>
      <SaveRow status={status} onSave={save} />
    </div>
  );
}

function ProfileSettings({ type }: { type: string }) {
  const user = useAdminSession((state) => state.user)!;
  return (
    <div>
      <PageHeader
        title={type === "profile" ? "Admin Profile" : "Personal Settings"}
        description="Current authenticated administration identity."
      />
      <section className="admin-surface p-5">
        <div className="flex items-center gap-4">
          <span className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-500 text-2xl font-bold">
            {user.fullName.charAt(0)}
          </span>
          <div>
            <h2 className="text-lg font-bold">{user.fullName}</h2>
            <p className="text-slate-500">{user.email}</p>
            <span className="mt-2 inline-flex rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-600">
              {user.role}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function SaveRow({
  status,
  onSave,
}: {
  status: string;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="mt-5 flex justify-end gap-3">
      {status && (
        <span
          className={`flex items-center gap-1 font-semibold ${
            status === "Saved" ? "text-green-600" : "text-slate-600"
          }`}
        >
          {status === "Saved" && <CheckCircle2 className="size-4" />}
          {status}
        </span>
      )}
      <Button onClick={() => void onSave()} disabled={status === "Saving…"}>
        <Save className="size-4" />
        Save Settings
      </Button>
    </div>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="font-semibold">{label}</span>
      <div className="mt-2 [&>*]:h-10 [&>*]:w-full [&>*]:rounded-lg [&>*]:border [&>*]:border-slate-200 [&>*]:px-3">
        {children}
      </div>
    </label>
  );
}
