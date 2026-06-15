"use client";

import api from "@/lib/api";
import React, { useCallback, useEffect, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
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

// ─── Create User Form ─────────────────────────────────────────────────────────

function CreateUserForm({ onSuccess }: { onSuccess: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/users", form);
      onSuccess();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(", ") : (msg ?? "Failed to create user"));
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>}
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name *</label>
        <input required className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email *</label>
        <input type="email" required className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Password * (min 8 chars)</label>
        <input type="password" required minLength={8} className={inputCls} value={form.password} onChange={(e) => set("password", e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Role</label>
        <select className={inputCls} value={form.role} onChange={(e) => set("role", e.target.value)}>
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
        {loading ? "Creating…" : "Create User"}
      </button>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Confirm state
  const [confirmData, setConfirmData] = useState<{ userId: string; name: string; action: "activate" | "deactivate" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/users");
      const data = unwrap<StaffUser[]>(res);
      setUsers(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleUserStatus = async (id: string, active: boolean) => {
    setActionLoading(id);
    try {
      await api.patch(`/users/${id}`, { isActive: active });
      load();
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Users</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{users.length} users · {users.filter(u => u.isActive).length} active</p>
        </div>
        <button onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add Staff
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center h-48 items-center">
          <svg className="animate-spin h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.length === 0 ? (
            <div className="col-span-3 text-center py-16 text-gray-400">No staff users found.</div>
          ) : users.map((u) => (
            <div key={u.id} className={`rounded-2xl border ${u.isActive ? "border-gray-200 dark:border-gray-800" : "border-red-100 dark:border-red-900/30"} bg-white dark:bg-gray-900 p-5`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
                    <span className="text-white font-semibold text-sm">{u.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{u.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                  </div>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${u.role === "ADMIN" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                  {u.role}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${u.isActive ? "text-green-600 dark:text-green-400" : "text-red-400"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? "bg-green-500" : "bg-red-400"}`} />
                  {u.isActive ? "Active" : "Deactivated"}
                </span>
                <button
                  onClick={() => {
                    setConfirmData({
                      userId: u.id,
                      name: u.name,
                      action: u.isActive ? "deactivate" : "activate"
                    });
                  }}
                  disabled={actionLoading === u.id}
                  className={`text-xs font-semibold transition-colors disabled:opacity-40 ${
                    u.isActive ? "text-red-400 hover:text-red-600" : "text-green-500 hover:text-green-600"
                  }`}
                >
                  {actionLoading === u.id ? "…" : u.isActive ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Staff Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Staff User">
        <CreateUserForm onSuccess={() => { setCreateOpen(false); load(); }} />
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmModal
        open={!!confirmData}
        title={confirmData?.action === "activate" ? "Activate User" : "Deactivate User"}
        message={`Are you sure you want to ${confirmData?.action} ${confirmData?.name}? This will affect their login access.`}
        confirmLabel={confirmData?.action === "activate" ? "Activate" : "Deactivate"}
        confirmVariant={confirmData?.action === "activate" ? "success" : "danger"}
        onConfirm={() => {
          if (confirmData) {
            toggleUserStatus(confirmData.userId, confirmData.action === "activate");
          }
        }}
        onClose={() => setConfirmData(null)}
      />
    </div>
  );
}
