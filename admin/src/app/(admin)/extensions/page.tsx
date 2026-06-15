"use client";

import api from "@/lib/api";
import React, { useCallback, useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ExtensionStatus = "PENDING" | "APPROVED" | "REJECTED";

interface Extension {
  id: string;
  bookingId: string;
  requestedUntil: string;
  reason: string;
  status: ExtensionStatus;
  reviewNote?: string;
  createdAt: string;
  booking?: {
    bookingId: string;
    customerName: string;
    returnDate: string;
    scooter?: { title: string };
  };
  reviewedBy?: { name: string };
}

const STATUS_COLORS: Record<ExtensionStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const unwrap = <T,>(res: any): T => res.data?.data ?? res.data;
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState<Extension[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get("/extensions", { params });
      const payload = unwrap<{ data: Extension[]; meta: any }>(res);
      setExtensions(payload.data ?? []);
      setMeta(payload.meta ?? { total: 0, page: 1, totalPages: 1 });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setActionLoading(id + "_approve");
    try {
      await api.patch(`/extensions/${id}/approve`);
      load();
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (id: string) => {
    setActionLoading(id + "_reject");
    try {
      await api.patch(`/extensions/${id}/reject`);
      load();
    } finally {
      setActionLoading(null);
    }
  };

  const statusOptions: ExtensionStatus[] = ["PENDING", "APPROVED", "REJECTED"];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rental Extensions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {extensions.filter(e => e.status === "PENDING").length} pending review
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800">
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
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
                  {["Booking", "Customer", "Scooter", "Current Return", "Requested Until", "Reason", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {extensions.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No extension requests.</td></tr>
                ) : extensions.map((ext) => (
                  <tr key={ext.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{ext.booking?.bookingId ?? ext.bookingId}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{ext.booking?.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{ext.booking?.scooter?.title ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{ext.booking?.returnDate ? fmt(ext.booking.returnDate) : "—"}</td>
                    <td className="px-4 py-3 font-medium text-orange-500 whitespace-nowrap">{fmt(ext.requestedUntil)}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs">
                      <p className="truncate" title={ext.reason}>{ext.reason}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[ext.status]}`}>{ext.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      {ext.status === "PENDING" ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approve(ext.id)}
                            disabled={actionLoading === ext.id + "_approve"}
                            className="px-2.5 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {actionLoading === ext.id + "_approve" ? "…" : "Approve"}
                          </button>
                          <button
                            onClick={() => reject(ext.id)}
                            disabled={actionLoading === ext.id + "_reject"}
                            className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          >
                            {actionLoading === ext.id + "_reject" ? "…" : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">
                          {ext.reviewedBy ? `by ${ext.reviewedBy.name}` : "Reviewed"}
                        </span>
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
