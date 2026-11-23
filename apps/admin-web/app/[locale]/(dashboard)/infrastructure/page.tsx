"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { audioService } from '@/services/audio.service';
import { useTranslation } from 'react-i18next';

type Config = { maxWorkers: number; backlogThreshold: number; note: string };
type Metrics = { backend: string; waiting: number; retrying?: number; dead?: number; consumers?: number };

// Backend sends a fixed English note; show the translated version when it matches.
const DEFAULT_NOTE_PREFIX = 'Worker count is provisioned by Docker/operations';

export default function InfrastructurePage() {
  const { t } = useTranslation('common');
  const [config, setConfig] = useState<Config | null>(null);
  const [services, setServices] = useState<{ name: string; state: string }[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(true);
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++generation.current;
    setRefreshing(true);
    const [nextConfig, nextMetrics, nextHealth] = await Promise.allSettled([audioService.getWorkerConfig(), audioService.getQueueMetrics(), audioService.getServiceHealth()]);
    if (request !== generation.current) return;
    setConfig(nextConfig.status === 'fulfilled' ? nextConfig.value : null);
    setMetrics(nextMetrics.status === 'fulfilled' ? nextMetrics.value : null);
    setServices(nextHealth.status === 'fulfilled' && Array.isArray(nextHealth.value?.services) ? nextHealth.value.services : []);
    setError([nextConfig, nextMetrics, nextHealth].some(result => result.status === 'rejected') ? t('infrastructure.loadError') : '');
    setRefreshing(false);
  }, [t]);
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, [refresh]);

  async function save() {
    if (!config) return;
    setBusy(true); setError(''); setSaved(false);
    try { const result = await audioService.setWorkerConfig(config); setConfig(result); await refresh(); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : t('infrastructure.saveError')); }
    finally { setBusy(false); }
  }

  const serviceLabel = (name: string) => t(`infrastructure.services.${name}`, { defaultValue: name });
  const stateLabel = (state: string) => t(`infrastructure.states.${state}`, { defaultValue: state });
  const note = config?.note
    ? (config.note.startsWith(DEFAULT_NOTE_PREFIX) ? t('infrastructure.policy.noteDefault') : config.note)
    : '';
  const metricTiles = [
    ['broker', metrics?.backend || '—'],
    ['waiting', metrics?.waiting ?? '—'],
    ['retrying', metrics?.retrying ?? '—'],
    ['dead', metrics?.dead ?? '—'],
  ] as const;

  return (
    <main className="w-full space-y-6 p-5">
      <header>
        <h1 className="text-2xl font-semibold">{t('infrastructure.title')}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{t('infrastructure.subtitle')}</p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {saved && !error && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{t('infrastructure.saved')}</p>}

      <section className="space-y-3 rounded-xl border bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold">{t('infrastructure.health.title')}</h2>
          <p className="text-sm text-slate-500">{t('infrastructure.health.hint')}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {services.map(item => (
            <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{serviceLabel(item.name)}</span>
                <span className="block truncate font-mono text-xs text-slate-400">{item.name}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${item.state === 'healthy' ? 'bg-green-50 text-green-700' : item.state === 'not-configured' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>
                {stateLabel(item.state)}
              </span>
            </div>
          ))}
        </div>
        {!services.length && <p role="status" className="text-sm text-slate-500">{refreshing ? t('infrastructure.loading') : t('infrastructure.health.empty')}</p>}
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metricTiles.map(([key, value]) => (
          <div className="rounded-xl border bg-white p-4" key={key}>
            <p className="text-sm font-medium text-slate-700">{t(`infrastructure.metrics.${key}`)}</p>
            <p className="mt-2 text-2xl font-semibold">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{t(`infrastructure.metrics.${key}Hint`)}</p>
          </div>
        ))}
      </section>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">{t('infrastructure.policy.title')}</h2>
        <p className="text-sm text-slate-600">{t('infrastructure.policy.desc')}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">{t('infrastructure.policy.maxWorkers')}
            <select className="mt-2 w-full rounded-lg border p-2" value={config?.maxWorkers ?? 1} disabled={!config} onChange={e => setConfig(v => v ? { ...v, maxWorkers: Number(e.target.value) } : v)}>
              <option value={1}>{t('infrastructure.policy.maxWorkers1')}</option>
              <option value={2}>{t('infrastructure.policy.maxWorkers2')}</option>
            </select>
          </label>
          <label className="block text-sm font-medium">{t('infrastructure.policy.threshold')}
            <input type="number" min={1} max={1000} className="mt-2 w-full rounded-lg border p-2" value={config?.backlogThreshold ?? 10} disabled={!config} onChange={e => setConfig(v => v ? { ...v, backlogThreshold: Number(e.target.value) } : v)} />
            <span className="mt-1 block text-xs font-normal text-slate-500">{t('infrastructure.policy.thresholdHint')}</span>
          </label>
        </div>
        {note && <p className="text-xs text-slate-500">{note}</p>}
        <div className="flex gap-3">
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={!config || busy || refreshing} onClick={() => void save()}>{busy ? t('infrastructure.policy.saving') : t('infrastructure.policy.save')}</button>
          <button className="rounded-lg border px-4 py-2 disabled:opacity-50" disabled={refreshing || busy} onClick={() => void refresh()}>{refreshing ? t('infrastructure.loading') : t('infrastructure.refresh')}</button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border bg-white p-5">
        <div>
          <h2 className="text-lg font-semibold">{t('infrastructure.job.title')}</h2>
          <p className="text-sm text-slate-500">{t('infrastructure.job.hint')}</p>
        </div>
        <div className="flex gap-2">
          <input value={jobId} onChange={e => setJobId(e.target.value)} placeholder={t('infrastructure.job.placeholder')} aria-label={t('infrastructure.job.title')} className="min-w-0 flex-1 rounded-lg border p-2" />
          <button className="rounded-lg border px-4 py-2 disabled:opacity-50" disabled={!jobId.trim()} onClick={async () => { try { setJob(await audioService.getJob(jobId.trim())); setError(''); } catch (e) { setError(e instanceof Error ? e.message : t('infrastructure.job.notFound')); } }}>{t('infrastructure.job.lookup')}</button>
        </div>
        {job && <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-white">{JSON.stringify(job, null, 2)}</pre>}
      </section>
    </main>
  );
}
