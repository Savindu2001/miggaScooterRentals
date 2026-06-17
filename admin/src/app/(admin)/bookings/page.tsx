"use client";

import api from "@/lib/api";
import Link from "next/link";
import React, { useCallback, useEffect, useState } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";


// ─── Types ───────────────────────────────────────────────────────────────────

type BookingStatus = "PENDING" | "AWAITING_PAYMENT" | "CONFIRMED" | "PICKED_UP" | "RETURNED" | "CANCELLED";

interface Payment { id: string; amount: number; paymentStatus: string; }

interface Booking {
  id: string;
  bookingId: string;
  customerName: string;
  nationality: string;
  passportNumber: string;
  passportPhoto?: string;
  idpPhoto?: string;
  email: string;
  phone: string;
  pickupDate: string;
  returnDate: string;
  rentalDays: number;
  totalAmount: number;
  securityDeposit: number;
  bookingStatus: BookingStatus;
  pickupType: string;
  notes?: string;
  agreementPdf?: string;
  agreementSigned?: boolean;
  signedAt?: string;
  signatureImage?: string;
  scooter: { id: string; title: string; plateNumber: string };
  payments: Payment[];
  extensions?: any[];
  createdAt: string;
}

interface Scooter { id: string; title: string; plateNumber: string; status: string; dailyRate: number; weeklyRate: number; monthlyRate: number; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  AWAITING_PAYMENT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PICKED_UP: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  RETURNED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};
const PAY_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  REFUNDED: "bg-gray-100 text-gray-600",
};
const STATUS_NEXT: Partial<Record<BookingStatus, BookingStatus>> = {
  CONFIRMED: "PICKED_UP",
  PICKED_UP: "RETURNED",
};
const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
const unwrap = <T,>(res: any): T => res.data?.data ?? res.data;
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ?? "http://localhost:3000";

function diffDays(a: string, b: string) {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000));
}
function minReturn(pickupDate: string) {
  const d = new Date(pickupDate);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function calculateAmount(rentalDays: number, dailyRate: number, weeklyRate: number, monthlyRate: number): number {
  if (rentalDays <= 0) return 0;
  
  let total = 0;
  let remainingDays = rentalDays;

  // 1. Calculate months (30-day blocks)
  if (remainingDays >= 30) {
    const monthsCount = Math.floor(remainingDays / 30);
    total += monthsCount * monthlyRate;
    remainingDays = remainingDays % 30;
  }

  // 2. Calculate weeks (7-day blocks)
  if (remainingDays >= 7) {
    const weeksCount = Math.floor(remainingDays / 7);
    total += weeksCount * weeklyRate;
    remainingDays = remainingDays % 7;
  }

  // 3. Leftover days
  total += remainingDays * dailyRate;

  return total;
}

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

function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
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
        style={{ borderRadius: "1rem", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", width: "100%", maxWidth: wide ? "56rem" : "42rem", maxHeight: "90vh", overflowY: "auto", position: "relative" }}
        className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
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

// ─── Image viewer ─────────────────────────────────────────────────────────────

function ImageViewer({ open, src, onClose }: { open: boolean; src: string; onClose: () => void }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 99999, backgroundColor: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}
    >
      <img src={src} alt="Document" style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: "0.5rem" }} />
      <button style={{ position: "absolute", top: 16, right: 16, color: "white", fontSize: 28, lineHeight: 1 }} onClick={onClose}>✕</button>
    </div>
  );
}

// ─── Settings helper ──────────────────────────────────────────────────────────

function getDepositRequired() {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem("migga_deposit_required");
  return v === null ? true : v === "true";
}

function getDepositAmount() {
  if (typeof window === "undefined") return 15000;
  const v = localStorage.getItem("migga_deposit_amount");
  return v === null ? 15000 : Number(v);
}

// ─── Create Booking Form ──────────────────────────────────────────────────────

function CreateBookingForm({ scooters, onSuccess }: { scooters: Scooter[]; onSuccess: () => void }) {
  const depositRequired = getDepositRequired();
  const depositAmount = getDepositAmount();
  const [form, setForm] = useState({
    scooterId: "", customerName: "", nationality: "", passportNumber: "",
    email: "", phone: "", pickupDate: "", returnDate: "",
    totalAmount: 0, securityDeposit: depositRequired ? depositAmount : 0, pickupType: "OFFICE", notes: "",
  });
  const [passportPhoto, setPassportPhoto] = useState<File | null>(null);
  const [idpPhoto, setIdpPhoto] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-calculate rental days
  const rentalDays = form.pickupDate && form.returnDate ? diffDays(form.pickupDate, form.returnDate) : 0;

  // Auto-fill total amount when scooter + dates selected
  useEffect(() => {
    if (!form.scooterId || rentalDays === 0) return;
    const scooter = scooters.find((s) => s.id === form.scooterId);
    if (!scooter) return;
    const dailyRate = Number(scooter.dailyRate);
    const weeklyRate = Number(scooter.weeklyRate);
    const monthlyRate = Number(scooter.monthlyRate);
    const rate = calculateAmount(rentalDays, dailyRate, weeklyRate, monthlyRate);
    set("totalAmount", Number(rate));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.scooterId, form.pickupDate, form.returnDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pickupDate || !form.returnDate) { setError("Please select pickup and return dates."); return; }
    setLoading(true); setError(null);
    try {
      const fd = new FormData();
      Object.entries({ ...form, rentalDays }).forEach(([k, v]) => fd.append(k, String(v)));
      if (passportPhoto) fd.append("passportPhoto", passportPhoto);
      if (idpPhoto) fd.append("idpPhoto", idpPhoto);
      await api.post("/bookings", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to create booking");
    } finally { setLoading(false); }
  };

  const inputCls = "w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Scooter *</label>
          <select className={inputCls} required value={form.scooterId} onChange={(e) => set("scooterId", e.target.value)}>
            <option value="">Select scooter</option>
            {scooters.filter(s => s.status === "AVAILABLE").map(s => (
              <option key={s.id} value={s.id}>{s.title} — {s.plateNumber} (Rs. {Number(s.dailyRate).toFixed(2)}/day)</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Customer Name *</label>
          <input className={inputCls} required value={form.customerName} onChange={(e) => set("customerName", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nationality *</label>
          <input className={inputCls} required value={form.nationality} onChange={(e) => set("nationality", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Passport Number *</label>
          <input className={inputCls} required value={form.passportNumber} onChange={(e) => set("passportNumber", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email *</label>
          <input type="email" className={inputCls} required value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Phone * (WhatsApp No)</label>
          <input className={inputCls} required value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+94XXXXXXXXX" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pickup Type</label>
          <select className={inputCls} value={form.pickupType} onChange={(e) => set("pickupType", e.target.value)}>
            <option value="OFFICE">Office Pickup</option>
            <option value="HOTEL">Hotel Delivery</option>
          </select>
        </div>

        {/* Dates */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Pickup Date *</label>
          <ModernDatePicker
            className={inputCls}
            minDate={new Date().toISOString().slice(0, 10)}
            value={form.pickupDate}
            onChange={(val) => {
              set("pickupDate", val);
              if (form.returnDate && val >= form.returnDate) set("returnDate", "");
            }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Return Date *</label>
          <ModernDatePicker
            className={inputCls}
            minDate={form.pickupDate ? minReturn(form.pickupDate) : new Date().toISOString().slice(0, 10)}
            value={form.returnDate}
            onChange={(val) => set("returnDate", val)}
          />
        </div>


        {/* Auto-calculated */}
        <div className="col-span-2 grid grid-cols-3 gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
            <p className="text-xs text-blue-400 mb-0.5">Rental Days</p>
            <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{rentalDays || "—"}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Total Amount (Rs.) *</label>
            <input type="number" min={0} step="0.01" className={inputCls} required value={form.totalAmount} onChange={(e) => set("totalAmount", Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Security Deposit (Rs.)</label>
            <input type="number" min={0} step="0.01" className={inputCls} value={form.securityDeposit} disabled={!depositRequired}
              onChange={(e) => set("securityDeposit", Number(e.target.value))} />
          </div>
        </div>

        {/* Documents */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Passport Photo *</label>
          <div className="relative">
            <input type="file" accept="image/*" id="passportPhoto" className="sr-only" onChange={(e) => setPassportPhoto(e.target.files?.[0] ?? null)} />
            <label htmlFor="passportPhoto" className={`flex items-center gap-2 h-10 ${inputCls} cursor-pointer`}>
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              <span className="text-xs text-gray-400 truncate">{passportPhoto?.name ?? "Choose photo"}</span>
            </label>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">IDP Photo (International Driving Permit)</label>
          <div className="relative">
            <input type="file" accept="image/*" id="idpPhoto" className="sr-only" onChange={(e) => setIdpPhoto(e.target.files?.[0] ?? null)} />
            <label htmlFor="idpPhoto" className={`flex items-center gap-2 h-10 ${inputCls} cursor-pointer`}>
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              <span className="text-xs text-gray-400 truncate">{idpPhoto?.name ?? "Choose photo"}</span>
            </label>
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
        <textarea rows={2} className={`${inputCls} h-auto py-2`} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      <button type="submit" disabled={loading}
        className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
        {loading ? "Creating…" : "Create Booking"}
      </button>
    </form>
  );
}

// ─── Booking Detail Modal ─────────────────────────────────────────────────────

function BookingDetailModal({ booking, onSuccess, onClose }: { booking: Booking | null; onSuccess: () => void; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [resendingQr, setResendingQr] = useState(false);
  const [viewImg, setViewImg] = useState<string | null>(null);

  const [returnPaymentOpen, setReturnPaymentOpen] = useState(false);
  const [returnPaymentMethod, setReturnPaymentMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [returnNote, setReturnNote] = useState("");

  if (!booking) return null;
  const next = STATUS_NEXT[booking.bookingStatus];
  const latestPayment = booking.payments?.[booking.payments.length - 1];
  const isPaid = latestPayment?.paymentStatus === "COMPLETED";

  const pendingExtension = booking.extensions?.find(
    (ext: any) => ext.status === "APPROVED" && ext.paymentStatus === "PENDING"
  );

  const changeStatus = async (status: BookingStatus) => {
    setLoading(true);
    try { await api.patch(`/bookings/${booking.id}/status`, { bookingStatus: status }); onSuccess(); }
    finally { setLoading(false); }
  };

  const resendQrCode = async () => {
    setResendingQr(true);
    try {
      await api.post(`/bookings/${booking.id}/resend-qr`);
      alert("QR code email & WhatsApp resent successfully!");
    } catch (e: any) {
      alert(e.response?.data?.message || "Failed to resend QR code");
    } finally {
      setResendingQr(false);
    }
  };

  const imgUrl = (path: string) => `${API_BASE}${path}`;

  return (
    <>
      <Modal open title={`Booking — ${booking.bookingId}`} onClose={onClose} wide>
        <div className="space-y-5">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Customer", booking.customerName],
              ["Nationality", booking.nationality],
              ["Passport No", booking.passportNumber],
              ["Email", booking.email],
              ["Phone (WhatsApp)", booking.phone],
              ["Scooter", booking.scooter?.title ?? "—"],
              ["Pickup", fmt(booking.pickupDate)],
              ["Return", fmt(booking.returnDate)],
              ["Days", String(booking.rentalDays)],
              ["Amount", `Rs. ${Number(booking.totalAmount).toFixed(2)}`],
              ["Deposit", `Rs. ${Number(booking.securityDeposit).toFixed(2)}`],
              ["Pickup Type", booking.pickupType],
            ].map(([l, v]) => (
              <div key={l}>
                <span className="text-gray-400 text-xs">{l}</span>
                <p className="font-medium text-gray-900 dark:text-white">{v}</p>
              </div>
            ))}
          </div>

          {/* Status + Payment */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[booking.bookingStatus]}`}>
              Booking: {booking.bookingStatus.replace(/_/g, " ")}
            </span>
            {latestPayment && (
              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${PAY_COLORS[latestPayment.paymentStatus] ?? "bg-gray-100 text-gray-600"}`}>
                Payment: {latestPayment.paymentStatus}
              </span>
            )}
            <Link href="/payments" className="text-xs text-brand-500 hover:underline ml-auto">View Payments →</Link>
          </div>

          {/* Documents */}
          {(booking.passportPhoto || booking.idpPhoto || booking.signatureImage || booking.agreementPdf || booking.agreementSigned) && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Documents</p>
              <div className="flex flex-wrap gap-2">
                {booking.passportPhoto && (
                  <button onClick={() => setViewImg(imgUrl(booking.passportPhoto!))}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Passport Photo
                  </button>
                )}
                {booking.idpPhoto && (
                  <button onClick={() => setViewImg(imgUrl(booking.idpPhoto!))}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    IDP Photo
                  </button>
                )}
                {booking.signatureImage && (
                  <button onClick={() => setViewImg(imgUrl(booking.signatureImage!))}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-100 transition-colors">
                    Signature
                  </button>
                )}
                {(booking.agreementSigned || booking.agreementPdf) && (
                  <a href={booking.agreementSigned ? `${API_BASE}/api/v1/bookings/${booking.id}/agreement` : imgUrl(booking.agreementPdf!)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg text-xs font-medium hover:bg-orange-100 transition-colors">
                    Agreement PDF ↗
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Document Previews */}
          {(booking.passportPhoto || booking.idpPhoto) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
              {booking.passportPhoto && (
                <div>
                  <span className="text-xs text-gray-400 font-semibold block mb-1">Passport Photo Preview</span>
                  <div
                    className="h-44 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setViewImg(imgUrl(booking.passportPhoto!))}
                  >
                    <img src={imgUrl(booking.passportPhoto)} alt="Passport" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
              {booking.idpPhoto && (
                <div>
                  <span className="text-xs text-gray-400 font-semibold block mb-1">IDP Photo Preview</span>
                  <div
                    className="h-44 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setViewImg(imgUrl(booking.idpPhoto!))}
                  >
                    <img src={imgUrl(booking.idpPhoto)} alt="IDP" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div className="bg-gray-50 dark:bg-gray-805 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Notes</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{booking.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-100 dark:border-gray-800">
            {next && (
              <button
                onClick={() => {
                  if (next === "RETURNED" && pendingExtension) {
                    setReturnPaymentOpen(true);
                  } else {
                    changeStatus(next);
                  }
                }}
                disabled={loading || resendingQr}
                className="flex-1 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loading ? "…" : `Mark as ${next.replace(/_/g, " ")}`}
              </button>
            )}
            {booking.bookingStatus !== "CANCELLED" && booking.bookingStatus !== "RETURNED" && isPaid && (
              <button onClick={resendQrCode} disabled={loading || resendingQr}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                {resendingQr ? "Resending QR..." : "Resend QR Code"}
              </button>
            )}
            {booking.bookingStatus !== "CANCELLED" && booking.bookingStatus !== "RETURNED" && (
              <button onClick={() => changeStatus("CANCELLED")} disabled={loading || resendingQr}
                className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                Cancel
              </button>
            )}
          </div>
        </div>
      </Modal>
      {viewImg && <ImageViewer open src={viewImg} onClose={() => setViewImg(null)} />}

      {returnPaymentOpen && pendingExtension && (
        <Modal open title="Unpaid Extension Payment Due" onClose={() => setReturnPaymentOpen(false)}>
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-250 dark:border-yellow-900/30 rounded-xl space-y-2 text-xs">
              <p className="font-bold text-yellow-800 dark:text-yellow-400">⚠️ Return Extension Payment Required</p>
              <p className="text-gray-655 dark:text-gray-300">
                This booking has an approved rental extension that is unpaid. You must collect the payment before marking the scooter as returned.
              </p>
              <div className="mt-2 text-gray-750 dark:text-gray-200">
                <p>New Return Date: <strong>{fmt(pendingExtension.requestedUntil)}</strong></p>
                <p>Base Extension Fee: <strong>Rs. {Number(pendingExtension.extraAmount).toFixed(2)}</strong></p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Payment Method</label>
              <div className="grid grid-cols-3 gap-3">
                {(["CASH", "CARD", "BANK_TRANSFER"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setReturnPaymentMethod(m)}
                    className={`py-2 px-3 border rounded-xl text-xs font-bold transition-all text-center ${
                      returnPaymentMethod === m
                        ? "border-brand-500 bg-brand-500/5 text-brand-500"
                        : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {m === "BANK_TRANSFER" ? "Bank Transfer" : m === "CARD" ? "Card (+3.5%)" : "Cash"}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border dark:border-gray-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Base Extension Amount</span>
                <span className="font-medium text-gray-850 dark:text-white">Rs. {Number(pendingExtension.extraAmount).toFixed(2)}</span>
              </div>
              {returnPaymentMethod === "CARD" && (
                <div className="flex justify-between text-yellow-600">
                  <span>Card Processing Surcharge (3.5%)</span>
                  <span className="font-medium">+ Rs. {(Number(pendingExtension.extraAmount) * 0.035).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between border-t dark:border-gray-800 pt-2 font-bold text-sm">
                <span className="text-gray-900 dark:text-white">Total Amount to Charge</span>
                <span className="text-brand-500">Rs. {((Number(pendingExtension.extraAmount)) * (returnPaymentMethod === "CARD" ? 1.035 : 1)).toFixed(2)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Desk Return Note</label>
              <input
                type="text"
                placeholder="e.g. Paid cash at desk on return"
                value={returnNote}
                onChange={(e) => setReturnNote(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-850"
              />
            </div>

            <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setReturnPaymentOpen(false)}
                className="flex-1 py-2 border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 text-gray-750 dark:text-gray-300 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const base = Number(pendingExtension.extraAmount);
                    const finalAmount = base * (returnPaymentMethod === "CARD" ? 1.035 : 1);
                    await api.post(`/bookings/${booking.id}/admin-confirm-return`, {
                      paymentMethod: returnPaymentMethod,
                      amountPaid: finalAmount,
                      extensionId: pendingExtension.id,
                      referenceNote: returnNote || `Extension paid via ${returnPaymentMethod} at return`
                    });
                    setReturnPaymentOpen(false);
                    onSuccess();
                  } catch (e: any) {
                    alert(e.response?.data?.message || "Failed to complete return and payment");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="flex-[2] py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold transition-all text-center"
              >
                {loading ? "Processing..." : "Confirm Payment & Complete Return 🏁"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [scooters, setScooters] = useState<Scooter[]>([]);
  const [filters, setFilters] = useState({ status: "", search: "", startDate: "", endDate: "" });
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 15 };
      if (filters.status) params.status = filters.status;
      if (filters.search) params.search = filters.search;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      const res = await api.get("/bookings", { params });
      const payload = unwrap<{ data: Booking[]; meta: any }>(res);
      setBookings(payload.data ?? []);
      setMeta(payload.meta ?? { total: 0, page: 1, totalPages: 1 });
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get("/scooters", { params: { limit: 100 } }).then((r) => {
      const p = unwrap<{ data: Scooter[] }>(r);
      setScooters(p.data ?? []);
    });
  }, []);

  const statusOptions: BookingStatus[] = ["PENDING", "AWAITING_PAYMENT", "CONFIRMED", "PICKED_UP", "RETURNED", "CANCELLED"];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{meta.total} total bookings</p>
        </div>
        <div className="flex gap-2">
          <Link href="/bookings/verify"
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 4v2m-6 4h12M4 6h16M4 18h16" /></svg>
            Verify Booking (QR)
          </Link>
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Booking
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4">
        <input type="text" placeholder="Search name, ID, passport…" value={filters.search}
          onChange={(e) => { setFilters(f => ({ ...f, search: e.target.value })); setPage(1); }}
          className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800 w-52" />
        <select value={filters.status} onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}
          className="h-9 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800">
          <option value="">All Statuses</option>
          {statusOptions.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-400">From</label>
          <ModernDatePicker
            value={filters.startDate}
            onChange={(val) => { setFilters(f => ({ ...f, startDate: val })); setPage(1); }}
            className="h-9 w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-400">To</label>
          <ModernDatePicker
            value={filters.endDate}
            onChange={(val) => { setFilters(f => ({ ...f, endDate: val })); setPage(1); }}
            className="h-9 w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:outline-none dark:text-white dark:bg-gray-800"
          />
        </div>
        {(filters.status || filters.search || filters.startDate || filters.endDate) && (
          <button onClick={() => { setFilters({ status: "", search: "", startDate: "", endDate: "" }); setPage(1); }}
            className="h-9 px-3 text-xs text-red-500 hover:text-red-700 transition-colors">Clear</button>
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
                  {["Booking ID", "Customer", "Scooter", "Pickup", "Return", "Days", "Amount", "Status", "Payment", "Action"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-gray-400 px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {bookings.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-400">No bookings found.</td></tr>
                ) : bookings.map((b) => {
                  const lastPay = b.payments?.[b.payments.length - 1];
                  return (
                    <tr key={b.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer" onClick={() => setSelectedBooking(b)}>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{b.bookingId}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{b.customerName}</p>
                        <p className="text-xs text-gray-400">{b.email}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{b.scooter?.title ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmt(b.pickupDate)}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmt(b.returnDate)}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 text-center">{b.rentalDays}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Rs. {Number(b.totalAmount).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[b.bookingStatus]}`}>
                          {b.bookingStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {lastPay ? (
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${PAY_COLORS[lastPay.paymentStatus] ?? "bg-gray-100 text-gray-600"}`}>
                            {lastPay.paymentStatus}
                          </span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Link href="/payments" className="text-brand-500 hover:text-brand-700 text-xs font-medium">Payments</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400">Page {meta.page} of {meta.totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">← Prev</button>
              <button onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))} disabled={page === meta.totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Next →</button>
            </div>
          </div>
        )}
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New Booking" wide>
        <CreateBookingForm scooters={scooters} onSuccess={() => { setCreateOpen(false); load(); }} />
      </Modal>

      <BookingDetailModal booking={selectedBooking} onSuccess={() => { setSelectedBooking(null); load(); }} onClose={() => setSelectedBooking(null)} />
    </div>
  );
}
