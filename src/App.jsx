import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';
const STORAGE_KEY = 'iot-dashboard-api-config-v1';
const DEVICE_WIFI_SAVED_KEY = 'iot-dashboard-device-wifi-saved-v1';
const SESSION_USER_KEY = 'iot-dashboard-session-user-v1';
const SESSION_TOKEN_KEY = 'iot-dashboard-session-token-v1';
const SESSION_ACTIVE_PAGE_KEY = 'iot-dashboard-session-active-page-v1';
const SESSION_LOGIN_PANEL_KEY = 'iot-dashboard-session-login-panel-v1';
const SESSION_AUTH_MODE_KEY = 'iot-dashboard-session-auth-mode-v1';
const JAKARTA_TZ = 'Asia/Makassar';
const SHEET_TIME_TO_WITA_OFFSET_HOURS = 0;
const DEFAULT_USER_MANAGEMENT_API = 'https://script.google.com/macros/s/AKfycbx2t74IMPV1VWD76PA-UlWJkydOYftZ5-2QEa1jkV1wysH3A8UuTa2co7YfkqtU4gPaNw/exec';
const DEVICE_WIFI_OPTIONS = ['ESP32-1', 'ESP32-2', 'ESP32-3'];

const DEFAULT_API_CONFIG = {
  mode: 'dummy',
  temperatureUrl: '',
  rfidUrl: '',
  atsUrl: '',
  userUrl: DEFAULT_USER_MANAGEMENT_API,
  deviceWifiUrl: '',
};

const DEFAULT_ADMIN = {
  id: 'admin-001',
  nama: 'Administrator',
  username: ADMIN_USERNAME,
  password: ADMIN_PASSWORD,
  role: 'admin',
  status: 'approved',
  createdAt: '2026-01-01T00:00:00+07:00',
};

const DEFAULT_USERS = [DEFAULT_ADMIN];

const mockTemperature = [
  { timestamp: '2026-04-30T07:00:00+07:00', jam: '07:00', suhu: 24.8, kelembaban: 70, keterangan: 'Normal' },
  { timestamp: '2026-04-30T08:00:00+07:00', jam: '08:00', suhu: 26.1, kelembaban: 68, keterangan: 'Normal' },
  { timestamp: '2026-04-30T09:00:00+07:00', jam: '09:00', suhu: 29.2, kelembaban: 64, keterangan: 'Normal' },
  { timestamp: '2026-04-30T10:00:00+07:00', jam: '10:00', suhu: 32.3, kelembaban: 59, keterangan: 'Normal' },
  { timestamp: '2026-04-30T11:00:00+07:00', jam: '11:00', suhu: 35.8, kelembaban: 55, keterangan: 'Suhu Panas' },
  { timestamp: '2026-04-30T12:00:00+07:00', jam: '12:00', suhu: 34.7, kelembaban: 57, keterangan: 'Normal' },
  { timestamp: '2026-04-30T13:00:00+07:00', jam: '13:00', suhu: 33.2, kelembaban: 61, keterangan: 'Normal' },
];

const mockRfid = [
  { timestamp: '2026-04-30T07:15:00+07:00', jam: '07:15', uid: 'A1 B2 C3 D4', namaAlat: 'OBENG', status: 'MEMINJAM', keterangan: 'Alat berhasil dipinjam' },
  { timestamp: '2026-04-30T08:05:00+07:00', jam: '08:05', uid: 'E5 F6 G7 H8', namaAlat: 'MULTIMETER', status: 'MEMINJAM', keterangan: 'Alat berhasil dipinjam' },
  { timestamp: '2026-04-30T09:10:00+07:00', jam: '09:10', uid: 'I9 J0 K1 L2', namaAlat: 'SOLDER', status: 'MEMINJAM', keterangan: 'Alat berhasil dipinjam' },
  { timestamp: '2026-04-30T09:42:00+07:00', jam: '09:42', uid: 'XX YY ZZ 00', namaAlat: 'Tidak Terdaftar', status: 'PERINGATAN', keterangan: 'UID tidak terdaftar' },
  { timestamp: '2026-04-30T10:30:00+07:00', jam: '10:30', uid: 'A1 B2 C3 D4', namaAlat: 'OBENG', status: 'MENGEMBALIKAN', keterangan: 'Alat berhasil dikembalikan' },
  { timestamp: '2026-04-30T11:22:00+07:00', jam: '11:22', uid: 'M3 N4 O5 P6', namaAlat: 'TESPEN', status: 'MEMINJAM', keterangan: 'Alat berhasil dipinjam' },
  { timestamp: '2026-04-30T12:15:00+07:00', jam: '12:15', uid: 'E5 F6 G7 H8', namaAlat: 'MULTIMETER', status: 'MENGEMBALIKAN', keterangan: 'Alat berhasil dikembalikan' },
];

/** Contoh struktur kolom log Sheet ATS (Tegangan/Arus/Watt, PLN & Generator = YA/TIDAK, Sumber Aktif, Relay, Keterangan). */
const mockAts = [
  { timestamp: '2026-05-04T12:00:51+07:00', jam: '12:00:51', teganganPln: 0, arusPln: 0, wattPln: 0, teganganGenerator: 0, arusGenerator: 0, wattGenerator: 0, statusPln: 'TIDAK', statusGenerator: 'TIDAK', sumberAktif: 'TIDAK ADA', statusRelay: 'OFF', keterangan: 'Semua sumber mati' },
  { timestamp: '2026-05-04T12:01:18+07:00', jam: '12:01:18', teganganPln: 0, arusPln: 0, wattPln: 0, teganganGenerator: 0, arusGenerator: 0, wattGenerator: 0, statusPln: 'TIDAK', statusGenerator: 'TIDAK', sumberAktif: 'TIDAK ADA', statusRelay: 'OFF', keterangan: 'Semua sumber mati' },
  { timestamp: '2026-05-04T12:02:05+07:00', jam: '12:02:05', teganganPln: 0, arusPln: 0, wattPln: 0, teganganGenerator: 0, arusGenerator: 0, wattGenerator: 0, statusPln: 'TIDAK', statusGenerator: 'TIDAK', sumberAktif: 'TIDAK ADA', statusRelay: 'OFF', keterangan: 'Semua sumber mati' },
  { timestamp: '2026-05-04T12:05:00+07:00', jam: '12:05:00', teganganPln: 220, arusPln: 2.1, wattPln: 462, teganganGenerator: 0, arusGenerator: 0, wattGenerator: 0, statusPln: 'YA', statusGenerator: 'TIDAK', sumberAktif: 'PLN', statusRelay: 'OFF', keterangan: 'Normal PLN' },
  { timestamp: '2026-05-04T12:06:30+07:00', jam: '12:06:30', teganganPln: 221, arusPln: 2.3, wattPln: 508, teganganGenerator: 0, arusGenerator: 0, wattGenerator: 0, statusPln: 'YA', statusGenerator: 'TIDAK', sumberAktif: 'PLN', statusRelay: 'OFF', keterangan: 'Normal PLN' },
  { timestamp: '2026-05-04T12:08:00+07:00', jam: '12:08:00', teganganPln: 0, arusPln: 0, wattPln: 0, teganganGenerator: 226, arusGenerator: 8.2, wattGenerator: 1853, statusPln: 'TIDAK', statusGenerator: 'YA', sumberAktif: 'Generator', statusRelay: 'ON', keterangan: 'Backup Genset' },
  { timestamp: '2026-05-04T12:09:15+07:00', jam: '12:09:15', teganganPln: 0, arusPln: 0, wattPln: 0, teganganGenerator: 224, arusGenerator: 7.9, wattGenerator: 1770, statusPln: 'TIDAK', statusGenerator: 'YA', sumberAktif: 'Generator', statusRelay: 'ON', keterangan: 'Backup Genset' },
  { timestamp: '2026-05-04T12:13:00+07:00', jam: '12:13:00', teganganPln: 219, arusPln: 1.9, wattPln: 416, teganganGenerator: 0, arusGenerator: 0, wattGenerator: 0, statusPln: 'YA', statusGenerator: 'TIDAK', sumberAktif: 'PLN', statusRelay: 'OFF', keterangan: 'Normal PLN' },
];

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '✦' },
  { id: 'suhu', label: 'Suhu', icon: '🌡️' },
  { id: 'rfid', label: 'RFID', icon: '🏷️' },
  { id: 'ats', label: 'ATS', icon: '⚡' },
  { id: 'users', label: 'Manajemen User', icon: '👥', adminOnly: true },
  { id: 'api', label: 'API', icon: '⚙️', adminOnly: true },
];

function classNames(...items) {
  return items.filter(Boolean).join(' ');
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename, columns, rows) {
  const header = columns.map((column) => csvEscape(column.label)).join(',');
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column.key])).join(',')).join('\n');
  const csv = [header, body].filter(Boolean).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function DownloadButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-950/10 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      ⬇ Download Data
    </button>
  );
}

function setStateIfChanged(setter, nextValue) {
  setter((previousValue) => (
    JSON.stringify(previousValue) === JSON.stringify(nextValue) ? previousValue : nextValue
  ));
}

function setStateIfUsable(setter, nextValue) {
  setter((previousValue) => {
    const nextRows = Array.isArray(nextValue) ? nextValue : [];
    const previousRows = Array.isArray(previousValue) ? previousValue : [];

    // Refresh tidak boleh menghapus data yang sedang tampil kalau API sesaat
    // mengembalikan data kosong atau format belum siap.
    if (nextRows.length === 0 && previousRows.length > 0) {
      return previousValue;
    }

    return JSON.stringify(previousValue) === JSON.stringify(nextRows) ? previousValue : nextRows;
  });
}

function safeStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    return null;
  }
  return null;
}

function formatSheetTime(value) {
  if (value === null || value === undefined || value === '') return '--:--:--';

  // Kalau sudah format jam biasa, langsung rapikan
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // contoh: "13:34", "13:34:18", atau "13.34.18".
    // API lama mengirim jam WIB sebagai teks, jadi digeser +1 agar tampil WITA.
    if (/^\d{1,2}[:.]\d{2}([:.]\d{2})?$/.test(trimmed)) {
      const parts = trimmed.replace(/\./g, ':').split(':');
      const shiftedHour = (Number(parts[0]) + SHEET_TIME_TO_WITA_OFFSET_HOURS) % 24;
      const hh = String(shiftedHour).padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      const ss = (parts[2] || '00').padStart(2, '0');
      return `${hh}:${mm}:${ss}`;
    }

    const sheetTimestamp = trimmed.match(/^\d{1,2}\/\d{1,2}\/\d{4}\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?/);
    if (sheetTimestamp) {
      const [, hour, minute, second = '00'] = sheetTimestamp;
      return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}`;
    }

    // contoh: "1899-12-30T03:34:18.000Z" dari Google Sheets.
    // Harus dikonversi timezone, bukan mengambil jam mentah setelah huruf T.
    if (trimmed.includes('T')) {
      const date = new Date(trimmed);
      if (!Number.isNaN(date.getTime())) {
        return formatJakartaTime(date);
      }
    }
  }

  // Kalau angka serial spreadsheet
  if (typeof value === 'number' && !Number.isNaN(value)) {
    const totalSeconds = Math.round(value * 24 * 60 * 60) + (SHEET_TIME_TO_WITA_OFFSET_HOURS * 60 * 60);
    const hh = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, '0');
    const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  // Fallback terakhir
  try {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return formatJakartaTime(date);
    }
  } catch {}

  return '--:--:--';
}

function normalizeUser(user, index = 0) {
  if (!user || typeof user !== 'object') return null;
  const username = String(user.username || user.USERNAME || '').trim();
  const password = String(user.password || user.PASSWORD || '').trim();
  if (!username) return null;
  const rawStatus = String(user.status || user.STATUS || '').trim().toLowerCase();
  const status = rawStatus.includes('diterima') || rawStatus.includes('approved')
    ? 'approved'
    : rawStatus.includes('ditolak') || rawStatus.includes('rejected')
      ? 'rejected'
      : 'pending';
  const rawRole = String(user.role || user.ROLE || '').trim().toLowerCase();
  return {
    id: String(user.id || `usr-${index}-${username}`),
    nama: String(user.nama || user.NAMA || user.name || username),
    username,
    password,
    role: rawRole === 'admin' ? 'admin' : 'user',
    status,
    createdAt: user.createdAt || user.tanggalDaftar || user['TANGGAL DAFTAR'] || new Date().toISOString(),
    approvedAt: user.approvedAt,
    rejectedAt: user.rejectedAt,
    passwordRequestStatus: String(user.passwordRequestStatus || user.PASSWORD_REQUEST_STATUS || user['STATUS RESET PASSWORD'] || '').trim().toLowerCase(),
    requestedPassword: String(user.requestedPassword || user.REQUESTED_PASSWORD || user['PASSWORD BARU'] || '').trim(),
    passwordRequestedAt: user.passwordRequestedAt || user['TANGGAL REQUEST PASSWORD'],
  };
}

function normalizeUsers(value) {
  let source = value;
  if (!Array.isArray(source)) {
    if (Array.isArray(source?.users)) source = source.users;
    else if (Array.isArray(source?.data)) source = source.data;
    else source = [];
  }
  const normalized = source.map(normalizeUser).filter(Boolean);
  const withoutDuplicateAdmin = normalized.filter((user) => user.username !== ADMIN_USERNAME);
  return [DEFAULT_ADMIN, ...withoutDuplicateAdmin];
}

function loadJson(key, fallback) {
  const storage = safeStorage();
  if (!storage) return fallback;
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) return normalizeUsers(parsed);
    return parsed && typeof parsed === 'object' ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can fail in private mode. App should still run.
  }
}

function safeSessionStorage() {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  } catch {
    return null;
  }
  return null;
}

function loadSessionUser() {
  const storage = safeSessionStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(SESSION_USER_KEY);
    if (!raw) return null;
    return normalizeUser(JSON.parse(raw));
  } catch {
    return null;
  }
}

function saveSessionUser(user) {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  } catch {}
}

function clearSessionUser() {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(SESSION_USER_KEY);
  } catch {}
}

function loadSessionToken() {
  const storage = safeSessionStorage();
  if (!storage) return '';
  try {
    return storage.getItem(SESSION_TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

function saveSessionToken(token) {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(SESSION_TOKEN_KEY, token);
  } catch {}
}

function clearSessionToken() {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(SESSION_TOKEN_KEY);
  } catch {}
}

function loadSessionActivePage() {
  const storage = safeSessionStorage();
  if (!storage) return 'dashboard';
  try {
    const value = storage.getItem(SESSION_ACTIVE_PAGE_KEY);
    return navItems.some((item) => item.id === value) ? value : 'dashboard';
  } catch {
    return 'dashboard';
  }
}

function saveSessionActivePage(page) {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(SESSION_ACTIVE_PAGE_KEY, page);
  } catch {}
}

function clearSessionActivePage() {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.removeItem(SESSION_ACTIVE_PAGE_KEY);
  } catch {}
}

function loadSessionLoginPanel() {
  const storage = safeSessionStorage();
  if (!storage) return false;
  try {
    return storage.getItem(SESSION_LOGIN_PANEL_KEY) === 'open';
  } catch {
    return false;
  }
}

function saveSessionLoginPanel(showLogin) {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(SESSION_LOGIN_PANEL_KEY, showLogin ? 'open' : 'closed');
  } catch {}
}

function loadSessionAuthMode() {
  const storage = safeSessionStorage();
  if (!storage) return 'login';
  try {
    const value = storage.getItem(SESSION_AUTH_MODE_KEY);
    return ['login', 'register', 'forgot'].includes(value) ? value : 'login';
  } catch {
    return 'login';
  }
}

function saveSessionAuthMode(mode) {
  const storage = safeSessionStorage();
  if (!storage) return;
  try {
    storage.setItem(SESSION_AUTH_MODE_KEY, ['login', 'register', 'forgot'].includes(mode) ? mode : 'login');
  } catch {}
}

function getSafeUsers(users) {
  return normalizeUsers(users);
}

function hasAllApiUrls(config) {
  return Boolean(config?.temperatureUrl?.trim() && config?.rfidUrl?.trim() && config?.atsUrl?.trim());
}

function hasAnyDataApiUrl(config) {
  return Boolean(config?.temperatureUrl?.trim() || config?.rfidUrl?.trim() || config?.atsUrl?.trim());
}

function formatJakartaTime(value = new Date()) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: JAKARTA_TZ,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date(value));
  } catch {
    return '--:--:--';
  }
}

function formatJakartaDate(value = new Date()) {
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: JAKARTA_TZ,
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return 'Tanggal tidak tersedia';
  }
}

function getTempStatus(suhu) {
  const value = Number(suhu);
  if (Number.isNaN(value)) return 'Sensor Error';
  if (value >= 35) return 'Suhu Panas';
  if (value <= 20) return 'Suhu Dingin';
  return 'Normal';
}

function normalizeRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function getRowValue(row, keys) {
  if (!row || typeof row !== 'object') return undefined;
  for (const key of keys) {
    if (row[key] !== undefined) return row[key];
  }

  const normalizedKeys = Object.keys(row).reduce((result, key) => {
    result[String(key).trim().toLowerCase().replace(/\s+/g, '')] = row[key];
    return result;
  }, {});

  for (const key of keys) {
    const normalizedKey = String(key).trim().toLowerCase().replace(/\s+/g, '');
    if (normalizedKeys[normalizedKey] !== undefined) return normalizedKeys[normalizedKey];
  }

  return undefined;
}

function getRowCells(row) {
  if (Array.isArray(row)) return row;
  if (!row || typeof row !== 'object') return [];
  return Object.values(row);
}

function isPlausibleTemperature(value) {
  const number = parseSheetNumber(value, NaN);
  return Number.isFinite(number) && number >= -20 && number <= 60;
}

function isPlausibleHumidity(value) {
  const number = parseSheetNumber(value, NaN);
  return Number.isFinite(number) && number >= 1 && number <= 100;
}

function pickTemperatureValues(candidates, cells) {
  const allCandidates = [];

  for (let index = cells.length - 2; index >= 2; index -= 1) {
    const suhuValue = cells[index];
    const humidityValue = cells[index + 1];
    allCandidates.push([suhuValue, humidityValue, cells[index + 2], index]);
  }

  candidates.forEach((candidate) => allCandidates.push([...candidate, -1]));

  const validCandidates = allCandidates
    .map((candidate) => {
      const [suhuValue, humidityValue, keteranganValue, columnIndex = -1] = candidate;
      const suhu = parseSheetNumber(suhuValue, NaN);
      const humidity = parseSheetNumber(humidityValue, NaN);

      if (!isPlausibleTemperature(suhuValue) || !isPlausibleHumidity(humidityValue)) {
        return null;
      }

      let score = 0;
      if (suhu >= 20 && suhu <= 45) score += 8;
      if (humidity >= 40 && humidity <= 100) score += 8;
      if (humidity > suhu + 5) score += 3;
      if (columnIndex >= 2) score += columnIndex;

      return { candidate: [suhuValue, humidityValue, keteranganValue], score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return validCandidates[0]?.candidate || candidates[0];
}

function timeScore(row, index = 0) {
  const date = new Date(row?.timestamp);
  if (!Number.isNaN(date.getTime()) && date.getFullYear() > 2000) return date.getTime();

  const timestampMatch = String(row?.timestamp || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?)?/);
  if (timestampMatch) {
    const [, day, month, year, hour = '0', minute = '0', second = '0'] = timestampMatch;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ).getTime();
  }

  const timeParts = String(row?.jam || '').replace(/\./g, ':').split(':').map(Number);
  if (timeParts.length >= 2 && timeParts.every((part) => Number.isFinite(part))) {
    return ((timeParts[0] * 3600) + (timeParts[1] * 60) + (timeParts[2] || 0)) * 1000;
  }

  return index;
}

function getLatestDataRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return {};
  return rows.reduce((latest, row, index) => (
    timeScore(row, index) >= timeScore(latest.row, latest.index)
      ? { row, index }
      : latest
  ), { row: rows[0], index: 0 }).row;
}

function normalizeTemperature(payload) {
  return normalizeRows(payload).map((row, index) => {
    const cells = getRowCells(row);
    const rawSuhu = getRowValue(row, ['suhu', 'Suhu', 'SUHU', 'temperature', 'Temperature']);
    const rawKelembaban = getRowValue(row, ['kelembaban', 'Kelembaban', 'KELEMBABAN', 'humidity', 'Humidity']);
    const rawKeterangan = getRowValue(row, ['keterangan', 'Keterangan', 'KETERANGAN', 'ket', 'Ket', 'KET']);
    const [selectedSuhu, selectedKelembaban, selectedKeterangan] = pickTemperatureValues([
      [rawSuhu, rawKelembaban, rawKeterangan],
      [cells[2], cells[3], cells[4]],
      [rawKelembaban, rawKeterangan, cells[5]],
      [cells[3], cells[4], cells[5]],
    ], cells);
    const suhu = parseSheetNumber(selectedSuhu, NaN);
    const kelembaban = parseSheetNumber(selectedKelembaban, NaN);
    const timestamp = getRowValue(row, ['timestamp', 'Timestamp', 'TIMESTAMP', 'tanggal', 'Tanggal', 'TANGGAL']) ?? cells[0] ?? new Date().toISOString();
    const safeKeterangan = Number.isFinite(parseSheetNumber(selectedKeterangan, NaN))
      ? getTempStatus(suhu)
      : selectedKeterangan;
    return {
      id: row.id ?? index,
      timestamp,
      jam: formatSheetTime(timestamp),
      suhu,
      kelembaban,
      keterangan: safeKeterangan ?? getTempStatus(suhu),
    };
  })
    .filter((row) => Number.isFinite(row.suhu) && Number.isFinite(row.kelembaban))
    .sort((a, b) => timeScore(a) - timeScore(b));
}

function normalizeRfid(payload) {
  return normalizeRows(payload).map((row, index) => {
    const timestamp = row.timestamp ?? row.Timestamp ?? new Date().toISOString();
    const rawJam = row.jam ?? row.Jam ?? timestamp;

    return {
      id: row.id ?? index,
      timestamp,
      jam: formatSheetTime(rawJam),
      uid: row.uid ?? row.UID ?? row['UID Kartu'] ?? '-',
      namaAlat: row.namaAlat ?? row['Nama Alat'] ?? row.alat ?? row.Alat ?? 'Tidak Terdaftar',
      status: row.status ?? row.Status ?? 'PERINGATAN',
      keterangan: row.keterangan ?? row.Keterangan ?? '-',
    };
  });
}

function parseSheetNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const cleaned = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.+-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

/** Sel kosong Sheet "PLN" / "Generator" bisa berisi tegangan (angka) atau teks YA/TIDAK. */
function isPlausibleVoltageCell(value) {
  if (value === null || value === undefined || value === '') return false;
  const s = String(value).trim().toUpperCase();
  if (['TIDAK', 'YA', 'ADA', 'TIDAK ADA', '-', 'OFF', 'ON'].includes(s)) return false;
  return Number.isFinite(parseSheetNumber(value, NaN));
}

function normalizeRelayValue(raw) {
  if (raw === null || raw === undefined || raw === '') return '-';
  const u = String(raw).trim().toUpperCase();
  if (u === 'ON' || u === 'OFF') return u;
  return String(raw).trim();
}

function normalizeAts(payload) {
  return normalizeRows(payload).map((row, index) => {
    const timestamp = row.timestamp ?? row.Timestamp ?? row.tanggal ?? row.Tanggal ?? new Date().toISOString();
    const rawJam = row.jam ?? row.Jam ?? timestamp;

    const teganganPln = parseSheetNumber(
      row.teganganPln
      ?? row['Tegangan PLN']
      ?? row['tegangan pln']
      ?? (isPlausibleVoltageCell(row.pln) ? row.pln : undefined)
      ?? (isPlausibleVoltageCell(row.PLN) ? row.PLN : undefined),
    );

    const teganganGenerator = parseSheetNumber(
      row.teganganGenerator
      ?? row['Tegangan Generator']
      ?? row['tegangan generator']
      ?? row['Tegangan Genset']
      ?? (isPlausibleVoltageCell(row.generator) ? row.generator : undefined)
      ?? (isPlausibleVoltageCell(row.Generator) ? row.Generator : undefined),
    );

    const arusPln = parseSheetNumber(row.arusPln ?? row['Arus PLN'] ?? row['arus pln']);
    const wattPln = parseSheetNumber(row.wattPln ?? row['Watt PLN'] ?? row['watt pln'] ?? row['Daya PLN']);
    const arusGenerator = parseSheetNumber(row.arusGenerator ?? row['Arus Generator'] ?? row['arus generator']);
    const wattGenerator = parseSheetNumber(row.wattGenerator ?? row['Watt Generator'] ?? row['watt generator'] ?? row['Daya Generator']);

    const statusPln = row.statusPln
      ?? row['Status PLN']
      ?? (!isPlausibleVoltageCell(row.PLN) && row.PLN != null && String(row.PLN).trim() !== '' ? String(row.PLN).trim() : undefined)
      ?? (teganganPln > 0 ? 'YA' : 'TIDAK');

    const statusGenerator = row.statusGenerator
      ?? row['Status Generator']
      ?? (!isPlausibleVoltageCell(row.Generator) && row.Generator != null && String(row.Generator).trim() !== '' ? String(row.Generator).trim() : undefined)
      ?? (teganganGenerator > 0 ? 'YA' : 'TIDAK');

    const statusRelay = normalizeRelayValue(row.statusRelay ?? row.Relay ?? row['Status Relay'] ?? row.relay);

    return {
      id: row.id ?? index,
      timestamp,
      jam: formatSheetTime(rawJam),
      teganganPln,
      arusPln,
      wattPln,
      teganganGenerator,
      arusGenerator,
      wattGenerator,
      statusPln,
      statusGenerator,
      sumberAktif: String(row.sumberAktif ?? row['Sumber Aktif'] ?? '-').trim() || '-',
      statusRelay,
      keterangan: row.keterangan ?? row.Keterangan ?? '-',
    };
  });
}


async function fetchSheetJson(url) {
  const cleanUrl = String(url || '').trim();

  if (!cleanUrl) {
    return { data: [], skipped: true, reason: 'URL API belum diisi' };
  }

  const finalUrl = cleanUrl.includes('?')
    ? `${cleanUrl}&_=${Date.now()}`
    : `${cleanUrl}?_=${Date.now()}`;

  const response = await fetch(finalUrl, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('API Manajemen User ditolak Google. Deploy Apps Script sebagai Web App dengan akses Anyone.');
    }
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

async function fetchUserApiJson(apiUrl, params = {}) {
  const baseUrl = getUserManagementApiUrl(apiUrl);
  const query = new URLSearchParams({ ...params, _: String(Date.now()) });
  const separator = baseUrl.includes('?') ? '&' : '?';
  const response = await fetch(`${baseUrl}${separator}${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(response.status === 403 ? 'API Manajemen User ditolak Google.' : `HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.success === false) {
    throw new Error(payload.message || 'Request API Manajemen User gagal.');
  }
  return payload;
}

async function fetchStandaloneApiJson(apiUrl, params = {}, label = 'API') {
  const baseUrl = String(apiUrl || '').trim();
  if (!baseUrl) throw new Error(`${label} wajib diisi.`);

  const query = new URLSearchParams({ ...params, _: String(Date.now()) });
  const separator = baseUrl.includes('?') ? '&' : '?';
  const response = await fetch(`${baseUrl}${separator}${query.toString()}`, {
    method: 'GET',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(response.status === 403 ? `${label} ditolak Google.` : `HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload?.success === false) {
    throw new Error(payload.message || `Request ${label} gagal.`);
  }
  return payload;
}

async function postStandaloneApiAction(apiUrl, payload = {}, label = 'API') {
  const baseUrl = String(apiUrl || '').trim();
  if (!baseUrl) throw new Error(`${label} wajib diisi.`);

  const response = await fetch(baseUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
  });

  if (response.type === 'opaque') {
    return { success: true };
  }

  if (!response.ok) {
    throw new Error(response.status === 403 ? `${label} ditolak Google.` : `HTTP ${response.status}`);
  }

  const text = await response.text();
  if (!text) return { success: true };

  try {
    const result = JSON.parse(text);
    if (result.success === false) {
      throw new Error(result.message || `Request ${label} gagal.`);
    }
    return result;
  } catch (error) {
    if (error instanceof SyntaxError) return { success: true, raw: text };
    throw error;
  }
}

function getUserManagementApiUrl(apiUrl) {
  return String(apiUrl || DEFAULT_USER_MANAGEMENT_API).trim();
}

async function postUserSpreadsheetAction(apiUrl, payload, sessionToken = '') {
  const response = await fetch(getUserManagementApiUrl(apiUrl), {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({ sheet: 'users', token: sessionToken, ...payload }),
  });

  if (response.type === 'opaque') {
    return { success: true };
  }

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('API Manajemen User ditolak Google. Deploy Apps Script sebagai Web App dengan akses Anyone.');
    }
    throw new Error(`HTTP ${response.status}`);
  }

  const text = await response.text();
  if (!text) return { success: true };

  try {
    const result = JSON.parse(text);
    if (result.success === false) {
      throw new Error(result.message || 'Spreadsheet menolak data pendaftaran.');
    }
    return result;
  } catch (error) {
    if (error instanceof SyntaxError) return { success: true, raw: text };
    throw error;
  }
}

async function loginWithUserApi(apiUrl, username, password) {
  return fetchUserApiJson(apiUrl, {
    action: 'login',
    username,
    password,
  });
}

async function loadUsersFromSpreadsheet(apiUrl, sessionToken = '') {
  const payload = await fetchUserApiJson(apiUrl, {
    action: 'getUsers',
    token: sessionToken,
  });
  return getSafeUsers(payload);
}

function normalizeDashboardConfig(payload, fallback = DEFAULT_API_CONFIG) {
  const source = payload?.config || payload?.settings || payload?.data || payload || {};
  const nextConfig = {
    ...fallback,
    temperatureUrl: source.temperatureUrl || source.API_SUHU || source.apiSuhu || fallback.temperatureUrl || '',
    rfidUrl: source.rfidUrl || source.API_RFID || source.apiRfid || fallback.rfidUrl || '',
    atsUrl: source.atsUrl || source.API_ATS || source.apiAts || fallback.atsUrl || '',
    userUrl: source.userUrl || source.API_USER || source.apiUser || fallback.userUrl || DEFAULT_USER_MANAGEMENT_API,
    deviceWifiUrl: source.deviceWifiUrl || source.API_WIFI_ESP32 || source.apiWifiEsp32 || fallback.deviceWifiUrl || '',
  };
  const nextMode = source.mode || source.MODE || fallback.mode || 'dummy';
  return {
    ...nextConfig,
    mode: nextMode === 'api' && !hasAnyDataApiUrl(nextConfig) ? 'dummy' : nextMode,
  };
}

async function loadDashboardConfigFromBackend(apiUrl, fallbackConfig = DEFAULT_API_CONFIG) {
  const payload = await fetchUserApiJson(apiUrl, {
    action: 'getdashboardconfig',
  });
  return normalizeDashboardConfig(payload, fallbackConfig);
}

async function saveDashboardConfigToBackend(apiUrl, config, sessionToken = '') {
  return postUserSpreadsheetAction(apiUrl, {
    action: 'updatedashboardconfig',
    config,
  }, sessionToken);
}

async function saveRegistrationToSpreadsheet(apiUrl, user) {
  return postUserSpreadsheetAction(apiUrl, {
    action: 'register',
    id: user.id,
    nama: user.nama,
    username: user.username,
    password: user.password,
    role: user.role.toUpperCase(),
    status: 'MENUNGGU VALIDASI',
    aksi: 'MENUNGGU AKSI ADMIN',
    createdAt: user.createdAt,
  });
}

async function updateUserStatusInSpreadsheet(apiUrl, user, sessionToken) {
  const action = user.status === 'approved' ? 'approve' : user.status === 'rejected' ? 'reject' : 'pending';
  return postUserSpreadsheetAction(apiUrl, {
    action,
    id: user.id,
    username: user.username,
    status: user.status === 'approved' ? 'DITERIMA' : user.status === 'rejected' ? 'DITOLAK' : 'MENUNGGU VALIDASI',
    approvedAt: user.approvedAt,
    rejectedAt: user.rejectedAt,
  }, sessionToken);
}

async function deleteUserFromSpreadsheet(apiUrl, user, sessionToken) {
  return postUserSpreadsheetAction(apiUrl, {
    action: 'deleteuser',
    id: user.id,
    username: user.username,
  }, sessionToken);
}

async function updateUserPasswordInSpreadsheet(apiUrl, user, sessionToken) {
  return postUserSpreadsheetAction(apiUrl, {
    action: 'updatepassword',
    id: user.id,
    username: user.username,
    password: user.password,
    passwordUpdatedAt: user.passwordUpdatedAt,
  }, sessionToken);
}

async function requestUserPasswordChangeInSpreadsheet(apiUrl, user) {
  return postUserSpreadsheetAction(apiUrl, {
    action: 'requestpasswordchange',
    username: user.username,
    password: user.password,
    passwordRequestedAt: user.passwordRequestedAt,
  });
}

async function approveUserPasswordChangeInSpreadsheet(apiUrl, user, sessionToken) {
  return postUserSpreadsheetAction(apiUrl, {
    action: 'approvepasswordchange',
    username: user.username,
  }, sessionToken);
}

async function rejectUserPasswordChangeInSpreadsheet(apiUrl, user, sessionToken) {
  return postUserSpreadsheetAction(apiUrl, {
    action: 'rejectpasswordchange',
    username: user.username,
  }, sessionToken);
}

async function updateDeviceWifiInSpreadsheet(apiUrl, device, wifiSsid, wifiPassword) {
  return postStandaloneApiAction(apiUrl, {
    action: 'updatedevicewifi',
    device,
    wifiSsid,
    wifiPassword,
  }, 'API WiFi ESP32');
}

function runSelfTests() {
  if (typeof console === 'undefined') return;
  console.assert(hasAllApiUrls({ temperatureUrl: 'a', rfidUrl: 'b', atsUrl: 'c' }) === true, 'API config lengkap harus valid');
  console.assert(hasAllApiUrls({ temperatureUrl: '', rfidUrl: 'b', atsUrl: 'c' }) === false, 'API config kosong harus tidak valid');
  console.assert(normalizeTemperature({ data: [{ Suhu: '36', Kelembaban: '60', Jam: '10:00' }] })[0].keterangan === 'Suhu Panas', 'Normalisasi suhu harus membuat status panas');
  console.assert(normalizeTemperature({ data: [{ Timestamp: '18/05/2026 23:18:23', Jam: '22:18:22', Suhu: '31.3', Kelembaban: '86.0', Keterangan: 'Normal' }] })[0].suhu === 31.3, 'Suhu 31.3 dari kolom Suhu harus tampil');
  console.assert(normalizeTemperature({ data: [{ Timestamp: '18/05/2026 23:18:13', Jam: '22:18:13', Suhu: '30.2', Kelembaban: '80.0', Keterangan: 'Normal' }] })[0].kelembaban === 80, 'Kelembaban 80 tidak boleh menjadi suhu');
  console.assert(normalizeRfid({ rows: [{ UID: 'AA', Alat: 'OBENG', Status: 'MEMINJAM' }] })[0].namaAlat === 'OBENG', 'Normalisasi RFID harus membaca nama alat');
  console.assert(normalizeAts({ result: [{ PLN: 220, Generator: 0, 'Sumber Aktif': 'PLN' }] })[0].teganganPln === 220, 'Normalisasi ATS harus membaca tegangan PLN');
  console.assert(
    normalizeAts({ result: [{ 'Tegangan PLN': 0, PLN: 'TIDAK', Generator: 'TIDAK', 'Sumber Aktif': 'TIDAK ADA', Relay: 'OFF', Keterangan: 'Semua sumber mati' }] })[0].statusPln === 'TIDAK'
    && normalizeAts({ result: [{ 'Tegangan PLN': 0, PLN: 'TIDAK', Generator: 'TIDAK', 'Sumber Aktif': 'TIDAK ADA', Relay: 'OFF', Keterangan: 'Semua sumber mati' }] })[0].teganganPln === 0,
    'Kolom PLN teks TIDAK tidak boleh dianggap tegangan',
  );
  console.assert(Array.isArray(normalizeUsers(null)) === true, 'Users null harus menjadi array');
  console.assert(normalizeUsers({ users: [{ username: 'budi', password: '1234' }] }).some((user) => user.username === 'budi'), 'Users object lama harus dinormalisasi');
  console.assert(normalizeUsers({ broken: true }).some((user) => user.username === ADMIN_USERNAME), 'Storage rusak harus tetap punya admin default');
}

runSelfTests();

function statusTone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('tidak ada')) return 'red';
  if (value.trim() === 'tidak') return 'orange';
  if (value.trim() === 'ya') return 'green';
  if (value.includes('pending') || value.includes('menunggu') || value.includes('saved') || value.includes('loading')) return 'yellow';
  if (value.includes('approved') || value.includes('diterima') || value.includes('dummy') || value.includes('connected')) return 'green';
  if (value.includes('rejected') || value.includes('ditolak')) return 'red';
  if (value.includes('panas') || value.includes('peringatan') || value.includes('error') || value.includes('semua') || value.includes('mati') || value.includes('kritis')) return 'red';
  if (value.includes('dingin')) return 'blue';
  if (value.includes('meminjam')) return 'orange';
  if (value.includes('backup') || value.includes('generator') || value.includes('perhatian') || value.includes('belum')) return 'yellow';
  if (value.includes('mengembalikan') || value.includes('normal') || value.includes('aktif') || value.includes('pln') || value.includes('stabil')) return 'green';
  return 'slate';
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    yellow: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    purple: 'border-violet-200 bg-violet-50 text-violet-700',
  };
  return <span className={classNames('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black', tones[tone] || tones.slate)}>{children}</span>;
}

function Card({ children, className = '' }) {
  return <div className={classNames('rounded-3xl border border-slate-200 bg-white p-5 shadow-sm', className)}>{children}</div>;
}

function StatCard({ title, value, suffix, icon, status, tone = 'cyan', helper }) {
  const gradients = {
    cyan: 'from-cyan-500 to-blue-600',
    blue: 'from-blue-500 to-indigo-600',
    green: 'from-emerald-500 to-teal-600',
    orange: 'from-orange-500 to-amber-500',
    red: 'from-rose-500 to-red-600',
    purple: 'from-violet-500 to-indigo-600',
  };
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-cyan-100/70" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="mt-2 flex items-end gap-1">
            <p className="text-2xl font-black text-slate-950">{value}</p>
            {suffix && <span className="mb-1 text-sm font-semibold text-slate-500">{suffix}</span>}
          </div>
          {status && <div className="mt-3"><Badge tone={statusTone(status)}>{status}</Badge></div>}
          {helper && <p className="mt-3 text-xs text-slate-500">{helper}</p>}
        </div>
        <div className={classNames('grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br text-xl text-white shadow-lg', gradients[tone] || gradients.cyan)}>{icon}</div>
      </div>
    </Card>
  );
}

function PageHeader({ title, description, children }) {
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950 lg:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

function DataTable({ columns, rows, emptyMessage, tableClassName = 'min-w-[760px]' }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className={classNames('w-full text-left text-sm', tableClassName)}>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{columns.map((column) => <th key={column.key} className="px-5 py-4 font-black">{column.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {safeRows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-5 py-8 text-center text-slate-500">{emptyMessage}</td></tr>
            ) : safeRows.map((row, index) => (
              <tr key={row.id ?? `${row.timestamp}-${index}`} className="hover:bg-slate-50/80">
                {columns.map((column) => <td key={column.key} className="px-5 py-4 align-middle text-slate-700">{column.render ? column.render(row) : row[column.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ChartCard({ title, description, children }) {
  return (
    <Card className="min-h-[360px]">
      <div className="mb-4">
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <div className="h-72 w-full">{children}</div>
    </Card>
  );
}

function PasswordInput({ value, onChange, placeholder }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 pr-14 text-sm text-white outline-none ring-cyan-400 transition placeholder:text-slate-500 focus:ring-2"
      />
      <button
        type="button"
        onClick={() => setShowPassword((previous) => !previous)}
        className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
        aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
        title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
      >
        {showPassword ? '🙈' : '👁️'}
      </button>
    </div>
  );
}

function LoginPage({ temperature, rfid, ats, onLogin, loginForm, setLoginForm, loginError, registerForm, setRegisterForm, registerError, registerSuccess, registerLoading, onRegister, forgotForm, setForgotForm, forgotError, forgotSuccess, forgotLoading, onForgotPassword }) {
  const [showLogin, setShowLogin] = useState(() => loadSessionLoginPanel());
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [disableMotion, setDisableMotion] = useState(false);
  const [language, setLanguage] = useState('id');
  const [authMode, setAuthMode] = useState(() => loadSessionAuthMode());

  useEffect(() => saveSessionLoginPanel(showLogin), [showLogin]);
  useEffect(() => saveSessionAuthMode(authMode), [authMode]);

  const translations = {
    id: {
      monitoring: 'Monitoring',
      admin: 'Admin',
      airnavOperation: 'Airnav Intelligent Operation',
      heroTitle: 'Sistem Monitoring IoT By Airnav',
      heroDesc: 'Platform monitoring terintegrasi untuk suhu dan kelembaban, RFID peminjaman alat, serta ATS PLN / Generator dalam satu command center modern.',
      systemsOnline: 'Sistem Online',
      latestTemp: 'Suhu Terkini',
      powerSource: 'Sumber Daya',
      update: 'Update',
      operationsPreview: 'Operations Preview',
      systemSummary: 'Ringkasan Sistem',
      quickData: 'Data cepat sebelum masuk ke dashboard admin.',
      tempMonitoring: 'Monitoring Suhu',
      rfidTools: 'RFID Alat',
      atsSystem: 'ATS PLN / Generator',
      humidity: 'Kelembaban',
      statusUnavailable: 'Status belum tersedia',
      waitingScan: 'Menunggu scan kartu',
      electricityStatus: 'Status sumber listrik',
      relay: 'Relay',
      enterAdminCenter: 'Masuk ke Admin Center',
      adminGate: 'Admin Access Gate',
      adminGateDesc: 'Masuk untuk membuka dashboard, grafik, tabel riwayat, dan pengaturan API.',
      username: 'Username',
      password: 'Password',
      closeLogin: 'Tutup login',
      enterAdminCommand: 'Enter Admin Command Center',
      demoLogin: 'Demo login',
      footerRights: '© 2026 Airnav IoT Monitoring. All rights reserved.',
    },
    en: {
      monitoring: 'Monitoring',
      admin: 'Admin',
      airnavOperation: 'Airnav Intelligent Operation',
      heroTitle: 'Airnav IoT Monitoring System',
      heroDesc: 'An integrated monitoring platform for temperature and humidity, RFID tool borrowing, and ATS PLN / Generator status in one modern command center.',
      systemsOnline: 'Systems Online',
      latestTemp: 'Latest Temp',
      powerSource: 'Power Source',
      update: 'Updated',
      operationsPreview: 'Operations Preview',
      systemSummary: 'System Summary',
      quickData: 'Quick data before entering the admin dashboard.',
      tempMonitoring: 'Temperature Monitoring',
      rfidTools: 'RFID Tools',
      atsSystem: 'ATS PLN / Generator',
      humidity: 'Humidity',
      statusUnavailable: 'Status unavailable',
      waitingScan: 'Waiting for card scan',
      electricityStatus: 'Power source status',
      relay: 'Relay',
      enterAdminCenter: 'Enter Admin Center',
      adminGate: 'Admin Access Gate',
      adminGateDesc: 'Sign in to open the dashboard, charts, history tables, and API settings.',
      username: 'Username',
      password: 'Password',
      closeLogin: 'Close login',
      enterAdminCommand: 'Enter Admin Command Center',
      demoLogin: 'Demo login',
      footerRights: '© 2026 Airnav IoT Monitoring. All rights reserved.',
    },
  };

  const t = translations[language] || translations.id;
  const [activeNav, setActiveNav] = useState(() => t.monitoring);

  useEffect(() => setActiveNav(showLogin ? t.admin : t.monitoring), [language, showLogin, t.admin, t.monitoring]);
  useEffect(() => {
    const updateMotionPreference = () => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const shouldDisable = window.matchMedia('(max-width: 1023px), (pointer: coarse), (prefers-reduced-motion: reduce)').matches;
      setDisableMotion(shouldDisable);
      if (shouldDisable) setMouse({ x: 0, y: 0 });
    };
    updateMotionPreference();
    window.addEventListener('resize', updateMotionPreference);
    return () => window.removeEventListener('resize', updateMotionPreference);
  }, []);

  const latestTemp = getLatestDataRow(temperature);
  const latestAts = getLatestDataRow(ats);
  const latestRfid = getLatestDataRow(rfid);
  const activeSystems = [temperature.length > 0, rfid.length > 0, ats.length > 0].filter(Boolean).length;
  const updateLogin = (field, value) => setLoginForm((previous) => ({ ...previous, [field]: value }));
  const updateRegister = (field, value) => setRegisterForm((previous) => ({ ...previous, [field]: value }));
  const updateForgot = (field, value) => setForgotForm((previous) => ({ ...previous, [field]: value }));

  const modules = [
    {
      label: t.tempMonitoring,
      value: `${latestTemp.suhu ?? '-'}°C`,
      detail: `${t.humidity} ${latestTemp.kelembaban ?? '-'}% • ${latestTemp.keterangan || t.statusUnavailable}`,
      icon: '🌡️',
      color: 'from-cyan-300/20 via-sky-400/10 to-blue-500/10',
    },
    {
      label: t.rfidTools,
      value: latestRfid.namaAlat || 'Standby',
      detail: latestRfid.status ? `${latestRfid.status} • ${latestRfid.jam || '--:--'} WITA` : t.waitingScan,
      icon: '🏷️',
      color: 'from-lime-300/20 via-emerald-400/10 to-cyan-400/10',
    },
    {
      label: t.atsSystem,
      value: latestAts.sumberAktif || '-',
      detail: `${latestAts.keterangan || t.electricityStatus} • ${t.relay} ${latestAts.statusRelay || '-'}`,
      icon: '⚡',
      color: 'from-fuchsia-300/20 via-violet-400/10 to-cyan-400/10',
    },
  ];

  const navLinks = [
    { label: t.monitoring, action: () => { setShowLogin(false); setActiveNav(t.monitoring); } },
    { label: t.admin, action: () => { setShowLogin(true); setActiveNav(t.admin); setAuthMode('login'); } },
  ];

  const handleMouseMove = (event) => {
    if (disableMotion) return;
    const nextX = (event.clientX / window.innerWidth - 0.5) * 2;
    const nextY = (event.clientY / window.innerHeight - 0.5) * 2;
    setMouse({ x: nextX, y: nextY });
  };

  const parallaxHero = disableMotion ? undefined : { transform: `perspective(1200px) rotateY(${mouse.x * 4.2}deg) rotateX(${-mouse.y * 3.4}deg) translate3d(${mouse.x * 14}px, ${mouse.y * 10}px, 0)` };
  const parallaxGrid = disableMotion ? undefined : { transform: `translate3d(${mouse.x * -16}px, ${mouse.y * -12}px, 0)` };
  const parallaxPanel = disableMotion ? undefined : { transform: `perspective(950px) rotateY(${mouse.x * -2.4}deg) rotateX(${mouse.y * 1.8}deg) translate3d(${mouse.x * -8}px, ${mouse.y * -6}px, 0)` };

  return (
    <div onMouseMove={disableMotion ? undefined : handleMouseMove} onMouseLeave={() => setMouse({ x: 0, y: 0 })} className="relative min-h-screen overflow-x-hidden overflow-y-auto bg-black text-white">
      <style>{`
        @keyframes premiumGridDrift { 0%, 100% { opacity: .22; background-position: 0 0; } 50% { opacity: .42; background-position: 16px -12px; } }
        @keyframes premiumPlaneFloat { 0%, 100% { transform: translateY(0) scale(1) rotate(-2deg); filter: drop-shadow(0 0 22px rgba(34,211,238,.22)); } 50% { transform: translateY(-13px) scale(1.03) rotate(2deg); filter: drop-shadow(0 0 54px rgba(125,211,252,.42)); } }
        @keyframes premiumPlaneDash { to { stroke-dashoffset: -220; } }
        @keyframes premiumGlowText { 0%, 100% { opacity: .92; filter: drop-shadow(0 0 12px rgba(34,211,238,.16)); letter-spacing: .01em; } 50% { opacity: 1; filter: drop-shadow(0 0 28px rgba(34,211,238,.38)); letter-spacing: .025em; } }
        @keyframes premiumOrbitSpin { to { transform: rotate(360deg); } }
        @keyframes premiumOrbitSpinReverse { to { transform: rotate(-360deg); } }
        @keyframes premiumRadarPulse { 0% { transform: scale(.58); opacity: .48; } 75% { opacity: .12; } 100% { transform: scale(1.35); opacity: 0; } }
        @keyframes premiumScanSweep { 0% { transform: translateX(-140%) rotate(-8deg); opacity: 0; } 18% { opacity: .18; } 48% { opacity: .44; } 100% { transform: translateX(170%) rotate(-8deg); opacity: 0; } }
        @keyframes premiumBlobFloatA { 0%, 100% { translate: 0 0; scale: 1; } 50% { translate: 24px -20px; scale: 1.08; } }
        @keyframes premiumBlobFloatB { 0%, 100% { translate: 0 0; scale: 1; } 50% { translate: -18px 18px; scale: .96; } }
        @keyframes premiumFadeUp { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes premiumFloatCard { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes premiumTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes premiumShimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
        .premium-grid-drift { animation: premiumGridDrift 8s ease-in-out infinite; }
        .premium-plane-float { animation: premiumPlaneFloat 5.8s ease-in-out infinite; }
        .premium-plane-dash { stroke-dasharray: 10 10; animation: premiumPlaneDash 7s linear infinite; }
        .premium-text-glow { animation: premiumGlowText 4.8s ease-in-out infinite; }
        .premium-orbit { animation: premiumOrbitSpin 18s linear infinite; }
        .premium-orbit-reverse { animation: premiumOrbitSpinReverse 14s linear infinite; }
        .premium-radar-pulse { animation: premiumRadarPulse 2.8s ease-out infinite; }
        .premium-scan-line { animation: premiumScanSweep 6.4s linear infinite; }
        .premium-blob-a { animation: premiumBlobFloatA 12s ease-in-out infinite; }
        .premium-blob-b { animation: premiumBlobFloatB 14s ease-in-out infinite; }
        .premium-fade-up { animation: premiumFadeUp .9s ease-out both; }
        .premium-float-card { animation: premiumFloatCard 5.5s ease-in-out infinite; }
        .premium-ticker { animation: premiumTicker 22s linear infinite; }
        .premium-shimmer::after { content: ""; position: absolute; inset: 0; background: linear-gradient(110deg, transparent 0%, rgba(255,255,255,.18) 42%, rgba(255,255,255,.34) 50%, rgba(255,255,255,.16) 58%, transparent 100%); transform: translateX(-120%); animation: premiumShimmer 4.2s ease-in-out infinite; }
      `}</style>

      <div className="fixed inset-0 -z-10 overflow-hidden bg-black">
        <div className="absolute left-[8%] top-[8%]"><div className="premium-blob-a h-72 w-72 rounded-full bg-lime-300/12 blur-3xl" /></div>
        <div className="absolute left-[46%] top-[1%]"><div className="premium-blob-b h-96 w-96 rounded-full bg-cyan-400/12 blur-3xl" /></div>
        <div className="absolute right-[4%] top-[15%]"><div className="premium-blob-a h-80 w-80 rounded-full bg-fuchsia-500/14 blur-3xl" /></div>
        <div className="absolute bottom-[2%] left-[28%]"><div className="premium-blob-b h-80 w-[32rem] rounded-full bg-sky-300/10 blur-3xl" /></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_88%,rgba(56,189,248,0.22),transparent_32%),radial-gradient(circle_at_28%_52%,rgba(132,204,22,0.13),transparent_26%),radial-gradient(circle_at_68%_42%,rgba(168,85,247,0.20),transparent_24%)]" />
        <div style={parallaxGrid} className="premium-grid-drift absolute inset-0 opacity-[0.24] [background-image:radial-gradient(circle_at_center,rgba(255,255,255,0.82)_1.1px,transparent_1.5px)] [background-size:20px_20px] transition-transform duration-200 ease-out" />
        <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-sky-300/18 via-cyan-500/8 to-transparent blur-sm" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.1),transparent_35%,rgba(0,0,0,.55))]" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-start px-3 pb-36 pt-10 sm:px-4 sm:pt-14 lg:items-center lg:px-8 lg:pt-20">
        <section className="grid w-full min-w-0 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_405px] lg:gap-10">
          <div className="relative min-h-0 min-w-0 w-full lg:min-h-[560px]">
            <div className="premium-fade-up mb-6 flex flex-wrap gap-2" style={{ animationDelay: '.05s' }}>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100 backdrop-blur">Air Navigation</span>
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-cyan-100 backdrop-blur">IoT Monitoring</span>
            </div>

            <div style={parallaxHero} className="relative mx-auto flex w-full min-w-0 max-w-5xl flex-col items-center justify-center transition-transform duration-200 ease-out will-change-transform">
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[2rem]"><div className="premium-scan-line absolute left-0 top-[18%] h-[300px] w-[34%] bg-gradient-to-r from-transparent via-cyan-200/24 to-transparent blur-2xl" /></div>
              <div className="relative z-10 flex min-h-[300px] w-full flex-col items-center justify-center overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] px-4 py-8 shadow-[0_0_120px_rgba(34,211,238,0.08)] backdrop-blur-sm sm:min-h-[350px] sm:px-5 sm:py-10 sm:rounded-[2.5rem]">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(34,211,238,.12),transparent_58%)]" />
                <div className="premium-radar-pulse absolute h-64 w-64 rounded-full border border-cyan-200/20 sm:h-80 sm:w-80" />
                <div className="premium-radar-pulse absolute h-64 w-64 rounded-full border border-cyan-200/10 sm:h-80 sm:w-80" style={{ animationDelay: '.9s' }} />
                <div className="premium-orbit absolute h-56 w-56 rounded-full border border-cyan-200/10 sm:h-72 sm:w-72"><span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-cyan-200 shadow-[0_0_22px_rgba(125,211,252,.95)]" /><span className="absolute bottom-8 right-8 h-1.5 w-1.5 rounded-full bg-lime-200 shadow-[0_0_18px_rgba(190,242,100,.9)]" /></div>
                <div className="premium-orbit-reverse absolute h-72 w-72 rounded-full border border-fuchsia-200/10 sm:h-96 sm:w-96"><span className="absolute right-10 top-14 h-2 w-2 rounded-full bg-fuchsia-200 shadow-[0_0_20px_rgba(217,70,239,.9)]" /></div>

                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="premium-plane-float relative grid h-40 w-40 place-items-center rounded-full border border-cyan-200/20 bg-gradient-to-br from-white/[0.10] via-cyan-200/[0.05] to-transparent shadow-[inset_0_0_48px_rgba(255,255,255,0.04),0_0_70px_rgba(34,211,238,0.12)] backdrop-blur-xl sm:h-60 sm:w-60">
                    <div className="absolute inset-3 rounded-full border border-white/10" />
                    <div className="absolute inset-7 rounded-full border border-dashed border-cyan-200/20" />
                    <svg viewBox="0 0 80 80" className="relative z-10 h-28 w-28 text-cyan-100 sm:h-32 sm:w-32" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path className="premium-plane-dash text-cyan-300/60" d="M8 42c12-9 24-13 36-12 10 .8 18 4.4 28 10" />
                      <path d="M6 43h25l15-22c1.6-2.3 5.1-1.5 5.7 1.2l1.7 8.7H68c2.8 0 5 2.2 5 5s-2.2 5-5 5H53.4l-1.7 8.7c-.6 2.7-4.1 3.5-5.7 1.2L31 43H17l-6 10H6l2.5-10H6c-2.8 0-5-2.2-5-5s2.2-5 5-5Z" />
                    </svg>
                  </div>
                  <div className="premium-text-glow mt-8">
                    <p className="mb-3 text-[10px] font-black uppercase tracking-[0.42em] text-cyan-200/85">{t.airnavOperation}</p>
                    <h1 className="break-words bg-gradient-to-r from-white via-cyan-100 to-sky-300 bg-clip-text text-2xl font-black tracking-tight text-transparent sm:text-5xl lg:text-6xl">{t.heroTitle}</h1>
                    <p className="mx-auto mt-4 max-w-2xl text-xs leading-6 text-slate-300 sm:text-sm sm:leading-7 lg:text-base">{t.heroDesc}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="premium-fade-up mt-8 grid max-w-3xl gap-3 sm:grid-cols-3" style={{ animationDelay: '.32s' }}>
              <div className="premium-float-card premium-shimmer relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl"><p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{t.systemsOnline}</p><p className="mt-2 text-3xl font-black text-white">{activeSystems}/3</p><p className="mt-1 text-xs text-cyan-100">{t.update} {formatJakartaTime(new Date())} WITA</p></div>
              <div className="premium-float-card premium-shimmer relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl" style={{ animationDelay: '.7s' }}><p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{t.latestTemp}</p><p className="mt-2 text-3xl font-black text-white">{latestTemp.suhu ?? '-'}°C</p><p className="mt-1 text-xs text-cyan-100">{latestTemp.keterangan || t.statusUnavailable}</p></div>
              <div className="premium-float-card premium-shimmer relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl" style={{ animationDelay: '1.4s' }}><p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">{t.powerSource}</p><p className="mt-2 text-3xl font-black text-white">{latestAts.sumberAktif || '-'}</p><p className="mt-1 text-xs text-cyan-100">{t.relay} {latestAts.statusRelay || '-'}</p></div>
            </div>
          </div>

          <aside className="premium-fade-up relative min-w-0 w-full rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-cyan-950/25 backdrop-blur-2xl transition-transform duration-200 ease-out will-change-transform sm:p-5" style={{ ...parallaxPanel, animationDelay: '.25s' }}>
            <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-b from-cyan-300/20 via-transparent to-blue-400/10 opacity-70" />
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="relative">
              {!showLogin ? (
                <>
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div><p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">{t.operationsPreview}</p><h2 className="mt-2 text-2xl font-black text-white">{t.systemSummary}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{t.quickData}</p></div>
                    <div className="grid h-10 w-10 place-items-center rounded-2xl bg-cyan-300/10 text-xl text-cyan-100">✦</div>
                  </div>
                  <div className="space-y-3">
                    {modules.map((item) => <div key={item.label} className="group relative overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-4 transition hover:-translate-y-1 hover:border-cyan-200/30 hover:bg-white/[0.08]"><div className={classNames('absolute inset-0 bg-gradient-to-br opacity-0 transition group-hover:opacity-100', item.color)} /><div className="relative flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><div className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-cyan-300/10 text-xl text-cyan-100 shadow-inner transition group-hover:scale-110">{item.icon}</div><div className="min-w-0"><p className="truncate text-sm font-black text-white">{item.label}</p><p className="truncate text-xs text-slate-400">{item.detail}</p></div></div><p className="max-w-[112px] truncate text-right text-lg font-black text-white">{item.value}</p></div></div>)}
                  </div>
                  <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/25 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100"><div className="premium-ticker flex w-max gap-8 px-3"><span>ESP32</span><span>DHT11</span><span>RFID RC522</span><span>PZEM004T</span><span>Google Sheet API</span><span>ESP32</span><span>DHT11</span><span>RFID RC522</span><span>PZEM004T</span><span>Google Sheet API</span></div></div>
                  <button onClick={() => { setShowLogin(true); setActiveNav(t.admin); setAuthMode('login'); }} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-white/10 transition hover:bg-cyan-50">⚙️ {t.enterAdminCenter}</button>
                </>
              ) : (
                <div id="login-admin" className="premium-fade-up">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-3 inline-flex rounded-2xl bg-cyan-300/10 p-3 text-cyan-100">{authMode === 'login' ? '⚙️' : authMode === 'register' ? '👤' : '🔑'}</div>
                      <h2 className="text-2xl font-black text-white">{authMode === 'login' ? t.adminGate : authMode === 'register' ? 'Daftar User Baru' : 'Lupa Password'}</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{authMode === 'login' ? t.adminGateDesc : authMode === 'register' ? 'Isi data akun. Setelah daftar, akun harus diterima admin sebelum bisa masuk.' : 'Masukkan username dan password baru untuk memperbarui akun di Spreadsheet.'}</p>
                    </div>
                    <button onClick={() => { setShowLogin(false); setActiveNav(t.monitoring); setAuthMode('login'); }} className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label={t.closeLogin}>×</button>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-1">
                    <button type="button" onClick={() => setAuthMode('login')} className={classNames('rounded-xl px-4 py-2 text-xs font-black transition', (authMode === 'login' || authMode === 'forgot') ? 'bg-white text-cyan-700 shadow-lg' : 'text-white/75 hover:bg-white/10 hover:text-white')}>Masuk</button>
                    <button type="button" onClick={() => setAuthMode('register')} className={classNames('rounded-xl px-4 py-2 text-xs font-black transition', authMode === 'register' ? 'bg-white text-cyan-700 shadow-lg' : 'text-white/75 hover:bg-white/10 hover:text-white')}>Daftar</button>
                  </div>

                  {authMode === 'login' ? (
                    <form onSubmit={(event) => { setShowLogin(true); setActiveNav(t.admin); onLogin(event); }} className="space-y-4">
                      <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">{t.username}</span><input value={loginForm.username} onChange={(event) => updateLogin('username', event.target.value)} placeholder="Masukkan username" className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none ring-cyan-400 transition placeholder:text-slate-500 focus:ring-2" /></label>
                      <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">{t.password}</span><PasswordInput value={loginForm.password} onChange={(event) => updateLogin('password', event.target.value)} placeholder="Masukkan password" /></label>
                      <div className="flex justify-end"><button type="button" onClick={() => setAuthMode('forgot')} className="text-xs font-black text-cyan-100 hover:text-white">Lupa password?</button></div>
                      {loginError && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">{loginError}</div>}
                      <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-400 to-blue-500 px-5 py-3 text-sm font-black text-white shadow-xl shadow-cyan-600/20 transition hover:from-cyan-300 hover:to-blue-400">✅ {t.enterAdminCommand}</button>
                    </form>
                  ) : authMode === 'register' ? (
                    <form onSubmit={onRegister} className="space-y-4">
                      <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">Nama Lengkap</span><input value={registerForm.nama} onChange={(event) => updateRegister('nama', event.target.value)} placeholder="Contoh: Budi Santoso" className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none ring-cyan-400 transition placeholder:text-slate-500 focus:ring-2" /></label>
                      <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">Username</span><input value={registerForm.username} onChange={(event) => updateRegister('username', event.target.value)} placeholder="buat username" className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none ring-cyan-400 transition placeholder:text-slate-500 focus:ring-2" /></label>
                      <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">Password</span><PasswordInput value={registerForm.password} onChange={(event) => updateRegister('password', event.target.value)} placeholder="buat password" /></label>
                      {registerError && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">{registerError}</div>}
                      {registerSuccess && <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">{registerSuccess}</div>}
                      <button type="submit" disabled={registerLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-500 px-5 py-3 text-sm font-black text-white shadow-xl shadow-cyan-600/20 transition hover:from-emerald-300 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">{registerLoading ? 'Menyimpan...' : '👤 Daftar User Baru'}</button>
                    </form>
                  ) : (
                    <form onSubmit={onForgotPassword} className="space-y-4">
                      <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">Username</span><input value={forgotForm.username} onChange={(event) => updateForgot('username', event.target.value)} placeholder="username akun" className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none ring-cyan-400 transition placeholder:text-slate-500 focus:ring-2" /></label>
                      <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">Password Baru</span><PasswordInput value={forgotForm.password} onChange={(event) => updateForgot('password', event.target.value)} placeholder="password baru" /></label>
                      <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">Konfirmasi Password</span><PasswordInput value={forgotForm.confirmPassword} onChange={(event) => updateForgot('confirmPassword', event.target.value)} placeholder="ulangi password baru" /></label>
                      {forgotError && <div className="rounded-2xl border border-rose-300/25 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100">{forgotError}</div>}
                      {forgotSuccess && <div className="rounded-2xl border border-emerald-300/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">{forgotSuccess}</div>}
                      <button type="submit" disabled={forgotLoading} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-cyan-500 px-5 py-3 text-sm font-black text-white shadow-xl shadow-cyan-600/20 transition hover:from-amber-300 hover:to-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">{forgotLoading ? 'Memperbarui...' : '🔑 Reset Password'}</button>
                      <button type="button" onClick={() => setAuthMode('login')} className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/80 hover:bg-white/10 hover:text-white">Kembali ke Masuk</button>
                    </form>
                  )}

                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-300">
                    User baru berstatus <span className="font-black text-amber-100">pending</span> sampai admin memilih Terima.
                  </div>
                </div>
              )}
            </div>
          </aside>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 bg-black/25 px-4 py-6 pb-24 text-center text-[11px] font-semibold text-slate-400 backdrop-blur-xl lg:px-8">{t.footerRights}</footer>

      <div className="fixed bottom-6 left-6 z-40 hidden items-center gap-3 sm:flex"><div className="text-3xl font-black tracking-tight text-white drop-shadow-[0_0_18px_rgba(125,211,252,0.65)]">IoT<span className="text-cyan-200">Ops</span></div><span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-300 backdrop-blur">Airnav</span></div>
      <nav className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100vw-1.25rem)] max-w-max -translate-x-1/2 items-center gap-1 rounded-2xl border border-cyan-200/20 bg-cyan-100/20 p-1.5 shadow-2xl shadow-cyan-500/20 backdrop-blur-2xl sm:bottom-6 sm:w-auto">
        {navLinks.map((item) => <button key={item.label} onClick={item.action} className={classNames('rounded-xl px-3 py-2 text-[11px] font-black transition sm:px-5 sm:text-xs', activeNav === item.label ? 'bg-white text-cyan-700 shadow-lg' : 'text-white/80 hover:bg-white/10 hover:text-white')}>{item.label}</button>)}
      </nav>
      <div className="fixed bottom-7 right-6 z-40 hidden items-center gap-1 rounded-2xl border border-white/10 bg-white/10 p-1 text-xs font-black text-white shadow-xl backdrop-blur-xl sm:flex">
        <button onClick={() => setLanguage('id')} className={classNames('rounded-xl px-3 py-2 transition', language === 'id' ? 'bg-white text-cyan-700 shadow-lg' : 'text-white/80 hover:bg-white/10 hover:text-white')}>ID</button>
        <button onClick={() => setLanguage('en')} className={classNames('rounded-xl px-3 py-2 transition', language === 'en' ? 'bg-white text-cyan-700 shadow-lg' : 'text-white/80 hover:bg-white/10 hover:text-white')}>EN</button>
      </div>
    </div>
  );
}

function DashboardPage({ temperature, rfid, ats, onNavigate }) {
  const latestTemp = getLatestDataRow(temperature);
  const latestAts = ats.at(-1) || {};
  const todayTransactions = rfid.filter((item) => item.status !== 'PERINGATAN').length;
  const warningCount = rfid.filter((item) => item.status === 'PERINGATAN' || item.namaAlat === 'Tidak Terdaftar').length;
  const borrowedCount = rfid.filter((row) => row.status === 'MEMINJAM').length;
  const returnedCount = rfid.filter((row) => row.status === 'MENGEMBALIKAN').length;
  const activeSystems = [temperature.length, rfid.length, ats.length].filter(Boolean).length;
  const isBackupActive = latestAts.sumberAktif === 'Generator' || latestAts.keterangan === 'Backup Genset';
  const isPowerDown = latestAts.keterangan === 'Semua sumber mati'
    || latestAts.sumberAktif === 'TIDAK ADA'
    || latestAts.sumberAktif === 'Mati';
  const avgTemp = temperature.length ? (temperature.reduce((sum, row) => sum + Number(row.suhu || 0), 0) / temperature.length).toFixed(1) : '-';
  const avgHumidity = temperature.length ? Math.round(temperature.reduce((sum, row) => sum + Number(row.kelembaban || 0), 0) / temperature.length) : '-';
  const maxTemp = temperature.length ? Math.max(...temperature.map((row) => Number(row.suhu || 0))).toFixed(1) : '-';
  const riskLabel = isPowerDown ? 'Kritis' : warningCount > 0 || isBackupActive ? 'Perlu Perhatian' : 'Stabil';
  const riskTone = isPowerDown ? 'red' : warningCount > 0 || isBackupActive ? 'yellow' : 'green';

  return (
    <div>
      <PageHeader title="Dashboard Admin" description="Panel kontrol internal dengan ringkasan kesehatan sistem, status operasional, grafik, dan aktivitas terbaru dari tiga sistem IoT ESP32." />
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-100 bg-slate-950 p-6 text-white shadow-2xl shadow-cyan-950/20 lg:p-8">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-center">
          <div>
            <div className="mb-5 flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-100">Admin Command Center</span><span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-slate-100">{activeSystems}/3 Sistem Online</span><Badge tone={riskTone}>{riskLabel}</Badge></div>
            <h2 className="max-w-4xl text-3xl font-black tracking-tight lg:text-5xl">Pusat Kontrol Monitoring IoT </h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-cyan-50 lg:text-base">Pantau kondisi ruang, transaksi alat, dan sumber listrik dari satu layar. Dashboard ini dirancang agar admin cepat melihat status kritis dan halaman detail yang perlu dicek.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><p className="text-3xl font-black">{riskLabel === 'Stabil' ? 96 : riskLabel === 'Kritis' ? 35 : 72}%</p><p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">Skor Kesehatan</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><p className="text-3xl font-black">{todayTransactions}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">Transaksi RFID</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur"><p className="text-3xl font-black">{latestAts.sumberAktif || '-'}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cyan-100">Sumber Aktif</p></div>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button onClick={() => onNavigate('suhu')} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-cyan-50">Cek Suhu</button>
              <button onClick={() => onNavigate('rfid')} className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20">Cek RFID</button>
              <button onClick={() => onNavigate('ats')} className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white/20">Cek ATS</button>
            </div>
          </div>
          <div className="rounded-[1.7rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
            <h3 className="text-xl font-black">Status Operasional</h3>
            <p className="mt-2 text-sm leading-6 text-cyan-50">{riskLabel === 'Stabil' ? 'Semua sistem utama berjalan normal. Tetap pantau grafik dan tabel riwayat secara berkala.' : 'Ada kondisi yang perlu diperiksa admin. Buka halaman detail untuk melihat riwayat dan penyebabnya.'}</p>
            <div className="mt-6 space-y-4">
              {[
                ['Sensor Suhu', `${latestTemp.suhu ?? '-'}°C / ${latestTemp.kelembaban ?? '-'}%`, latestTemp.keterangan || 'Tidak Ada Data', 'suhu'],
                ['RFID Alat', `${todayTransactions} transaksi`, warningCount > 0 ? `${warningCount} UID peringatan` : 'Aman', 'rfid'],
                ['ATS Kelistrikan', latestAts.sumberAktif || '-', latestAts.keterangan || 'Tidak Ada Data', 'ats'],
              ].map(([title, value, status, page]) => <button key={title} onClick={() => onNavigate(page)} className="w-full rounded-2xl border border-white/10 bg-white/10 p-4 text-left transition hover:bg-white/20"><div className="flex items-center justify-between gap-4"><div><p className="font-bold text-white">{title}</p><p className="text-xs text-cyan-100">{value}</p></div><Badge tone={statusTone(status)}>{status}</Badge></div></button>)}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Rata-rata Suhu" value={avgTemp} suffix="°C" icon="🌡️" tone="cyan" />
        <StatCard title="Rata-rata Kelembaban" value={avgHumidity} suffix="%" icon="💧" tone="blue" />
        <StatCard title="Suhu Tertinggi" value={maxTemp} suffix="°C" icon="📈" tone="orange" />
        <StatCard title="UID Peringatan" value={warningCount} icon="⚠️" tone={warningCount > 0 ? 'red' : 'green'} />
      </div>

      {(warningCount > 0 || isBackupActive || isPowerDown) && <div className="mt-6 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 text-sm text-amber-900 shadow-sm"><p className="font-black">Perhatian Admin</p><p className="mt-1 leading-6">{warningCount > 0 ? `${warningCount} UID RFID tidak terdaftar terdeteksi. ` : ''}{isBackupActive ? 'Sistem ATS sedang memakai generator sebagai backup. ' : ''}{isPowerDown ? 'PLN dan generator sedang tidak terdeteksi. ' : ''}Silakan cek halaman detail untuk tindak lanjut.</p></div>}

      <div className="mt-6 grid gap-6 2xl:grid-cols-[1.35fr_0.65fr]">
        <ChartCard title="Tren Lingkungan Lab" description="Suhu dan kelembaban terbaru dari sensor DHT11.">
          <ResponsiveContainer width="100%" height="100%"><LineChart data={temperature} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="jam" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="suhu" name="Suhu °C" stroke="#0891b2" strokeWidth={3} dot={{ r: 4 }} /><Line type="monotone" dataKey="kelembaban" name="Kelembaban %" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer>
        </ChartCard>
        <Card className="min-h-[360px]"><div className="mb-5 flex items-center justify-between gap-4"><div><h3 className="text-lg font-black text-slate-950">Aktivitas RFID Terbaru</h3><p className="text-sm text-slate-500">Riwayat scan terakhir dari sistem alat.</p></div><Badge tone={warningCount > 0 ? 'red' : 'green'}>{warningCount > 0 ? 'Ada Peringatan' : 'Aman'}</Badge></div><div className="space-y-3">{[...rfid].reverse().slice(0, 5).map((item, index) => <div key={`${item.uid}-${item.jam}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3"><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{item.namaAlat}</p><p className="truncate text-xs text-slate-500">{item.uid} • {item.jam} WITA</p></div><Badge tone={statusTone(item.status)}>{item.status}</Badge></div>)}</div></Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2"><div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-black text-slate-950">Status ATS PLN / Generator</h3><p className="text-sm text-slate-500">Pantauan tegangan, arus, dan watt utama serta backup generator.</p></div><Badge tone={statusTone(latestAts.keterangan)}>{latestAts.keterangan || 'Tidak Ada Data'}</Badge></div><div className="grid gap-4 xl:grid-cols-3"><div className="h-64 min-w-0"><p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Tegangan</p><ResponsiveContainer width="100%" height="100%"><LineChart data={ats} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="jam" /><YAxis domain={[0, 250]} /><Tooltip /><Legend /><Line type="monotone" dataKey="teganganPln" name="PLN V" stroke="#06b6d4" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="teganganGenerator" name="GEN V" stroke="#f59e0b" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div><div className="h-64 min-w-0"><p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Arus</p><ResponsiveContainer width="100%" height="100%"><LineChart data={ats} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="jam" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="arusPln" name="PLN A" stroke="#2563eb" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="arusGenerator" name="GEN A" stroke="#fb7185" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div><div className="h-64 min-w-0"><p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Watt</p><ResponsiveContainer width="100%" height="100%"><LineChart data={ats} margin={{ top: 10, right: 14, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="jam" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="wattPln" name="PLN W" stroke="#10b981" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="wattGenerator" name="GEN W" stroke="#a855f7" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div></div></Card>
        <Card><h3 className="text-lg font-black text-slate-950">Ringkasan Alat</h3><p className="mt-1 text-sm text-slate-500">Perbandingan transaksi RFID hari ini.</p><div className="mt-6 space-y-5">{[['Dipinjam', borrowedCount, 'bg-orange-500'], ['Dikembalikan', returnedCount, 'bg-emerald-500'], ['Peringatan UID', warningCount, 'bg-rose-500']].map(([label, count, color]) => <div key={label}><div className="mb-2 flex items-center justify-between text-sm font-bold text-slate-700"><span>{label}</span><span>{count}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className={classNames('h-full rounded-full', color)} style={{ width: `${Math.min(100, Number(count) * 18)}%` }} /></div></div>)}</div><button onClick={() => onNavigate('rfid')} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-700">Lihat Detail RFID</button></Card>
      </div>
    </div>
  );
}

function TemperaturePage({ data }) {
  const latest = getLatestDataRow(data);
  const tableRows = [...data].sort((a, b) => timeScore(b) - timeScore(a));
  const avgTemp = data.length ? (data.reduce((sum, row) => sum + Number(row.suhu || 0), 0) / data.length).toFixed(1) : '-';
  const exportColumns = [
    { key: 'tanggal', label: 'Tanggal' },
    { key: 'jam', label: 'Jam' },
    { key: 'suhu', label: 'Suhu (C)' },
    { key: 'kelembaban', label: 'Kelembaban (%)' },
    { key: 'keterangan', label: 'Keterangan' },
  ];
  const exportRows = tableRows.map((row) => ({
    tanggal: formatJakartaDate(row.timestamp),
    jam: row.jam,
    suhu: row.suhu,
    kelembaban: row.kelembaban,
    keterangan: row.keterangan,
  }));
  const columns = [
    { key: 'timestamp', label: 'Tanggal', render: (row) => <span>{formatJakartaDate(row.timestamp)}</span> },
    { key: 'jam', label: 'Jam' },
    { key: 'suhu', label: 'Suhu', render: (row) => <span className="font-bold text-slate-950">{row.suhu} °C</span> },
    { key: 'kelembaban', label: 'Kelembaban', render: (row) => <span>{row.kelembaban}%</span> },
    { key: 'keterangan', label: 'Keterangan', render: (row) => <Badge tone={statusTone(row.keterangan)}>{row.keterangan}</Badge> },
  ];
  return <div><PageHeader title="Monitoring Suhu" description="Pantau suhu dan kelembaban ruang secara real-time dari sensor DHT11."><DownloadButton disabled={data.length === 0} onClick={() => downloadCsv(`data-suhu-${new Date().toISOString().slice(0, 10)}.csv`, exportColumns, exportRows)} /></PageHeader><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Suhu Terkini" value={latest.suhu ?? '-'} suffix="°C" status={latest.keterangan} icon="🌡️" /><StatCard title="Kelembaban" value={latest.kelembaban ?? '-'} suffix="%" icon="💧" tone="blue" /><StatCard title="Rata-rata Suhu" value={avgTemp} suffix="°C" icon="📊" tone="purple" /><StatCard title="Status" value={latest.keterangan || '-'} icon="✅" tone="green" /></div><div className="mt-6"><ChartCard title="Grafik Suhu dan Kelembaban" description="Riwayat pembacaan sensor per jam."><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="jam" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="suhu" name="Suhu °C" stroke="#0891b2" strokeWidth={3} /><Line type="monotone" dataKey="kelembaban" name="Kelembaban %" stroke="#2563eb" strokeWidth={3} /></LineChart></ResponsiveContainer></ChartCard></div><div className="mt-6"><DataTable columns={columns} rows={tableRows} emptyMessage="Belum ada data suhu." /></div></div>;
}

function RfidPage({ data }) {
  const borrowed = data.filter((row) => row.status === 'MEMINJAM').length;
  const returned = data.filter((row) => row.status === 'MENGEMBALIKAN').length;
  const warnings = data.filter((row) => row.status === 'PERINGATAN' || row.namaAlat === 'Tidak Terdaftar').length;
  const exportColumns = [
    { key: 'tanggal', label: 'Tanggal' },
    { key: 'jam', label: 'Jam' },
    { key: 'uid', label: 'UID Kartu' },
    { key: 'namaAlat', label: 'Nama Alat' },
    { key: 'status', label: 'Status' },
    { key: 'keterangan', label: 'Keterangan' },
  ];
  const exportRows = [...data].reverse().map((row) => ({
    tanggal: formatJakartaDate(row.timestamp),
    jam: row.jam,
    uid: row.uid,
    namaAlat: row.namaAlat,
    status: row.status,
    keterangan: row.keterangan,
  }));
  const columns = [
    { key: 'jam', label: 'Jam' },
    { key: 'uid', label: 'UID Kartu', render: (row) => <span className="font-mono text-xs font-bold text-slate-700">{row.uid}</span> },
    { key: 'namaAlat', label: 'Nama Alat', render: (row) => <span className="font-bold text-slate-950">{row.namaAlat}</span> },
    { key: 'status', label: 'Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    { key: 'keterangan', label: 'Keterangan' },
  ];
  return <div><PageHeader title="RFID Alat" description="Monitoring peminjaman dan pengembalian alat berbasis kartu RFID."><DownloadButton disabled={data.length === 0} onClick={() => downloadCsv(`data-rfid-${new Date().toISOString().slice(0, 10)}.csv`, exportColumns, exportRows)} /></PageHeader><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Total Scan" value={data.length} icon="🏷️" /><StatCard title="Dipinjam" value={borrowed} icon="📤" tone="orange" /><StatCard title="Dikembalikan" value={returned} icon="✅" tone="green" /><StatCard title="Peringatan UID" value={warnings} icon="⚠️" tone={warnings ? 'red' : 'green'} /></div><div className="mt-6 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-blue-50 p-5"><h3 className="font-black text-slate-950">Alur Sistem RFID</h3><p className="mt-2 text-sm leading-6 text-slate-600">Scan kartu untuk validasi UID. Sistem mencatat status MEMINJAM, MENGEMBALIKAN, atau PERINGATAN jika UID tidak terdaftar.</p></div><div className="mt-6"><DataTable columns={columns} rows={[...data].reverse()} emptyMessage="Belum ada data RFID." /></div></div>;
}

function formatAtsReading(value, unit) {
  const n = Number(value);
  if (!Number.isFinite(n)) return `— ${unit}`;
  if (unit === 'A') return `${n.toLocaleString('id-ID', { maximumFractionDigits: 2 })} A`;
  if (unit === 'W') return `${Math.round(n).toLocaleString('id-ID')} W`;
  return `${Math.round(n).toLocaleString('id-ID')} V`;
}

function AtsPage({ data }) {
  const latest = data.at(-1) || {};
  const backupCount = data.filter((row) => row.sumberAktif === 'Generator').length;
  const downCount = data.filter((row) => (
    row.sumberAktif === 'Mati'
    || row.sumberAktif === 'TIDAK ADA'
    || row.keterangan === 'Semua sumber mati'
  )).length;
  const sumberTone = latest.sumberAktif === 'Generator'
    ? 'orange'
    : (latest.sumberAktif === 'Mati' || latest.sumberAktif === 'TIDAK ADA' ? 'red' : 'green');
  const exportColumns = [
    { key: 'tanggal', label: 'Tanggal' },
    { key: 'jam', label: 'Jam' },
    { key: 'teganganPln', label: 'Tegangan PLN (V)' },
    { key: 'arusPln', label: 'Arus PLN (A)' },
    { key: 'wattPln', label: 'Watt PLN (W)' },
    { key: 'teganganGenerator', label: 'Tegangan Generator (V)' },
    { key: 'arusGenerator', label: 'Arus Generator (A)' },
    { key: 'wattGenerator', label: 'Watt Generator (W)' },
    { key: 'statusPln', label: 'Status PLN' },
    { key: 'statusGenerator', label: 'Status Generator' },
    { key: 'sumberAktif', label: 'Sumber Aktif' },
    { key: 'statusRelay', label: 'Relay' },
    { key: 'keterangan', label: 'Keterangan' },
  ];
  const exportRows = [...data].reverse().map((row) => ({
    tanggal: formatJakartaDate(row.timestamp),
    jam: row.jam,
    teganganPln: row.teganganPln,
    arusPln: row.arusPln,
    wattPln: row.wattPln,
    teganganGenerator: row.teganganGenerator,
    arusGenerator: row.arusGenerator,
    wattGenerator: row.wattGenerator,
    statusPln: row.statusPln,
    statusGenerator: row.statusGenerator,
    sumberAktif: row.sumberAktif,
    statusRelay: row.statusRelay,
    keterangan: row.keterangan,
  }));
  const columns = [
    { key: 'jam', label: 'Jam' },
    { key: 'teganganPln', label: 'Tegangan PLN', render: (row) => <span>{formatAtsReading(row.teganganPln, 'V')}</span> },
    { key: 'arusPln', label: 'Arus PLN', render: (row) => <span>{formatAtsReading(row.arusPln, 'A')}</span> },
    { key: 'wattPln', label: 'Watt PLN', render: (row) => <span>{formatAtsReading(row.wattPln, 'W')}</span> },
    { key: 'teganganGenerator', label: 'Tegangan Generator', render: (row) => <span>{formatAtsReading(row.teganganGenerator, 'V')}</span> },
    { key: 'arusGenerator', label: 'Arus Generator', render: (row) => <span>{formatAtsReading(row.arusGenerator, 'A')}</span> },
    { key: 'wattGenerator', label: 'Watt Generator', render: (row) => <span>{formatAtsReading(row.wattGenerator, 'W')}</span> },
    { key: 'statusPln', label: 'PLN', render: (row) => <Badge tone={statusTone(row.statusPln)}>{row.statusPln}</Badge> },
    { key: 'statusGenerator', label: 'Generator', render: (row) => <Badge tone={statusTone(row.statusGenerator)}>{row.statusGenerator}</Badge> },
    { key: 'sumberAktif', label: 'Sumber Aktif', render: (row) => <Badge tone={statusTone(row.sumberAktif)}>{row.sumberAktif}</Badge> },
    { key: 'statusRelay', label: 'Relay', render: (row) => <span className="font-bold">{row.statusRelay}</span> },
    { key: 'keterangan', label: 'Keterangan', render: (row) => <Badge tone={statusTone(row.keterangan)}>{row.keterangan}</Badge> },
  ];
  return (
    <div>
      <PageHeader title="ATS PLN / Generator" description="Parameter mengikuti kolom log Sheet: tegangan/arus/watt per sumber, status PLN & Generator (YA/TIDAK), sumber aktif, relay, dan keterangan.">
        <DownloadButton disabled={data.length === 0} onClick={() => downloadCsv(`data-ats-${new Date().toISOString().slice(0, 10)}.csv`, exportColumns, exportRows)} />
      </PageHeader>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Sumber Aktif" value={latest.sumberAktif ?? '-'} icon="⚡" status={latest.keterangan} tone={sumberTone} />
        <StatCard title="Tegangan PLN" value={Number.isFinite(Number(latest.teganganPln)) ? Math.round(latest.teganganPln).toLocaleString('id-ID') : '—'} suffix="V" icon="🔌" />
        <StatCard title="Tegangan Generator" value={Number.isFinite(Number(latest.teganganGenerator)) ? Math.round(latest.teganganGenerator).toLocaleString('id-ID') : '—'} suffix="V" icon="⚙️" tone="orange" />
        <StatCard title="Backup / Down" value={`${backupCount}/${downCount}`} icon="🚨" tone={downCount ? 'red' : 'purple'} helper="Generator aktif / semua sumber mati" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Arus PLN" value={Number.isFinite(Number(latest.arusPln)) ? latest.arusPln.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '—'} suffix="A" icon="📎" tone="blue" />
        <StatCard title="Watt PLN" value={Number.isFinite(Number(latest.wattPln)) ? Math.round(latest.wattPln).toLocaleString('id-ID') : '—'} suffix="W" icon="💡" tone="cyan" />
        <StatCard title="Arus Generator" value={Number.isFinite(Number(latest.arusGenerator)) ? latest.arusGenerator.toLocaleString('id-ID', { maximumFractionDigits: 2 }) : '—'} suffix="A" icon="🔧" tone="orange" />
        <StatCard title="Watt Generator" value={Number.isFinite(Number(latest.wattGenerator)) ? Math.round(latest.wattGenerator).toLocaleString('id-ID') : '—'} suffix="W" icon="⚡" tone="purple" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <ChartCard title="Grafik Tegangan" description="Tegangan PLN dan generator per jam.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="jam" />
              <YAxis domain={[0, 250]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="teganganPln" name="PLN V" stroke="#06b6d4" strokeWidth={3} />
              <Line type="monotone" dataKey="teganganGenerator" name="Generator V" stroke="#f59e0b" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Grafik Arus" description="Arus PLN dan generator per jam.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="jam" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="arusPln" name="PLN A" stroke="#2563eb" strokeWidth={3} />
              <Line type="monotone" dataKey="arusGenerator" name="Generator A" stroke="#fb7185" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Grafik Watt" description="Daya PLN dan generator per jam.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="jam" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="wattPln" name="PLN W" stroke="#10b981" strokeWidth={3} />
              <Line type="monotone" dataKey="wattGenerator" name="Generator W" stroke="#a855f7" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="mt-6">
        <DataTable columns={columns} rows={[...data].reverse()} emptyMessage="Belum ada data ATS." tableClassName="min-w-[1320px]" />
      </div>
    </div>
  );
}

function UserManagementPage({ users, userLoading, onRefreshUsers, onApproveUser, onRejectUser, onDeleteUser, onApprovePasswordRequest, onRejectPasswordRequest }) {
  const safeUsers = getSafeUsers(users);

  const pending = safeUsers.filter((user) => user.status === 'pending').length;
  const approved = safeUsers.filter((user) => user.status === 'approved').length;
  const rejected = safeUsers.filter((user) => user.status === 'rejected').length;
  const totalUser = safeUsers.filter((user) => user.role !== 'admin').length;
  const passwordRequests = safeUsers.filter((user) => user.passwordRequestStatus === 'pending').length;

  return (
    <div>
      <PageHeader
        title="Manajemen User"
        description="Admin dapat menerima, menolak, menghapus, dan mengganti password user. Data user disimpan di Spreadsheet."
      />

      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={onRefreshUsers}
          disabled={userLoading}
          className="rounded-2xl border border-cyan-300/20 bg-white/5 px-4 py-2 text-xs font-black text-cyan-100 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {userLoading ? 'Memuat User...' : 'Refresh User'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total User" value={totalUser} icon="👥" tone="cyan" />
        <StatCard title="Pending" value={pending} icon="⏳" tone="orange" />
        <StatCard title="Diterima" value={approved} icon="✅" tone="green" />
        <StatCard title="Ditolak" value={rejected} icon="⛔" tone="red" />
        <StatCard title="Request Password" value={passwordRequests} icon="🔑" tone={passwordRequests ? 'orange' : 'green'} />
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-4 font-black">Nama</th>
                <th className="px-5 py-4 font-black">Username</th>
                <th className="px-5 py-4 font-black">Role</th>
                <th className="px-5 py-4 font-black">Status</th>
                <th className="px-5 py-4 font-black">Tanggal Daftar</th>
                <th className="px-5 py-4 font-black">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {safeUsers.map((user) => {
                const isMainAdmin = user.username === ADMIN_USERNAME || user.role === 'admin';

                return (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-black text-slate-950">
                      {user.nama}
                    </td>

                    <td className="px-5 py-4 font-mono text-xs text-slate-700">
                      {user.username}
                    </td>

                    <td className="px-5 py-4">
                      <Badge tone={user.role === 'admin' ? 'purple' : 'cyan'}>
                        {user.role}
                      </Badge>
                    </td>

                    <td className="px-5 py-4">
                      <Badge tone={statusTone(user.status)}>
                        {user.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-4 text-slate-500">
                      {formatJakartaDate(user.createdAt)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        {user.status === 'pending' && !isMainAdmin && (
                          <>
                            <button
                              onClick={() => onApproveUser(user.id)}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
                            >
                              Terima
                            </button>

                            <button
                              onClick={() => onRejectUser(user.id)}
                              className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white hover:bg-rose-700"
                            >
                              Tolak
                            </button>
                          </>
                        )}

                        {!isMainAdmin && (
                          <>
                            {user.passwordRequestStatus === 'pending' && (
                              <>
                                <button
                                  onClick={() => onApprovePasswordRequest(user.id)}
                                  className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-black text-white hover:bg-cyan-700"
                                >
                                  Setujui Password
                                </button>
                                <button
                                  onClick={() => onRejectPasswordRequest(user.id)}
                                  className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-black text-white hover:bg-amber-700"
                                >
                                  Tolak Password
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => onDeleteUser(user.id)}
                              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white hover:bg-red-700"
                            >
                              Hapus
                            </button>
                          </>
                        )}

                        {isMainAdmin && (
                          <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-400">
                            Admin Utama
                          </span>
                        )}

                        {user.status !== 'pending' && !isMainAdmin && (
                          <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-400">
                            Selesai
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ApiSettingsPage({ apiConfig, mode, setMode, connectionStatus, onSave, onRefresh, loading, apiWarning, deviceWifiForm, setDeviceWifiForm, deviceWifiError, deviceWifiSuccess, deviceWifiSavedConfig, deviceWifiLoading, onSaveDeviceWifi }) {
  const [form, setForm] = useState(apiConfig);
  useEffect(() => setForm(apiConfig), [apiConfig]);
  const update = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));
  const updateDeviceWifi = (field, value) => setDeviceWifiForm((previous) => ({ ...previous, [field]: value }));
  const submit = (event) => { event.preventDefault(); onSave(form); };
  const appScript = `function doGet(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(e.parameter.sheet || "suhu");
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  const data = rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
  return ContentService.createTextOutput(JSON.stringify({ data })).setMimeType(ContentService.MimeType.JSON);
}`;
  return (
    <div>
      <PageHeader title="Pengaturan API" description="Sambungkan dashboard ke Google Apps Script Web App yang mengembalikan JSON dari Google Sheet." />
      {apiWarning && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-black">API belum diisi</p><p className="mt-1">Isi minimal satu URL API. Suhu, RFID, dan ATS berjalan sendiri-sendiri, jadi endpoint yang kosong tidak akan menghentikan endpoint lain.</p></div>}
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <h2 className="text-lg font-black text-slate-950">Mode Data</h2>
          <p className="mt-1 text-sm text-slate-500">Pilih dummy untuk demo atau API untuk data dari Google Sheet.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            <button onClick={() => setMode('dummy')} className={classNames('rounded-xl px-4 py-3 text-sm font-black transition', mode === 'dummy' ? 'bg-white text-cyan-700 shadow' : 'text-slate-500')}>Dummy</button>
            <button onClick={() => setMode('api')} className={classNames('rounded-xl px-4 py-3 text-sm font-black transition', mode === 'api' ? 'bg-white text-cyan-700 shadow' : 'text-slate-500')}>API</button>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-slate-500">Status Koneksi</p><div className="mt-2"><Badge tone={statusTone(connectionStatus)}>{connectionStatus}</Badge></div></div>
          <button onClick={onRefresh} disabled={loading} className="mt-5 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Memuat...' : 'Refresh Data'}</button>
        </Card>
        <Card>
          <h2 className="text-lg font-black text-slate-950">URL Endpoint</h2>
          <p className="mt-1 text-sm text-slate-500">Endpoint terpisah untuk suhu, RFID, ATS, dan manajemen user.</p>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">API Suhu</span><input value={form.temperatureUrl || ''} onChange={(event) => update('temperatureUrl', event.target.value)} placeholder="https://script.google.com/macros/s/.../exec?sheet=suhu" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-cyan-400 focus:ring-2" /></label>
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">API RFID</span><input value={form.rfidUrl || ''} onChange={(event) => update('rfidUrl', event.target.value)} placeholder="https://script.google.com/macros/s/.../exec?sheet=rfid" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-cyan-400 focus:ring-2" /></label>
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">API ATS</span><input value={form.atsUrl || ''} onChange={(event) => update('atsUrl', event.target.value)} placeholder="https://script.google.com/macros/s/.../exec?sheet=ats" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-cyan-400 focus:ring-2" /></label>
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">API Manajemen User</span><input value={form.userUrl || ''} onChange={(event) => update('userUrl', event.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-cyan-400 focus:ring-2" /></label>
            <label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">API WiFi ESP32</span><input value={form.deviceWifiUrl || ''} onChange={(event) => update('deviceWifiUrl', event.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none ring-cyan-400 focus:ring-2" /></label>
            <button type="submit" className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-600/20">Simpan Konfigurasi</button>
          </form>
        </Card>
      </div>
      <Card className="mt-6 bg-slate-950 text-white"><h2 className="text-lg font-black">Contoh Apps Script</h2><p className="mt-1 text-sm text-slate-300">Deploy sebagai Web App, akses Anyone, lalu tempel URL ke form di atas.</p><pre className="mt-4 overflow-x-auto rounded-2xl bg-black/40 p-4 text-xs leading-6 text-cyan-50"><code>{appScript}</code></pre></Card>
      <Card className="mt-6 bg-slate-950 text-white">
        <h2 className="text-lg font-black">Ubah Username & Password WiFi ESP32</h2>
        <p className="mt-1 text-sm text-slate-300">Atur username/SSID jaringan dan password WiFi per mikrokontroler. Setiap ESP32 membaca konfigurasi sesuai nama perangkatnya dari API.</p>
        <form onSubmit={(event) => onSaveDeviceWifi(event, form.deviceWifiUrl)} className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="block lg:col-span-2">
            <span className="mb-2 block text-sm font-semibold text-slate-200">Pilih Perangkat</span>
            <select value={deviceWifiForm.device} onChange={(event) => updateDeviceWifi('device', event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none ring-cyan-400 transition focus:ring-2">
              {DEVICE_WIFI_OPTIONS.map((device) => <option key={device} value={device} className="bg-slate-950 text-white">{device}</option>)}
            </select>
          </label>
          <label className="block lg:col-span-2"><span className="mb-2 block text-sm font-semibold text-slate-200">Username / SSID Jaringan</span><input value={deviceWifiForm.ssid} onChange={(event) => updateDeviceWifi('ssid', event.target.value)} placeholder="Contoh: pppppp" className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none ring-cyan-400 transition placeholder:text-slate-500 focus:ring-2" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">Password WiFi</span><PasswordInput value={deviceWifiForm.password} onChange={(event) => updateDeviceWifi('password', event.target.value)} placeholder="Password WiFi" /></label>
          <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-200">Konfirmasi Password WiFi</span><PasswordInput value={deviceWifiForm.confirmPassword} onChange={(event) => updateDeviceWifi('confirmPassword', event.target.value)} placeholder="Ulangi password WiFi" /></label>
          {(deviceWifiError || deviceWifiSuccess) && <div className={classNames('rounded-2xl border px-4 py-3 text-sm font-semibold lg:col-span-2', deviceWifiError ? 'border-rose-300/25 bg-rose-500/10 text-rose-100' : 'border-emerald-300/25 bg-emerald-500/10 text-emerald-100')}>{deviceWifiError || deviceWifiSuccess}</div>}
          {Object.keys(deviceWifiSavedConfig || {}).length > 0 && (
            <div className="grid gap-3 lg:col-span-2">
              {DEVICE_WIFI_OPTIONS.map((device) => {
                const savedConfig = deviceWifiSavedConfig?.[device];
                if (!savedConfig) return null;
                return (
                  <div key={device} className="grid gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-50 sm:grid-cols-[0.7fr_1fr_1fr]">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-cyan-100/70">Perangkat</p>
                      <p className="mt-1 break-all text-base font-black text-white">{device}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-cyan-100/70">Username / SSID</p>
                      <p className="mt-1 break-all text-base font-black text-white">{savedConfig.ssid}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-cyan-100/70">Password WiFi</p>
                      <p className="mt-1 break-all text-base font-black text-white">{savedConfig.password}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <button type="submit" disabled={deviceWifiLoading} className="rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 lg:col-span-2">{deviceWifiLoading ? 'Menyimpan...' : `Simpan WiFi ${deviceWifiForm.device}`}</button>
        </form>
      </Card>
    </div>
  );
}

function Sidebar({ activePage, setActivePage, sidebarOpen, setSidebarOpen, currentUser, userNotificationCount, onLogout, onFeatureClick }) {
  const allowedItems = navItems.filter((item) => !item.adminOnly || currentUser?.role === 'admin');
  return <><button onClick={() => setSidebarOpen(false)} className={classNames('fixed inset-0 z-30 bg-black/55 lg:hidden', sidebarOpen ? 'block' : 'hidden')} aria-label="Tutup sidebar" /><aside className={classNames('fixed inset-y-0 left-0 z-40 flex h-screen w-72 flex-col overflow-y-auto border-r border-cyan-300/10 bg-slate-950/95 p-5 shadow-2xl shadow-cyan-950/20 backdrop-blur-xl transition-transform lg:translate-x-0', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}><style>{`@keyframes notifBadgePop { 0%, 100% { transform: scale(1); } 45% { transform: scale(1.16); } } .notif-badge { animation: notifBadgePop 1.35s ease-in-out infinite; }`}</style><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 text-xl text-white shadow-lg">✈️</div><div><p className="text-lg font-black text-white">IoTOps</p><p className="text-xs font-bold uppercase tracking-wider text-cyan-200/70">Airnav Monitoring</p></div></div><div className="mt-6 rounded-3xl border border-cyan-300/15 bg-black/35 p-4 text-white"><p className="text-xs font-bold uppercase tracking-wider text-cyan-100">Login sebagai</p><p className="mt-2 text-lg font-black">{currentUser?.nama || 'User'}</p><Badge tone={currentUser?.role === 'admin' ? 'purple' : 'cyan'}>{currentUser?.role || 'user'}</Badge></div><nav className="mt-6 space-y-2">{allowedItems.map((item) => { const count = item.id === 'users' ? userNotificationCount : 0; return <button key={item.id} onClick={() => onFeatureClick(() => { setActivePage(item.id); setSidebarOpen(false); })} className={classNames('relative flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition', activePage === item.id ? 'bg-cyan-300/15 text-cyan-100 shadow-[0_0_0_1px_rgba(103,232,249,.16)]' : 'text-slate-300 hover:bg-white/5 hover:text-white')}><span className="text-lg">{item.icon}</span><span className="min-w-0 flex-1 truncate">{item.label}</span>{count > 0 && <span className="notif-badge relative grid min-h-6 min-w-6 place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] font-black leading-none text-white shadow-lg shadow-rose-950/40"><span className="absolute inset-0 rounded-full bg-rose-400/70 animate-ping" /> <span className="relative">{count > 99 ? '99+' : count}</span></span>}</button>; })}</nav><div className="mt-auto pt-6"><button onClick={() => onFeatureClick(() => { setSidebarOpen(false); onLogout(); })} className="flex w-full items-center gap-3 rounded-2xl border border-rose-300/25 bg-rose-500/12 px-4 py-3 text-left text-sm font-black text-rose-100 transition hover:bg-rose-500/20"><span className="text-lg">⏻</span><span>Logout</span></button></div></aside></>;
}

function Topbar({ setSidebarOpen, mode, setMode, connectionStatus, onFeatureClick, currentUser }) {
  const canToggleMode = currentUser?.role === 'admin';
  return <header className="sticky top-0 z-20 border-b border-cyan-300/10 bg-slate-950/85 px-4 py-4 backdrop-blur-xl lg:px-8"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><button onClick={() => setSidebarOpen(true)} className="rounded-2xl border border-cyan-300/20 bg-white/5 p-3 text-cyan-100 lg:hidden">☰</button><div><p className="text-xs font-black uppercase tracking-wider text-cyan-200/70">{formatJakartaDate(new Date())}</p><h2 className="text-lg font-black text-white">{formatJakartaTime(new Date())} WITA</h2></div></div><div className="flex flex-wrap items-center gap-2"><Badge tone={statusTone(connectionStatus)}>{connectionStatus}</Badge>{canToggleMode && <button onClick={() => onFeatureClick(() => setMode(mode === 'api' ? 'dummy' : 'api'))} className="rounded-2xl border border-cyan-300/20 bg-white/5 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-white/10">Toggle Mode</button>}</div></div></header>;
}

function useInspectGuard() {
  useEffect(() => {
    const blockInspect = (event) => {
      event.preventDefault();
      event.stopPropagation();
      return false;
    };

    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      const devToolsShortcut = (
        event.key === 'F12'
        || (modifier && event.shiftKey && ['i', 'j', 'c'].includes(key))
        || (event.metaKey && event.altKey && ['i', 'j', 'c', 'u'].includes(key))
        || (modifier && ['u', 's'].includes(key))
      );

      if (devToolsShortcut) blockInspect(event);
    };

    // Penghalang sisi UI saja. Data sensitif tetap harus diamankan dari backend/API.
    document.addEventListener('contextmenu', blockInspect);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', blockInspect);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}

export default function IoTDashboardApp() {
  useInspectGuard();
  const initialConfig = loadJson(STORAGE_KEY, DEFAULT_API_CONFIG);
  const safeInitialMode = initialConfig.mode === 'api' && !hasAnyDataApiUrl(initialConfig) ? 'dummy' : initialConfig.mode || 'dummy';
  const initialSessionUser = loadSessionUser();
  const initialSessionToken = loadSessionToken();
  const [mode, setMode] = useState(safeInitialMode);
  const [apiConfig, setApiConfig] = useState(initialConfig);
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [currentUser, setCurrentUser] = useState(initialSessionUser);
  const [sessionToken, setSessionToken] = useState(initialSessionToken);
  const [isAdmin, setIsAdmin] = useState(Boolean(initialSessionUser));
  const [activePage, setActivePage] = useState(() => loadSessionActivePage());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [temperature, setTemperature] = useState(mockTemperature);
  const [rfid, setRfid] = useState(mockRfid);
  const [ats, setAts] = useState(mockAts);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(safeInitialMode === 'api' ? 'ready' : 'dummy');
  const [apiWarning, setApiWarning] = useState(initialConfig.mode === 'api' && !hasAnyDataApiUrl(initialConfig));
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [registerForm, setRegisterForm] = useState({ nama: '', username: '', password: '' });
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [registerLoading, setRegisterLoading] = useState(false);
  const [forgotForm, setForgotForm] = useState({ username: '', password: '', confirmPassword: '' });
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [deviceWifiForm, setDeviceWifiForm] = useState({ device: DEVICE_WIFI_OPTIONS[0], ssid: '', password: '', confirmPassword: '' });
  const [deviceWifiError, setDeviceWifiError] = useState('');
  const [deviceWifiSuccess, setDeviceWifiSuccess] = useState('');
  const [deviceWifiSavedConfig, setDeviceWifiSavedConfig] = useState(() => {
    const saved = loadJson(DEVICE_WIFI_SAVED_KEY, {});

    if (saved?.ssid || saved?.password) {
      const device = saved.device || DEVICE_WIFI_OPTIONS[0];
      return {
        [device]: {
          device,
          ssid: saved.ssid || '',
          password: saved.password || '',
        },
      };
    }

    return saved && typeof saved === 'object' ? saved : {};
  });
  const [deviceWifiLoading, setDeviceWifiLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [usersSynced, setUsersSynced] = useState(false);
  const [featureLoading, setFeatureLoading] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => saveJson(STORAGE_KEY, { ...apiConfig, mode }), [apiConfig, mode]);
  useEffect(() => {
    const syncSavedConfig = () => {
      const savedConfig = loadJson(STORAGE_KEY, DEFAULT_API_CONFIG);
      const savedMode = savedConfig.mode === 'api' && !hasAnyDataApiUrl(savedConfig)
        ? 'dummy'
        : savedConfig.mode || 'dummy';

      setApiConfig((previousConfig) => (
        JSON.stringify(previousConfig) === JSON.stringify(savedConfig) ? previousConfig : savedConfig
      ));
      setMode((previousMode) => (previousMode === savedMode ? previousMode : savedMode));
    };

    const handleStorage = (event) => {
      if (event.key === STORAGE_KEY) syncSavedConfig();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') syncSavedConfig();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', syncSavedConfig);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', syncSavedConfig);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
  useEffect(() => {
    let isMounted = true;

    const syncBackendConfig = async () => {
      try {
        const backendConfig = await loadDashboardConfigFromBackend(apiConfig.userUrl, apiConfig);
        if (!isMounted) return;
        setApiConfig((previousConfig) => (
          JSON.stringify(previousConfig) === JSON.stringify(backendConfig) ? previousConfig : backendConfig
        ));
        setMode((previousMode) => (previousMode === backendConfig.mode ? previousMode : backendConfig.mode));
        saveJson(STORAGE_KEY, backendConfig);
      } catch (error) {
        // Apps Script lama mungkin belum punya getdashboardconfig. Kalau begitu
        // dashboard tetap memakai konfigurasi lokal yang ada.
        console.warn('Konfigurasi global dashboard belum tersedia.', error);
      }
    };

    syncBackendConfig();
    const intervalId = window.setInterval(syncBackendConfig, 5000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfig.userUrl]);
  useEffect(() => saveSessionActivePage(activePage), [activePage]);
  useEffect(() => {
    const handleScroll = () => {
      const doc = document.documentElement;
      const distanceFromBottom = doc.scrollHeight - (window.scrollY + window.innerHeight);
      setShowScrollTop(distanceFromBottom <= 120 && window.scrollY > 200);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const metrics = useMemo(() => ({ temp: temperature.length, rfid: rfid.length, ats: ats.length }), [temperature.length, rfid.length, ats.length]);
  const userNotificationCount = useMemo(() => {
    const safeUsers = getSafeUsers(users);
    return safeUsers.filter((user) => user.role !== 'admin' && (user.status === 'pending' || user.passwordRequestStatus === 'pending')).length;
  }, [users]);

  const refreshUsers = async ({ silent = false } = {}) => {
    if (!silent) setUserLoading(true);
    try {
      const spreadsheetUsers = await loadUsersFromSpreadsheet(apiConfig.userUrl, sessionToken);
      setUsers(spreadsheetUsers);
      setUsersSynced(true);
      return spreadsheetUsers;
    } catch (error) {
      console.error('Gagal membaca user dari Spreadsheet.', error);
      setUsers((previous) => getSafeUsers(previous));
      setUsersSynced(false);
      return getSafeUsers(users);
    } finally {
      if (!silent) setUserLoading(false);
    }
  };

  useEffect(() => {
    refreshUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refreshUsers({ silent: true });
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiConfig.userUrl, sessionToken]);

  useEffect(() => {
    if (!currentUser) return;
    if (!sessionToken) {
      clearSessionUser();
      clearSessionToken();
      setCurrentUser(null);
      setIsAdmin(false);
      setActivePage('dashboard');
      return;
    }
    if (!usersSynced && currentUser.username !== ADMIN_USERNAME) return;
    const safeUsers = getSafeUsers(users);
    const latestUser = safeUsers.find((user) => user.username === currentUser.username);

    if (!latestUser || latestUser.status === 'rejected') {
      clearSessionUser();
      setCurrentUser(null);
      setIsAdmin(false);
      setActivePage('dashboard');
      return;
    }

    if (JSON.stringify(latestUser) !== JSON.stringify(currentUser)) {
      setCurrentUser(latestUser);
      saveSessionUser(latestUser);
    }
  }, [users, currentUser]);

  useEffect(() => {
    const selectedItem = navItems.find((item) => item.id === activePage);
    if (selectedItem?.adminOnly && currentUser?.role !== 'admin') {
      setActivePage('dashboard');
    }
  }, [activePage, currentUser]);

  const loadDummyData = (status = 'dummy') => {
    setTemperature(mockTemperature);
    setRfid(mockRfid);
    setAts(mockAts);
    setConnectionStatus(status);
    setLastUpdated(new Date().toISOString());
  };

  const refreshData = async ({ silent = false } = {}) => {
    if (mode !== 'api') {
      setApiWarning(false);
      loadDummyData('dummy');
      return;
    }
    if (!hasAnyDataApiUrl(apiConfig)) {
      setApiWarning(true);
      loadDummyData('API belum diisi');
      return;
    }
    if (!silent) {
      setLoading(true);
      setConnectionStatus('loading');
      setApiWarning(false);
    }
    try {
      const [tempResult, rfidResult, atsResult] = await Promise.allSettled([
        apiConfig.temperatureUrl?.trim() ? fetchSheetJson(apiConfig.temperatureUrl) : Promise.reject(new Error('URL API Suhu belum diisi.')),
        apiConfig.rfidUrl?.trim() ? fetchSheetJson(apiConfig.rfidUrl) : Promise.reject(new Error('URL API RFID belum diisi.')),
        apiConfig.atsUrl?.trim() ? fetchSheetJson(apiConfig.atsUrl) : Promise.reject(new Error('URL API ATS belum diisi.')),
      ]);

      if (tempResult.status === 'fulfilled') {
        setStateIfUsable(setTemperature, normalizeTemperature(tempResult.value));
      } else {
        console.error('Gagal membaca API Suhu.', tempResult.reason);
      }

      if (rfidResult.status === 'fulfilled') {
        setStateIfUsable(setRfid, normalizeRfid(rfidResult.value));
      } else {
        console.error('Gagal membaca API RFID.', rfidResult.reason);
      }

      if (atsResult.status === 'fulfilled') {
        setStateIfUsable(setAts, normalizeAts(atsResult.value));
      } else {
        console.error('Gagal membaca API ATS.', atsResult.reason);
      }

      const hasAnySuccess = [tempResult, rfidResult, atsResult].some((result) => result.status === 'fulfilled');
      if (!hasAnySuccess) throw new Error('Semua API gagal dibaca.');

      setConnectionStatus('connected');
      if (!silent) setLastUpdated(new Date().toISOString());
    } catch (error) {
      console.error('Gagal membaca API. Menggunakan data dummy.', error);
      if (!silent) {
        setConnectionStatus('error');
        setTemperature(mockTemperature);
        setRfid(mockRfid);
        setAts(mockAts);
        setLastUpdated(new Date().toISOString());
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  
    if (mode !== 'api') return undefined;
    if (!hasAnyDataApiUrl(apiConfig)) return undefined;
  
    const intervalId = window.setInterval(() => {
      refreshData({ silent: true });
    }, 3000);
  
    return () => {
      window.clearInterval(intervalId);
    };
  
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, apiConfig.temperatureUrl, apiConfig.rfidUrl, apiConfig.atsUrl]);

  const saveConfig = (nextConfig) => {
    const normalizedConfig = { ...DEFAULT_API_CONFIG, ...nextConfig };
    setApiConfig(normalizedConfig);
    saveJson(STORAGE_KEY, { ...normalizedConfig, mode });
    saveDashboardConfigToBackend(normalizedConfig.userUrl, { ...normalizedConfig, mode }, sessionToken)
      .catch((error) => console.warn('Gagal menyimpan konfigurasi global dashboard.', error));
    if (mode === 'api' && !hasAnyDataApiUrl(normalizedConfig)) {
      setApiWarning(true);
      setConnectionStatus('API belum diisi');
      loadDummyData('API belum diisi');
      return;
    }
    setApiWarning(false);
    setConnectionStatus('saved');
  };

  const handleSetMode = (nextMode) => {
    setMode(nextMode);
    const nextConfig = { ...apiConfig, mode: nextMode };
    saveJson(STORAGE_KEY, nextConfig);
    saveDashboardConfigToBackend(apiConfig.userUrl, nextConfig, sessionToken)
      .catch((error) => console.warn('Gagal menyimpan mode global dashboard.', error));
    if (nextMode === 'api' && !hasAnyDataApiUrl(apiConfig)) {
      setApiWarning(true);
      setConnectionStatus('API belum diisi');
      loadDummyData('API belum diisi');
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setRegisterError('');
    setRegisterSuccess('');
    const nama = registerForm.nama.trim();
    const username = registerForm.username.trim();
    const password = registerForm.password.trim();
    const safeUsers = getSafeUsers(users);

    if (!nama || !username || !password) {
      setRegisterError('Nama, username, dan password wajib diisi.');
      return;
    }
    if (password.length < 4) {
      setRegisterError('Password minimal 4 karakter.');
      return;
    }
    if (safeUsers.some((user) => user.username.toLowerCase() === username.toLowerCase())) {
      setRegisterError('Username sudah digunakan. Silakan pilih username lain.');
      return;
    }

    const newUser = { id: `usr-${Date.now()}`, nama, username, password, role: 'user', status: 'pending', createdAt: new Date().toISOString() };
    setRegisterLoading(true);
    try {
      const result = await saveRegistrationToSpreadsheet(apiConfig.userUrl, newUser);
      const nextUsers = Array.isArray(result.users) || Array.isArray(result.data)
        ? getSafeUsers(result)
        : [...safeUsers, newUser];
      setUsers(nextUsers);
      setUsersSynced(true);
      setRegisterForm({ nama: '', username: '', password: '' });
      setLoginForm((previous) => ({ ...previous, username }));
      setRegisterSuccess('Pendaftaran berhasil dan tersimpan di Spreadsheet. Tunggu admin menerima akun ini sebelum login.');
    } catch (error) {
      console.error('Gagal menyimpan pendaftaran ke Spreadsheet.', error);
      setRegisterError(error.message || 'Pendaftaran gagal disimpan ke Spreadsheet. Pastikan Apps Script sudah menerima request POST dan deploy sebagai Web App.');
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setLoginError('');
    const username = loginForm.username.trim();
    const password = loginForm.password.trim();

    if (!username || !password) {
      setLoginError('Username dan password wajib diisi.');
      return;
    }

    let matchedUser = null;
    let nextToken = '';
    try {
      const loginPayload = await loginWithUserApi(apiConfig.userUrl, username, password);
      matchedUser = normalizeUser(loginPayload.user);
      nextToken = String(loginPayload.token || '');
    } catch (error) {
      console.error('Login gagal.', error);
      setLoginError(error.message || 'Username atau password salah.');
      return;
    }

    if (!matchedUser || !nextToken) {
      setLoginError('Login gagal. Token sesi tidak diterima dari server.');
      return;
    }

    if (matchedUser.status === 'pending') {
      setLoginError('Akun masih menunggu persetujuan admin.');
      return;
    }
    if (matchedUser.status === 'rejected') {
      setLoginError('Akun ditolak oleh admin.');
      return;
    }

    setCurrentUser(matchedUser);
    saveSessionUser(matchedUser);
    setSessionToken(nextToken);
    saveSessionToken(nextToken);
    setIsAdmin(true);
    setActivePage(loadSessionActivePage());
    setLoginError('');
    setRegisterError('');
    setRegisterSuccess('');
    setLoginForm({ username: '', password: '' });
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    const username = forgotForm.username.trim();
    const password = forgotForm.password.trim();
    const confirmPassword = forgotForm.confirmPassword.trim();

    if (!username || !password || !confirmPassword) {
      setForgotError('Username, password baru, dan konfirmasi password wajib diisi.');
      return;
    }

    if (password.length < 4) {
      setForgotError('Password minimal 4 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setForgotError('Konfirmasi password tidak sama.');
      return;
    }

    if (username === ADMIN_USERNAME) {
      setForgotError('Password admin utama tidak bisa direset dari halaman ini.');
      return;
    }

    setForgotLoading(true);
    try {
      const requestedUser = { username, password, passwordRequestStatus: 'pending', requestedPassword: password, passwordRequestedAt: new Date().toISOString() };
      await requestUserPasswordChangeInSpreadsheet(apiConfig.userUrl, requestedUser);
      setLoginForm((previous) => ({ ...previous, username }));
      setForgotForm({ username: '', password: '', confirmPassword: '' });
      setForgotSuccess('Jika akun sudah diterima admin, permintaan ubah password akan masuk ke Manajemen User untuk disetujui.');
    } catch (error) {
      console.error('Gagal reset password.', error);
      setForgotError(error.message || 'Gagal reset password. Pastikan API Manajemen User aktif dan Apps Script sudah di-deploy.');
    } finally {
      setForgotLoading(false);
    }
  };

  const approveUser = async (id) => {
    const safeUsers = getSafeUsers(users);
    const targetUser = safeUsers.find((user) => user.id === id);
    if (!targetUser) return;
    const updatedUser = { ...targetUser, status: 'approved', approvedAt: new Date().toISOString() };

    setUserLoading(true);
    try {
      await updateUserStatusInSpreadsheet(apiConfig.userUrl, updatedUser, sessionToken);
      setUsers(safeUsers.map((user) => (user.id === id ? updatedUser : user)));
      setUsersSynced(true);
    } catch (error) {
      console.error('Gagal menerima user di Spreadsheet.', error);
      alert('Gagal menerima user di Spreadsheet. Coba refresh lalu ulangi.');
    } finally {
      setUserLoading(false);
    }
  };
  
  const rejectUser = async (id) => {
    const safeUsers = getSafeUsers(users);
    const targetUser = safeUsers.find((user) => user.id === id);
    if (!targetUser) return;
    const updatedUser = { ...targetUser, status: 'rejected', rejectedAt: new Date().toISOString() };

    setUserLoading(true);
    try {
      await updateUserStatusInSpreadsheet(apiConfig.userUrl, updatedUser, sessionToken);
      setUsers(safeUsers.map((user) => (user.id === id ? updatedUser : user)));
      setUsersSynced(true);
    } catch (error) {
      console.error('Gagal menolak user di Spreadsheet.', error);
      alert('Gagal menolak user di Spreadsheet. Coba refresh lalu ulangi.');
    } finally {
      setUserLoading(false);
    }
  };
  
  const deleteUser = async (id) => {
    const safeUsers = getSafeUsers(users);
    const targetUser = safeUsers.find((user) => user.id === id);
  
    if (!targetUser) return;
  
    // Admin utama tidak boleh dihapus
    if (targetUser.username === ADMIN_USERNAME || targetUser.role === 'admin') {
      alert('Admin utama tidak bisa dihapus.');
      return;
    }
  
    const confirmDelete = window.confirm(
      `Hapus user "${targetUser.nama}" dari Spreadsheet dan daftar manajemen user?`
    );
  
    if (!confirmDelete) return;
  
    setUserLoading(true);
    try {
      await deleteUserFromSpreadsheet(apiConfig.userUrl, targetUser, sessionToken);
      setUsers(safeUsers.filter((user) => user.id !== id));
      setUsersSynced(true);
    } catch (error) {
      console.error('Gagal menghapus user dari Spreadsheet.', error);
      alert('Gagal menghapus user dari Spreadsheet. Coba refresh lalu ulangi.');
    } finally {
      setUserLoading(false);
    }
  };

  const approvePasswordRequest = async (id) => {
    const safeUsers = getSafeUsers(users);
    const targetUser = safeUsers.find((user) => user.id === id);
    if (!targetUser) return;
    if (targetUser.passwordRequestStatus !== 'pending') return;

    setUserLoading(true);
    try {
      await approveUserPasswordChangeInSpreadsheet(apiConfig.userUrl, targetUser, sessionToken);
      const updatedUser = {
        ...targetUser,
        password: targetUser.requestedPassword || targetUser.password,
        passwordRequestStatus: 'approved',
        requestedPassword: '',
        passwordUpdatedAt: new Date().toISOString(),
      };
      setUsers(safeUsers.map((user) => (user.id === id ? updatedUser : user)));
      setUsersSynced(true);
      alert('Permintaan password disetujui.');
    } catch (error) {
      console.error('Gagal menyetujui password di Spreadsheet.', error);
      alert('Gagal menyetujui password. Coba refresh lalu ulangi.');
    } finally {
      setUserLoading(false);
    }
  };

  const rejectPasswordRequest = async (id) => {
    const safeUsers = getSafeUsers(users);
    const targetUser = safeUsers.find((user) => user.id === id);
    if (!targetUser) return;
    if (targetUser.passwordRequestStatus !== 'pending') return;

    setUserLoading(true);
    try {
      await rejectUserPasswordChangeInSpreadsheet(apiConfig.userUrl, targetUser, sessionToken);
      const updatedUser = { ...targetUser, passwordRequestStatus: 'rejected', requestedPassword: '' };
      setUsers(safeUsers.map((user) => (user.id === id ? updatedUser : user)));
      setUsersSynced(true);
      alert('Permintaan password ditolak.');
    } catch (error) {
      console.error('Gagal menolak password di Spreadsheet.', error);
      alert('Gagal menolak password. Coba refresh lalu ulangi.');
    } finally {
      setUserLoading(false);
    }
  };

  const handleSaveDeviceWifi = async (event, deviceWifiApiUrl) => {
    event.preventDefault();
    setDeviceWifiError('');
    setDeviceWifiSuccess('');

    const device = String(deviceWifiForm.device || DEVICE_WIFI_OPTIONS[0]).trim();
    const ssid = deviceWifiForm.ssid.trim();
    const password = deviceWifiForm.password.trim();
    const confirmPassword = deviceWifiForm.confirmPassword.trim();

    if (!device || !ssid || !password || !confirmPassword) {
      setDeviceWifiError('Perangkat, SSID/username WiFi, password, dan konfirmasi wajib diisi.');
      return;
    }

    if (!DEVICE_WIFI_OPTIONS.includes(device)) {
      setDeviceWifiError('Perangkat ESP32 tidak dikenali.');
      return;
    }

    if (password.length < 4) {
      setDeviceWifiError('Password WiFi minimal 4 karakter.');
      return;
    }

    if (password !== confirmPassword) {
      setDeviceWifiError('Konfirmasi password tidak sama.');
      return;
    }

    const targetApiUrl = String(deviceWifiApiUrl || apiConfig.deviceWifiUrl || '').trim();

    if (!targetApiUrl) {
      setDeviceWifiError('API WiFi ESP32 wajib diisi di URL Endpoint.');
      return;
    }

    setDeviceWifiLoading(true);
    try {
      const result = await updateDeviceWifiInSpreadsheet(targetApiUrl, device, ssid, password);
      const savedConfig = { device, ssid, password };

      setDeviceWifiForm({ device, ssid: '', password: '', confirmPassword: '' });
      setDeviceWifiSavedConfig((previousConfig) => {
        const nextConfig = {
          ...(previousConfig || {}),
          [device]: savedConfig,
        };
        saveJson(DEVICE_WIFI_SAVED_KEY, nextConfig);
        return nextConfig;
      });
      setDeviceWifiSuccess(result.message || `Konfigurasi WiFi ${device} berhasil dikirim. Perangkat itu akan memakai nilai baru saat membaca API berikutnya.`);
    } catch (error) {
      console.error('Gagal menyimpan WiFi ESP32.', error);
      setDeviceWifiError(error.message || 'Gagal menyimpan WiFi ESP32. Pastikan API WiFi ESP32 aktif.');
    } finally {
      setDeviceWifiLoading(false);
    }
  };

  const handleAdminLogout = () => {
    clearSessionUser();
    clearSessionToken();
    clearSessionActivePage();
    setIsAdmin(false);
    setCurrentUser(null);
    setSessionToken('');
    setActivePage('dashboard');
    setSidebarOpen(false);
    setLoginError('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const runFeatureLoading = (action) => {
    if (featureLoading || typeof action !== 'function') return;
    setFeatureLoading(true);
    window.setTimeout(async () => {
      try {
        await action();
      } finally {
        setFeatureLoading(false);
      }
    }, 1000);
  };

  const renderPage = () => {
    const safeUsers = getSafeUsers(users);
    const renderSharedDashboard = () => (
      <DashboardPage
        temperature={temperature}
        rfid={rfid}
        ats={ats}
        onNavigate={(page) => runFeatureLoading(() => setActivePage(page))}
      />
    );

    switch (activePage) {
      case 'dashboard': return renderSharedDashboard();
      case 'suhu': return <TemperaturePage data={temperature} />;
      case 'rfid': return <RfidPage data={rfid} />;
      case 'ats': return <AtsPage data={ats} />;
      case 'users':
  return currentUser?.role === 'admin'
    ? (
      <UserManagementPage
        users={safeUsers}
        userLoading={userLoading}
        onRefreshUsers={refreshUsers}
        onApproveUser={approveUser}
        onRejectUser={rejectUser}
        onDeleteUser={deleteUser}
        onApprovePasswordRequest={approvePasswordRequest}
        onRejectPasswordRequest={rejectPasswordRequest}
      />
    )
    : renderSharedDashboard();
      case 'api': return currentUser?.role === 'admin' ? <ApiSettingsPage apiConfig={apiConfig} mode={mode} setMode={handleSetMode} connectionStatus={connectionStatus} onSave={saveConfig} onRefresh={refreshData} loading={loading} apiWarning={apiWarning} deviceWifiForm={deviceWifiForm} setDeviceWifiForm={setDeviceWifiForm} deviceWifiError={deviceWifiError} deviceWifiSuccess={deviceWifiSuccess} deviceWifiSavedConfig={deviceWifiSavedConfig} deviceWifiLoading={deviceWifiLoading} onSaveDeviceWifi={handleSaveDeviceWifi} /> : renderSharedDashboard();
      default: return renderSharedDashboard();
    }
  };

  if (!isAdmin) {
    return <LoginPage temperature={temperature} rfid={rfid} ats={ats} loginForm={loginForm} setLoginForm={setLoginForm} loginError={loginError} onLogin={handleAdminLogin} registerForm={registerForm} setRegisterForm={setRegisterForm} registerError={registerError} registerSuccess={registerSuccess} registerLoading={registerLoading} onRegister={handleRegister} forgotForm={forgotForm} setForgotForm={setForgotForm} forgotError={forgotError} forgotSuccess={forgotSuccess} forgotLoading={forgotLoading} onForgotPassword={handleForgotPassword} />;
  }

  return (
    <div className="admin-theme relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <style>{`
        .admin-theme { background-image: radial-gradient(circle at 15% 20%, rgba(34, 211, 238, .16), transparent 30%), radial-gradient(circle at 85% 8%, rgba(14, 165, 233, .14), transparent 24%), radial-gradient(circle at 50% 100%, rgba(99, 102, 241, .10), transparent 28%); }
        .admin-theme .bg-white { background-color: rgba(15, 23, 42, .72) !important; }
        .admin-theme .bg-slate-50 { background-color: rgba(15, 23, 42, .62) !important; }
        .admin-theme .bg-slate-100 { background-color: rgba(15, 23, 42, .82) !important; }
        .admin-theme .border-slate-100, .admin-theme .border-slate-200 { border-color: rgba(103, 232, 249, .14) !important; }
        .admin-theme .text-slate-950 { color: rgb(241 245 249) !important; }
        .admin-theme .text-slate-900 { color: rgb(241 245 249) !important; }
        .admin-theme .text-slate-700, .admin-theme .text-slate-600, .admin-theme .text-slate-500, .admin-theme .text-slate-400 { color: rgb(148 163 184) !important; }
        .admin-theme table thead { background: rgba(8, 47, 73, .35) !important; }
        .admin-theme table tbody tr:hover { background: rgba(34, 211, 238, .08) !important; }
      `}</style>
      <div className="flex min-h-screen">
        <Sidebar activePage={activePage} setActivePage={setActivePage} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} currentUser={currentUser} userNotificationCount={userNotificationCount} onLogout={handleAdminLogout} onFeatureClick={runFeatureLoading} />
        <main className="min-w-0 flex-1 lg:ml-72">
          <Topbar setSidebarOpen={setSidebarOpen} mode={mode} setMode={handleSetMode} connectionStatus={connectionStatus} onFeatureClick={runFeatureLoading} currentUser={currentUser} />
          <div className="p-4 lg:p-8">
            {apiWarning && mode === 'api' && <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">Mode API aktif, tetapi URL belum lengkap.</p><p>Dashboard tetap berjalan memakai data dummy. Buka menu API, isi URL Suhu, RFID, dan ATS, lalu simpan konfigurasi.</p></div>}
            {connectionStatus === 'error' && mode === 'api' && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-bold">API belum dapat dibaca. Dashboard memakai data dummy.</p><p>Pastikan URL benar, Web App sudah dideploy, dan Apps Script memiliki fungsi doGet yang mengembalikan JSON.</p></div>}
            <div className="mb-4 hidden text-xs text-slate-400 md:block">Data demo: suhu {metrics.temp} baris • RFID {metrics.rfid} baris • ATS {metrics.ats} baris</div>
            {renderPage()}
          </div>
        </main>
      </div>
      {featureLoading && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/80 backdrop-blur-md">
          <div className="flex flex-col items-center gap-4 rounded-3xl border border-cyan-300/25 bg-slate-900/80 px-8 py-7 shadow-2xl shadow-cyan-950/40">
            <div className="relative grid h-20 w-20 place-items-center rounded-full border border-cyan-300/30 bg-cyan-400/10">
              <div className="absolute inset-0 rounded-full border border-cyan-300/30 animate-ping" />
              <span className="text-4xl animate-bounce">✈️</span>
            </div>
            <p className="text-sm font-black tracking-wide text-cyan-100">Memuat fitur...</p>
          </div>
        </div>
      )}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-[130] inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-slate-900/90 px-4 py-3 text-xs font-black text-cyan-100 shadow-xl shadow-cyan-950/30 backdrop-blur hover:bg-slate-800"
          aria-label="Naik ke atas"
        >
          ↑ Ke Atas
        </button>
      )}
    </div>
  );
}
