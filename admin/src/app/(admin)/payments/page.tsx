"use client";

import api from "@/lib/api";
import React, { useCallback, useEffect, useState } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import toast from "react-hot-toast";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────────────────────────

interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  paymentMethod: string;
  paypalOrderId?: string;
  paidAt?: string;
  createdAt: string;
  booking?: { bookingId: string; customerName: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  COMPLETED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  FAILED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  REFUNDED: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

const unwrap = <T,>(res: any): T => res.data?.data ?? res.data;
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ search: "", startDate: "", endDate: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (filters.search) params.search = filters.search;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await api.get("/payments", { params });
      const payload = unwrap<{ data: Payment[]; meta: any }>(res);
      setPayments(payload.data ?? []);
      setMeta(payload.meta ?? { total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = payments
    .filter((p) => p.paymentStatus === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const handleConfirmPayment = async (id: string) => {
    if (!confirm("Are you sure you want to manually confirm this payment?")) return;
    try {
      await api.patch(`/payments/${id}/confirm`);
      toast.success("Payment confirmed successfully");
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to confirm payment");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payments</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{meta.total} records · Rs. {totalRevenue.toFixed(2)} collected this page</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Transactions", value: meta.total, color: "bg-blue-50 dark:bg-blue-900/20 text-blue-600" },
          { label: "Completed", value: payments.filter(p => p.paymentStatus === "COMPLETED").length, color: "bg-green-50 dark:bg-green-900/20 text-green-600" },
          { label: "Pending", value: payments.filter(p => p.paymentStatus === "PENDING").length, color: "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl p-5 ${color} border border-current/10`}>
            <p className="text-xs font-medium opacity-70">{label}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
        <input
          type="text"
          placeholder="Search reference, ID, name..."
          value={filters.search}
          onChange={(e) => {
            setFilters((f) => ({ ...f, search: e.target.value }));
            setPage(1);
          }}
          className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800 w-60"
        />
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-400">From</label>
          <ModernDatePicker
            value={filters.startDate}
            onChange={(val) => {
              setFilters((f) => ({ ...f, startDate: val }));
              setPage(1);
            }}
            className="h-9 w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-400">To</label>
          <ModernDatePicker
            value={filters.endDate}
            onChange={(val) => {
              setFilters((f) => ({ ...f, endDate: val }));
              setPage(1);
            }}
            className="h-9 w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800"
          />
        </div>
        {(filters.search || filters.startDate || filters.endDate) && (
          <button
            onClick={() => {
              setFilters({ search: "", startDate: "", endDate: "" });
              setPage(1);
            }}
            className="h-9 px-3 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-white rounded-lg font-medium transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <svg className="animate-spin h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {["Booking", "Customer", "Amount", "Method", "Status", "Paid At", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {payments.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">No payments found.</td></tr>
                ) : payments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{p.booking?.bookingId ?? p.bookingId}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.booking?.customerName ?? "—"}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Rs. {Number(p.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 uppercase text-xs">{p.paymentMethod}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.paymentStatus] ?? "bg-gray-100 text-gray-600"}`}>
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {p.paidAt ? fmt(p.paidAt) : "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {p.paymentStatus === "PENDING" ? (
                        <button
                          onClick={() => handleConfirmPayment(p.id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-theme-xs transition-colors"
                        >
                          Confirm Paid
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600 text-xs">—</span>
                      )}
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
    </div>
  );
}
