"use client";

import api from "@/lib/api";
import React, { useCallback, useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeliveryZone {
  id: string;
  zoneName: string;
  distanceKm: number;
  fee: number;
  createdAt: string;
}

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
        style={{ backgroundColor: "white", borderRadius: "1rem", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", width: "100%", maxWidth: "30rem", maxHeight: "90vh", overflowY: "auto", position: "relative" }}
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

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  confirmVariant = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: "danger" | "success" | "primary";
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  const btnClasses = {
    danger: "bg-red-500 hover:bg-red-600 focus:ring-red-500/20",
    success: "bg-green-500 hover:bg-green-600 focus:ring-green-500/20",
    primary: "bg-brand-500 hover:bg-brand-600 focus:ring-brand-500/20",
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)", padding: "1rem" }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: "white", borderRadius: "1rem", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", width: "100%", maxWidth: "26rem", overflowY: "auto", position: "relative" }}
        className="dark:bg-gray-900 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{message}</p>
        <div className="flex gap-3 mt-6 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`px-4 py-2 text-white rounded-lg text-xs font-semibold transition-colors focus:outline-none focus:ring-2 ${btnClasses[confirmVariant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Zone Form ────────────────────────────────────────────────────────────────

function ZoneForm({ initial, onSuccess }: { initial?: DeliveryZone; onSuccess: () => void }) {
  const [form, setForm] = useState({
    zoneName: initial?.zoneName ?? "",
    distanceKm: initial?.distanceKm ?? 0,
    fee: initial?.fee ?? 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (initial) {
        await api.patch(`/delivery/zones/${initial.id}`, form);
      } else {
        await api.post("/delivery/zones", form);
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
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Zone Name *</label>
        <input required className={inputCls} value={form.zoneName} onChange={(e) => set("zoneName", e.target.value)} placeholder="e.g. Zone 1 - Town Centre" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Distance (Km) *</label>
        <input type="number" step="0.1" required className={inputCls} value={form.distanceKm} onChange={(e) => set("distanceKm", Number(e.target.value))} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Delivery Fee ($) *</label>
        <input type="number" step="0.01" required className={inputCls} value={form.fee} onChange={(e) => set("fee", Number(e.target.value))} />
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
        {loading ? "Saving…" : (initial ? "Update Zone" : "Create Zone")}
      </button>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ZonesPage() {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editZone, setEditZone] = useState<DeliveryZone | null>(null);
  const [deletingZone, setDeletingZone] = useState<DeliveryZone | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/delivery/zones");
      const data = unwrap<DeliveryZone[]>(res);
      setZones(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deleteZone = async (id: string) => {
    setActionLoading(id);
    try {
      await api.delete(`/delivery/zones/${id}`);
      load();
    } finally {
      setActionLoading(null);
      setDeletingZone(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Delivery Zones</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{zones.length} active zones</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Delivery Zone
        </button>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {loading ? (
          <div className="flex justify-center h-48 items-center">
            <svg className="animate-spin h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {["Zone Name", "Distance Limit", "Delivery Fee", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {zones.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-12 text-gray-400">No delivery zones found.</td></tr>
                ) : zones.map((z) => (
                  <tr key={z.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{z.zoneName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{Number(z.distanceKm).toFixed(1)} Km</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">${Number(z.fee).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditZone(z)} className="text-brand-500 hover:text-brand-700 text-xs font-medium">Edit</button>
                        <button onClick={() => setDeletingZone(z)} disabled={actionLoading === z.id}
                          className="text-red-400 hover:text-red-600 text-xs font-medium disabled:opacity-40">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Zone Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Delivery Zone">
        <ZoneForm onSuccess={() => { setCreateOpen(false); load(); }} />
      </Modal>

      {/* Edit Zone Modal */}
      <Modal open={!!editZone} onClose={() => setEditZone(null)} title="Edit Delivery Zone">
        {editZone && <ZoneForm initial={editZone} onSuccess={() => { setEditZone(null); load(); }} />}
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        open={!!deletingZone}
        title="Delete Zone"
        message={`Are you sure you want to delete ${deletingZone?.zoneName}? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        onConfirm={() => {
          if (deletingZone) {
            deleteZone(deletingZone.id);
          }
        }}
        onClose={() => setDeletingZone(null)}
      />
    </div>
  );
}
