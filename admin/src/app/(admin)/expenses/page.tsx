"use client";

import api from "@/lib/api";
import React, { useCallback, useEffect, useState } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Scooter {
  id: string;
  title: string;
  plateNumber: string;
  scooterCode: string;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  expenseDate: string;
  note?: string;
  createdAt: string;
  recordedBy?: { name: string };
  scooter?: Scooter;
  scooterId?: string;
}

const unwrap = <T,>(res: any): T => res.data?.data ?? res.data;
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });

// ─── Modern Date Picker ────────────────────────────────────────────────────────

function ModernDatePicker({
  value,
  onChange,
  placeholder,
  className,
  minDate,
  disabled
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  minDate?: string;
  disabled?: boolean;
}) {
  const ref = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const fp = flatpickr(ref.current, {
      dateFormat: "Y-m-d",
      defaultDate: value || undefined,
      minDate: minDate || undefined,
      onChange: (selectedDates, dateStr) => {
        onChange(dateStr);
      },
    });
    return () => fp.destroy();
  }, [minDate]);

  useEffect(() => {
    if (ref.current && (ref.current as any)._flatpickr) {
      (ref.current as any)._flatpickr.setDate(value, false);
    }
  }, [value]);

  return (
    <input
      ref={ref}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
}

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

// ─── Expense Form ─────────────────────────────────────────────────────────────

function ExpenseForm({ initial, scooters, onSuccess }: { initial?: Expense; scooters: Scooter[]; onSuccess: () => void }) {
  const [form, setForm] = useState({
    category: initial?.category ?? "",
    amount: initial?.amount ?? 0,
    expenseDate: initial?.expenseDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    note: initial?.note ?? "",
    scooterId: initial?.scooter?.id ?? initial?.scooterId ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = { ...form, scooterId: form.scooterId || null };
      if (initial) {
        await api.patch(`/expenses/${initial.id}`, payload);
      } else {
        await api.post("/expenses", payload);
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800";
  const CATEGORIES = ["Maintenance", "Fuel", "Insurance", "License/Tax", "Marketing", "Cleaning", "Staff", "Utilities", "Other"];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category *</label>
        <select required className={inputCls} value={form.category} onChange={(e) => set("category", e.target.value)}>
          <option value="">Select category</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Scooter / Bike (Optional)</label>
        <select className={inputCls} value={form.scooterId} onChange={(e) => set("scooterId", e.target.value)}>
          <option value="">No Scooter Associated</option>
          {scooters.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.plateNumber}) — {s.scooterCode}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Amount ($) *</label>
        <input type="number" min={0} step="0.01" required className={inputCls} value={form.amount} onChange={(e) => set("amount", Number(e.target.value))} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Date *</label>
        <ModernDatePicker
          value={form.expenseDate}
          onChange={(val) => set("expenseDate", val)}
          className={inputCls}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Note</label>
        <textarea rows={2} className={`${inputCls} h-auto py-2`} value={form.note} onChange={(e) => set("note", e.target.value)} />
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
        {loading ? "Saving…" : (initial ? "Update Expense" : "Add Expense")}
      </button>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [scooters, setScooters] = useState<Scooter[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ category: "", startDate: "", endDate: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filters.category) params.category = filters.category;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await api.get("/expenses", { params });
      const payload = unwrap<{ data: Expense[]; meta: any }>(res);
      setExpenses(payload.data ?? []);
      setMeta(payload.meta ?? { total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  // Load scooters for selector
  useEffect(() => {
    api.get("/scooters", { params: { limit: 1000 } }).then((res) => {
      const p = unwrap<{ data: Scooter[] }>(res);
      setScooters(p.data ?? []);
    }).catch(() => {});
  }, []);

  const deleteExpense = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    setDeleting(id);
    try {
      await api.delete(`/expenses/${id}`);
      load();
    } finally {
      setDeleting(null);
    }
  };

  const totalShown = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const CATEGORIES = ["Maintenance", "Fuel", "Insurance", "License/Tax", "Marketing", "Cleaning", "Staff", "Utilities", "Other"];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{meta.total} records · ${totalShown.toFixed(2)} shown</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
        <select value={filters.category} onChange={(e) => { setFilters((f) => ({ ...f, category: e.target.value })); setPage(1); }}
          className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800">
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">From</span>
          <ModernDatePicker
            value={filters.startDate}
            onChange={(val) => { setFilters((f) => ({ ...f, startDate: val })); setPage(1); }}
            placeholder="Select date"
            className="h-9 w-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">To</span>
          <ModernDatePicker
            value={filters.endDate}
            onChange={(val) => { setFilters((f) => ({ ...f, endDate: val })); setPage(1); }}
            placeholder="Select date"
            className="h-9 w-32 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800"
          />
        </div>
        {(filters.category || filters.startDate || filters.endDate) && (
          <button onClick={() => { setFilters({ category: "", startDate: "", endDate: "" }); setPage(1); }}
            className="h-9 px-3 text-xs text-red-500 hover:text-red-700 transition-colors">Clear</button>
        )}
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
                  {["Date", "Category", "Bike / Scooter", "Amount", "Note", "Recorded By", ""].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {expenses.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No expenses found.</td></tr>
                ) : expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">{fmt(e.expenseDate)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">{e.category}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {e.scooter ? (
                        <div>
                          <p className="font-medium">{e.scooter.title}</p>
                          <p className="text-xs text-gray-400 font-mono">{e.scooter.scooterCode} ({e.scooter.plateNumber})</p>
                        </div>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">${Number(e.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">{e.note ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{e.recordedBy?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditExpense(e)} className="text-brand-500 hover:text-brand-700 text-xs font-medium">Edit</button>
                        <button onClick={() => deleteExpense(e.id)} disabled={deleting === e.id}
                          className="text-red-400 hover:text-red-600 text-xs font-medium disabled:opacity-40">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400">Page {meta.page} of {meta.totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white transition-colors">← Prev</button>
              <button onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-white transition-colors">Next →</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Expense">
        <ExpenseForm scooters={scooters} onSuccess={() => { setCreateOpen(false); load(); }} />
      </Modal>
      <Modal open={!!editExpense} onClose={() => setEditExpense(null)} title="Edit Expense">
        {editExpense && <ExpenseForm initial={editExpense} scooters={scooters} onSuccess={() => { setEditExpense(null); load(); }} />}
      </Modal>
    </div>
  );
}
