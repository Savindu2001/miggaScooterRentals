"use client";

import api from "@/lib/api";
import React, { useCallback, useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ScooterStatus = "AVAILABLE" | "RENTED" | "MAINTENANCE" | "RETIRED";

interface Scooter {
  id: string;
  scooterCode: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  status: ScooterStatus;
  description?: string;
  images: string[];
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<ScooterStatus, string> = {
  AVAILABLE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  RENTED: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  MAINTENANCE: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  RETIRED: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};

const unwrap = <T,>(res: any): T => res.data?.data ?? res.data;

// ─── Portal Modal ─────────────────────────────────────────────────────────────

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", padding: "1rem" }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: "white", borderRadius: "1rem", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", width: "100%", maxWidth: "42rem", maxHeight: "90vh", overflowY: "auto", position: "relative" }}
        className="dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Scooter Form ─────────────────────────────────────────────────────────────

function ScooterForm({ initial, onSuccess }: { initial?: Scooter; onSuccess: () => void }) {
  const [form, setForm] = useState({
    scooterCode: initial?.scooterCode ?? "",
    title: initial?.title ?? "",
    brand: initial?.brand ?? "",
    model: initial?.model ?? "",
    year: initial?.year ?? new Date().getFullYear(),
    color: initial?.color ?? "",
    plateNumber: initial?.plateNumber ?? "",
    dailyRate: initial?.dailyRate ?? 0,
    weeklyRate: initial?.weeklyRate ?? 0,
    monthlyRate: initial?.monthlyRate ?? 0,
    description: initial?.description ?? "",
  });
  const [images, setImages] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingCode, setLoadingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-generate scooter code if new
  useEffect(() => {
    if (!initial) {
      setLoadingCode(true);
      api.get("/scooters", { params: { limit: 1000 } })
        .then((res) => {
          const list = res.data?.data?.data ?? res.data?.data ?? [];
          const codes = list.map((s: any) => s.scooterCode).filter((c: string) => c && c.startsWith("SC-"));
          let nextNum = 1;
          if (codes.length > 0) {
            const numbers = codes.map((c: string) => {
              const match = c.match(/SC-(\d+)/);
              return match ? parseInt(match[1], 10) : 0;
            });
            nextNum = Math.max(...numbers) + 1;
          }
          const padded = String(nextNum).padStart(3, "0");
          setForm((f) => ({ ...f, scooterCode: `SC-${padded}` }));
        })
        .catch(() => {})
        .finally(() => setLoadingCode(false));
    }
  }, [initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)));
      if (images) Array.from(images).forEach((f) => fd.append("images", f));
      if (initial) {
        await api.patch(`/scooters/${initial.id}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        await api.post("/scooters", fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Scooter Code *</label>
          <input
            type="text"
            required
            className={inputCls}
            value={form.scooterCode}
            disabled={loadingCode}
            placeholder={loadingCode ? "Generating..." : "e.g. SC-001"}
            onChange={(e) => set("scooterCode", e.target.value)}
          />
        </div>
        {[
          ["title", "Title *", "text", true],
          ["brand", "Brand *", "text", true],
          ["model", "Model *", "text", true],
          ["year", "Year *", "number", true],
          ["color", "Color *", "text", true],
          ["plateNumber", "Plate Number *", "text", true],
          ["dailyRate", "Daily Rate ($) *", "number", true],
          ["weeklyRate", "Weekly Rate ($) *", "number", true],
          ["monthlyRate", "Monthly Rate ($) *", "number", true],
        ].map(([k, label, type, req]) => (
          <div key={String(k)}>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
            <input
              type={String(type)}
              step={type === "number" ? "0.01" : undefined}
              required={Boolean(req)}
              className={inputCls}
              value={(form as any)[k as string]}
              onChange={(e) => set(String(k), type === "number" ? Number(e.target.value) : e.target.value)}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
        <textarea rows={2} className={`${inputCls} h-auto py-2`} value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Images (up to 10)</label>
        <input type="file" accept="image/*" multiple className="text-sm text-gray-600 dark:text-gray-400" onChange={(e) => setImages(e.target.files)} />
      </div>
      <button type="submit" disabled={loading || loadingCode}
        className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
        {loading ? "Saving…" : (initial ? "Update Scooter" : "Create Scooter")}
      </button>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ScootersPage() {
  const [scooters, setScooters] = useState<Scooter[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: "", search: "" });
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editScooter, setEditScooter] = useState<Scooter | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      const res = await api.get("/scooters", { params });
      const payload = unwrap<{ data: Scooter[]; meta: any }>(res);
      setScooters(payload.data ?? []);
      setMeta(payload.meta ?? { total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const deleteScooter = async (id: string) => {
    if (!confirm("Soft-delete this scooter?")) return;
    setActionLoading(id);
    try {
      await api.delete(`/scooters/${id}`);
      load();
    } finally {
      setActionLoading(null);
    }
  };

  const changeStatus = async (id: string, status: ScooterStatus) => {
    setActionLoading(id);
    try {
      await api.patch(`/scooters/${id}/status`, { status });
      load();
    } finally {
      setActionLoading(null);
    }
  };

  const STATUSES: ScooterStatus[] = ["AVAILABLE", "RENTED", "MAINTENANCE", "RETIRED"];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scooters</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{meta.total} in fleet</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Scooter
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
        <input type="text" placeholder="Search scooter…" value={filters.search}
          onChange={(e) => { setFilters((f) => ({ ...f, search: e.target.value })); setPage(1); }}
          className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800 w-48" />
        <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}
          className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <svg className="animate-spin h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {scooters.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-gray-400">No scooters found.</div>
          ) : scooters.map((s) => (
            <div key={s.id} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 flex flex-col gap-3">
              {/* Image */}
              <div className="h-36 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden flex items-center justify-center">
                {s.images?.length > 0 ? (
                  <img src={`http://localhost:3000${s.images[0]}`} alt={s.title} className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-12 h-12 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                )}
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{s.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.plateNumber} · {s.year} · <span className="font-mono">{s.scooterCode}</span></p>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s.status]}`}>{s.status}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[["Daily", s.dailyRate], ["Weekly", s.weeklyRate], ["Monthly", s.monthlyRate]].map(([l, v]) => (
                  <div key={String(l)} className="bg-gray-50 dark:bg-gray-800 rounded-lg py-1.5">
                    <p className="text-xs text-gray-400">{l}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">${Number(v).toFixed(0)}</p>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-auto">
                <button onClick={() => setEditScooter(s)}
                  className="flex-1 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-white">
                  Edit
                </button>
                <select
                  value={s.status}
                  onChange={(e) => changeStatus(s.id, e.target.value as ScooterStatus)}
                  disabled={actionLoading === s.id}
                  className="flex-1 text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 bg-transparent dark:text-white dark:bg-gray-800 disabled:opacity-50"
                >
                  {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
                <button onClick={() => deleteScooter(s.id)} disabled={actionLoading === s.id}
                  className="p-1.5 text-red-400 hover:text-red-600 transition-colors disabled:opacity-40">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">Page {meta.page} of {meta.totalPages}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-white">← Prev</button>
            <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:text-white">Next →</button>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Scooter">
        <ScooterForm onSuccess={() => { setCreateOpen(false); load(); }} />
      </Modal>
      <Modal open={!!editScooter} onClose={() => setEditScooter(null)} title="Edit Scooter">
        {editScooter && <ScooterForm initial={editScooter} onSuccess={() => { setEditScooter(null); load(); }} />}
      </Modal>
    </div>
  );
}
