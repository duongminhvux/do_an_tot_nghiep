"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { audioService } from '@/services/audio.service';
import { useTranslation } from 'react-i18next';

type Config = { maxWorkers: number; backlogThreshold: number; note: string };
type Metrics = { backend: string; waiting: number; retrying?: number; dead?: number; consumers?: number };
export default function InfrastructurePage() {
  const {t}=useTranslation('common');
  const [config, setConfig] = useState<Config | null>(null);
  const [services, setServices] = useState<{name:string;state:string}[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState<any>(null);
  const [refreshing,setRefreshing]=useState(true);
  const generation=useRef(0);
  const refresh = useCallback(async () => {
    const request=++generation.current;
    setRefreshing(true);
    const [nextConfig,nextMetrics,nextHealth]=await Promise.allSettled([audioService.getWorkerConfig(),audioService.getQueueMetrics(),audioService.getServiceHealth()]);
    if(request!==generation.current)return;
    setConfig(nextConfig.status==='fulfilled'?nextConfig.value:null);
    setMetrics(nextMetrics.status==='fulfilled'?nextMetrics.value:null);
    setServices(nextHealth.status==='fulfilled'&&Array.isArray(nextHealth.value?.services)?nextHealth.value.services:[]);
    setError([nextConfig,nextMetrics,nextHealth].some(result=>result.status==='rejected')?t('infrastructure.loadError'):'');
    setRefreshing(false);
  }, [t]);
  useEffect(() => {void refresh();return()=>{generation.current++;};}, [refresh]);
  async function save() {
    if (!config) return;
    setBusy(true);setError('');
    try { const result = await audioService.setWorkerConfig(config);setConfig(result);await refresh(); }
    catch (e) {setError(e instanceof Error ? e.message : 'Could not save configuration');}
    finally {setBusy(false);}
  }
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-5">
      <header>
        <h1 className="text-2xl font-semibold">Worker & Queue Management</h1>
        <p className="mt-1 text-sm text-slate-600">Monitor the audio queue and configure the optional secondary worker.</p>
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">Microservice Health</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {services.map(item => <div key={item.name} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
            <span className="font-medium">{item.name}</span>
            <span className={item.state==='healthy'?'text-green-700':'text-amber-700'}>{item.state}</span>
          </div>)}
        </div>
        {!services.length && <p role="status" className="text-sm text-slate-500">{t(refreshing?'infrastructure.loading':'infrastructure.emptyHealth')}</p>}
      </section>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Broker',metrics?.backend||'—'],['Waiting',metrics?.waiting??'—'],['Retrying',metrics?.retrying??'—'],['Dead letter',metrics?.dead??'—']] as const).map(([label,value]) =>
          <div className="rounded-xl border bg-white p-4" key={label}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
      </section>
      <section className="rounded-xl border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">TTS worker policy</h2>
        <p className="text-sm text-slate-600">Worker 1 always consumes. Worker 2 can consume only when provisioned, backlog exceeds the threshold, and the GPU resource check approves it.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Maximum workers
            <select className="mt-2 w-full rounded-lg border p-2" value={config?.maxWorkers??1} disabled={!config} onChange={e=>setConfig(v=>v?{...v,maxWorkers:Number(e.target.value)}:v)}>
              <option value={1}>1 (primary only)</option><option value={2}>2 (primary + optional elastic)</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Minimum waiting jobs to admit Worker 2
            <input type="number" min={1} max={1000} className="mt-2 w-full rounded-lg border p-2" value={config?.backlogThreshold??10} disabled={!config} onChange={e=>setConfig(v=>v?{...v,backlogThreshold:Number(e.target.value)}:v)}/>
          </label>
        </div>
        <p className="text-xs text-slate-500">{config?.note}</p>
        <div className="flex gap-3">
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-white disabled:opacity-50" disabled={!config||busy||refreshing} onClick={()=>void save()}>Save policy</button>
          <button className="rounded-lg border px-4 py-2" disabled={refreshing||busy} onClick={()=>void refresh()}>{refreshing?t('infrastructure.loading'):'Refresh'}</button>
        </div>
      </section>
      <section className="rounded-xl border bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">Inspect an audio job</h2>
        <div className="flex gap-2"><input value={jobId} onChange={e=>setJobId(e.target.value)} placeholder="Job UUID" className="min-w-0 flex-1 rounded-lg border p-2"/>
          <button className="rounded-lg border px-4 py-2" disabled={!jobId.trim()} onClick={async()=>{ try {setJob(await audioService.getJob(jobId.trim()));setError('');}catch(e){setError(e instanceof Error?e.message:'Job not found');}}}>Lookup</button></div>
        {job && <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-white">{JSON.stringify(job,null,2)}</pre>}
      </section>
    </main>
  );
}
