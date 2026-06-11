import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'airnav-yolo-detection-config-v2';
const DEFAULT_YOLO_BACKEND_URL = 'https://yolo.34.101.183.214.sslip.io';
const DEFAULT_YOLO_CAMERA_SOURCE = 'https://deeper-favourite-shall-applications.trycloudflare.com/video';

const DEFAULT_CONFIG = {
  backendUrl: DEFAULT_YOLO_BACKEND_URL,
  cameraSource: DEFAULT_YOLO_CAMERA_SOURCE,
  modelPath: 'models/best.pt',
  yoloEnabled: true,
  confidence: '0.45',
  imageSize: '160',
  inferEvery: '4',
  jpegQuality: '32',
};

function normalizeCameraSource(value) {
  const text = String(value || '').trim();
  return text || DEFAULT_CONFIG.cameraSource;
}

function normalizeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    backendUrl: normalizeBackendUrl(config.backendUrl),
    cameraSource: normalizeCameraSource(config.cameraSource),
  };
}

function loadConfig() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_CONFIG;
  }
}

function normalizeBackendUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\/(127\.0\.0\.1|localhost):5050$/i.test(text)) return DEFAULT_YOLO_BACKEND_URL;
  return text || DEFAULT_CONFIG.backendUrl;
}

function apiUrl(baseUrl, path) {
  return `${normalizeBackendUrl(baseUrl)}${path}`;
}

function statusTone(status = '') {
  const value = String(status).toLowerCase();
  if (value.includes('lengkap')) return 'emerald';
  if (value.includes('tidak pakai') || value.includes('tidak lengkap') || value.includes('error')) return 'rose';
  if (value.includes('belum') || value.includes('demo') || value.includes('objek')) return 'amber';
  return 'cyan';
}

function Badge({ tone = 'cyan', children }) {
  const tones = {
    cyan: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
    emerald: 'border-emerald-300/30 bg-emerald-400/10 text-emerald-100',
    rose: 'border-rose-300/30 bg-rose-400/10 text-rose-100',
    amber: 'border-amber-300/30 bg-amber-400/10 text-amber-100',
    slate: 'border-slate-300/20 bg-slate-400/10 text-slate-200',
  };
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${tones[tone] || tones.cyan}`}>{children}</span>;
}

function MiniStat({ label, value, helper, icon, tone = 'cyan' }) {
  const gradients = {
    cyan: 'from-cyan-500 to-blue-600',
    emerald: 'from-emerald-500 to-green-600',
    rose: 'from-rose-500 to-red-600',
    amber: 'from-amber-400 to-orange-600',
    violet: 'from-violet-500 to-indigo-600',
  };
  return (
    <div className="rounded-3xl border border-cyan-300/15 bg-white/[0.04] p-5 shadow-xl shadow-cyan-950/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black text-white">{value}</p>
          {helper && <p className="mt-1 text-xs text-slate-400">{helper}</p>}
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${gradients[tone] || gradients.cyan} text-lg text-white shadow-lg`}>{icon}</div>
      </div>
    </div>
  );
}

function DetectionRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 py-3 last:border-b-0">
      <span className="text-sm font-semibold text-slate-400">{label}</span>
      <b className="max-w-[65%] break-words text-right text-sm text-white">{value}</b>
    </div>
  );
}

export default function YoloDetectionPage({ initialConfig, canExportLogs = false } = {}) {
  const startingConfig = useMemo(() => normalizeConfig({ ...loadConfig(), ...(initialConfig || {}) }), [initialConfig]);
  const [config, setConfig] = useState(startingConfig);
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [backendOnline, setBackendOnline] = useState(false);
  const [message, setMessage] = useState('Menunggu koneksi backend YOLO.');
  const [videoVersion, setVideoVersion] = useState(Date.now());
  const lastStreamSignature = useRef('');

  const baseUrl = useMemo(() => normalizeBackendUrl(config.backendUrl), [config.backendUrl]);
  const videoFeed = `${baseUrl}/video_feed?t=${videoVersion}`;
  const logCsvUrl = `${baseUrl}/logs/detections.csv`;

  useEffect(() => {
    const nextConfig = normalizeConfig({ ...loadConfig(), ...(initialConfig || {}) });
    setConfig(nextConfig);
  }, [initialConfig]);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function refresh() {
      try {
        const response = await fetch(apiUrl(baseUrl, '/api/ppe/status'), { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        setStatus(data);
        setBackendOnline(true);
        setMessage(data.message || 'Backend YOLO aktif.');
      } catch {
        if (cancelled) return;
        setBackendOnline(false);
        setMessage('Backend YOLO belum aktif. Jalankan start_airnav_yolo_windows.bat atau start_yolo_backend_windows.bat.');
      }

      try {
        const response = await fetch(apiUrl(baseUrl, '/api/ppe/logs'), { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setLogs(Array.isArray(data.rows) ? data.rows : []);
        }
      } catch {
        // Log tidak wajib; status kamera tetap lebih penting.
      }
    }

    refresh();
    timer = window.setInterval(refresh, 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [baseUrl]);

  useEffect(() => {
    if (!backendOnline || !status) return;
    const signature = [
      status.system || '',
      status.yolo_enabled === false ? 'cctv' : 'yolo',
      status.active_camera_source || '',
      status.camera_source || '',
    ].join('|');
    if (!signature || signature === lastStreamSignature.current) return;
    lastStreamSignature.current = signature;
    setVideoVersion(Date.now());
  }, [backendOnline, status?.system, status?.yolo_enabled, status?.active_camera_source, status?.camera_source]);

  const ppeStatus = status?.ppe_status || 'BELUM ADA DATA';
  const tone = statusTone(ppeStatus);
  const confidence = status?.confidence !== undefined ? `${Math.round(Number(status.confidence || 0) * 100)}%` : '0%';
  const customModel = status?.custom_model_available ? 'Custom best.pt aktif' : 'Mode demo / model custom belum ada';

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white lg:text-3xl">Deteksi Objek YOLO APD AirNav</h1>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-400">Section ini menambahkan sistem deteksi helm safety dan rompi AirNav. ESP32-S3 AI Camera dipakai sebagai kamera streaming, sedangkan YOLO diproses oleh backend Python agar kamera tetap ringan dan tidak lag.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={backendOnline ? 'emerald' : 'rose'}>{backendOnline ? 'Backend Online' : 'Backend Offline'}</Badge>
          <Badge tone={status?.custom_model_available ? 'emerald' : 'amber'}>{customModel}</Badge>
        </div>
      </div>

      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-slate-950 p-5 text-white shadow-2xl shadow-cyan-950/20 lg:p-7">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.55fr_0.9fr]">
          <div className="overflow-hidden rounded-[1.6rem] border border-cyan-300/15 bg-black/35">
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-black text-white">Live Camera + Bounding Box</h2>
                <p className="text-sm text-slate-400">Jika backend aktif, gambar di bawah adalah stream hasil anotasi YOLO.</p>
              </div>
              <button type="button" onClick={() => setVideoVersion(Date.now())} className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-400">Refresh Video</button>
            </div>
            <div className="grid min-h-[280px] place-items-center bg-black lg:min-h-[520px]">
              {backendOnline ? (
                <img src={videoFeed} alt="AirNav YOLO live detection" className="h-full max-h-[620px] w-full object-contain" />
              ) : (
                <div className="p-8 text-center">
                  <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-rose-300/30 bg-rose-400/10 text-4xl">📷</div>
                  <h3 className="mt-5 text-xl font-black text-white">Video belum tampil</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">Jalankan backend Python YOLO terlebih dahulu, lalu refresh halaman ini. Untuk uji awal gunakan webcam laptop dengan camera source <b>0</b>.</p>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className={`rounded-[1.6rem] border p-5 ${tone === 'emerald' ? 'border-emerald-300/30 bg-emerald-400/10' : tone === 'rose' ? 'border-rose-300/30 bg-rose-400/10' : tone === 'amber' ? 'border-amber-300/30 bg-amber-400/10' : 'border-cyan-300/20 bg-cyan-400/10'}`}>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">Status APD</p>
              <h2 className="mt-3 text-3xl font-black text-white lg:text-4xl">{ppeStatus}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">{message}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Person" value={status?.people ?? 0} icon="👤" tone="cyan" />
              <MiniStat label="Helm" value={status?.helmet ?? 0} icon="⛑️" tone={(status?.helmet ?? 0) > 0 ? 'emerald' : 'amber'} />
              <MiniStat label="Rompi" value={status?.vest ?? 0} icon="🦺" tone={(status?.vest ?? 0) > 0 ? 'emerald' : 'amber'} />
              <MiniStat label="Confidence" value={confidence} icon="🎯" tone="violet" />
            </div>

            <div className="rounded-[1.6rem] border border-cyan-300/15 bg-white/[0.04] p-5">
              <h3 className="text-lg font-black text-white">Performa Sistem</h3>
              <div className="mt-3">
                <DetectionRow label="FPS Kamera" value={status?.fps_camera ?? 0} />
                <DetectionRow label="FPS Deteksi" value={status?.fps_inference ?? 0} />
                <DetectionRow label="Sumber Kamera" value={config.cameraSource || status?.camera_source} />
                {status?.active_camera_source && <DetectionRow label="API Stream Aktif" value={status.active_camera_source} />}
                {status?.camera_control && <DetectionRow label="Kontrol Kamera" value={status.camera_control} />}
                {status?.camera_error && <DetectionRow label="Error Kamera" value={status.camera_error} />}
                <DetectionRow label="Model" value={status?.model_path || config.modelPath} />
                <DetectionRow label="Update" value={status?.last_update || '-'} />
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-[1.6rem] border border-cyan-300/15 bg-slate-950/80 p-5 shadow-xl shadow-cyan-950/10">
          <h2 className="text-lg font-black text-white">Pengaturan Kamera & YOLO</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">Konfigurasi kamera dikendalikan dari section API agar stream tidak tertimpa oleh nilai lama.</p>
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4">
            <DetectionRow label="Mode Kamera" value={(status?.yolo_enabled ?? config.yoloEnabled) ? 'YOLO' : 'CCTV'} />
            <DetectionRow label="Backend" value={config.backendUrl} />
            <DetectionRow label="Sumber Kamera" value={config.cameraSource || status?.camera_source} />
            {status?.active_camera_source && <DetectionRow label="API Stream Aktif" value={status.active_camera_source} />}
            <DetectionRow label="Model" value={status?.model_path || config.modelPath} />
            <DetectionRow label="JPEG Quality" value={config.jpegQuality} />
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-cyan-300/15 bg-slate-950/80 p-5 shadow-xl shadow-cyan-950/10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-white">Log Deteksi Terbaru</h2>
              <p className="mt-1 text-sm text-slate-400">Log otomatis tersimpan di folder <code className="rounded bg-white/10 px-1">logs/detections.csv</code>.</p>
            </div>
            {canExportLogs && <a href={logCsvUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-center text-sm font-black text-cyan-100 hover:bg-cyan-300/20">Buka CSV</a>}
          </div>
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-cyan-300/10 text-xs uppercase tracking-wider text-cyan-100">
                <tr>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Person</th>
                  <th className="px-4 py-3">Helm</th>
                  <th className="px-4 py-3">Rompi</th>
                  <th className="px-4 py-3">Conf</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {logs.length === 0 ? (
                  <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">Belum ada log deteksi.</td></tr>
                ) : logs.slice(0, 12).map((row, index) => (
                  <tr key={`${row.timestamp}-${index}`} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 text-slate-300">{row.timestamp}</td>
                    <td className="px-4 py-3"><Badge tone={statusTone(row.ppe_status)}>{row.ppe_status}</Badge></td>
                    <td className="px-4 py-3 text-slate-300">{row.people}</td>
                    <td className="px-4 py-3 text-slate-300">{row.helmet}</td>
                    <td className="px-4 py-3 text-slate-300">{row.vest}</td>
                    <td className="px-4 py-3 text-slate-300">{Math.round(Number(row.confidence || 0) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[1.6rem] border border-amber-300/20 bg-amber-400/10 p-5 text-sm leading-7 text-amber-50">
        <p className="font-black">Catatan penting</p>
        <p className="mt-1">Dashboard sudah siap jalan. Namun deteksi helm/rompi AirNav yang akurat membutuhkan model custom <b>models/best.pt</b> hasil training dari foto helm dan rompi AirNav. Jika file belum ada, backend tetap berjalan dalam mode demo.</p>
      </div>
    </div>
  );
}
