"use client";

import api from "@/lib/api";
import Link from "next/link";
import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import toast from "react-hot-toast";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? 'http://localhost:3000';

export default function VerifyQrPage() {
  const [scannerActive, setScannerActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedBooking, setScannedBooking] = useState<any | null>(null);
  
  // Manual entry fallback
  const [manualCode, setManualCode] = useState("");
  
  const qrRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "qr-reader-target";

  // Form states for Pickup
  const [pickupPaymentMethod, setPickupPaymentMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [pickupNote, setPickupNote] = useState("");

  // Form states for Return
  const [returnPaymentMethod, setReturnPaymentMethod] = useState<"CASH" | "CARD" | "BANK_TRANSFER">("CASH");
  const [returnNote, setReturnNote] = useState("");

  // Toggle camera scanner
  const startScanner = async () => {
    setScannedBooking(null);
    setError(null);
    setScannerActive(true);
  };

  const stopScanner = async () => {
    if (qrRef.current && qrRef.current.isScanning) {
      try {
        await qrRef.current.stop();
      } catch (err) {
        console.error("Failed to stop scanner", err);
      }
    }
    setScannerActive(false);
  };

  // Process decoded QR text
  const handleScanSuccess = async (decodedText: string) => {
    await stopScanner();
    scanQrCode(decodedText);
  };

  const scanQrCode = async (qrData: string) => {
    setLoading(true);
    setError(null);
    setScannedBooking(null);
    try {
      const res = await api.post("/bookings/scan-qr", { qrData });
      const booking = res.data?.data ?? res.data;
      setScannedBooking(booking);
      if (booking.paymentMethod) {
        setPickupPaymentMethod(booking.paymentMethod);
      }
      toast.success("Booking QR scanned successfully!");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to find booking. Please ensure the QR is correct.");
      toast.error("Scan failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scannerActive) {
      const html5QrCode = new Html5Qrcode(scannerId);
      qrRef.current = html5QrCode;

      html5QrCode
        .start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.7;
              return { width: size, height: size };
            },
          },
          handleScanSuccess,
          () => {}
        )
        .catch(() => {
          setError("Could not access camera. Please check permissions.");
          setScannerActive(false);
        });
    }

    return () => {
      if (qrRef.current && qrRef.current.isScanning) {
        qrRef.current.stop().catch(() => {});
      }
    };
  }, [scannerActive]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    scanQrCode(manualCode.trim());
  };

  const handleConfirmPickup = async () => {
    if (!scannedBooking) return;
    setActionLoading(true);
    try {
      const baseAmount = Number(scannedBooking.totalAmount);
      const cardFee = pickupPaymentMethod === "CARD" ? baseAmount * 0.035 : 0;
      const finalTotal = baseAmount + cardFee;

      const res = await api.post(`/bookings/${scannedBooking.id}/admin-confirm-pickup`, {
        paymentMethod: pickupPaymentMethod,
        amountPaid: finalTotal,
        referenceNote: pickupNote || `Payment confirmed via ${pickupPaymentMethod} at pickup`,
      });
      toast.success("Pickup confirmed successfully!");
      setScannedBooking(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to confirm pickup");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReturn = async (pendingExtension?: any) => {
    if (!scannedBooking) return;
    setActionLoading(true);
    try {
      const base = pendingExtension ? Number(pendingExtension.extraAmount) : 0;
      const cardFee = pendingExtension && returnPaymentMethod === "CARD" ? base * 0.035 : 0;
      const finalAmount = base + cardFee;

      await api.post(`/bookings/${scannedBooking.id}/admin-confirm-return`, {
        paymentMethod: pendingExtension ? returnPaymentMethod : undefined,
        amountPaid: finalAmount,
        extensionId: pendingExtension?.id,
        referenceNote: returnNote || (pendingExtension ? `Extension paid via ${returnPaymentMethod} at return` : "Returned normally"),
      });
      toast.success("Scooter return completed successfully!");
      setScannedBooking(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? "Failed to confirm return");
    } finally {
      setActionLoading(false);
    }
  };

  // Calculate pricing for pickup screen
  const getPickupTotal = () => {
    if (!scannedBooking) return 0;
    const base = Number(scannedBooking.totalAmount);
    if (pickupPaymentMethod === "CARD") return base * 1.035;
    return base;
  };

  // Find approved unpaid extensions for return screen
  const pendingExtension = scannedBooking?.extensions?.find(
    (ext: any) => ext.status === "APPROVED" && ext.paymentStatus === "PENDING"
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/bookings" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">QR Code Desk Scan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Scan customer booking code to process Pickup or Return</p>
        </div>
      </div>

      {!scannedBooking && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs flex flex-col items-center gap-6">
          {scannerActive ? (
            <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black border border-brand-500/30 flex items-center justify-center">
              <div id={scannerId} className="w-full h-full" />
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-12">
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-t-4 border-l-4 border-brand-500 rounded-tl" />
                  <div className="w-6 h-6 border-t-4 border-r-4 border-brand-500 rounded-tr" />
                </div>
                <div className="flex justify-between">
                  <div className="w-6 h-6 border-b-4 border-l-4 border-brand-500 rounded-bl" />
                  <div className="w-6 h-6 border-b-4 border-r-4 border-brand-500 rounded-br" />
                </div>
              </div>
              <div className="absolute inset-x-0 h-0.5 bg-brand-500/80 shadow-[0_0_8px_rgba(233,69,96,0.8)] animate-pulse top-1/2 pointer-events-none" />
            </div>
          ) : (
            <div className="w-full max-w-sm aspect-square rounded-2xl border-2 border-dashed border-gray-250 dark:border-gray-800 flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 4v2m-6 4h12M4 6h16M4 18h16" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-800 dark:text-white">Scanner Ready</p>
                <p className="text-xs text-gray-400 mt-1">Activate camera scanner to begin verification</p>
              </div>
              <button
                onClick={startScanner}
                className="px-5 py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
              >
                Launch Scanner Camera
              </button>
            </div>
          )}

          {scannerActive && (
            <button
              onClick={stopScanner}
              className="px-4 py-2 border border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel Scanning
            </button>
          )}
        </div>
      )}

      {/* Manual Entry Fallback */}
      {!scannedBooking && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs space-y-4">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Or verify token manually</h3>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              required
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder='Paste the QR data payload here...'
              className="flex-1 h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-850"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 h-10"
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </form>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
          <svg className="animate-spin h-6 w-6 text-brand-500 mr-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-gray-500 dark:text-gray-400">Loading booking from scanner...</span>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-red-50 dark:bg-red-900/25 border border-red-150 dark:border-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-2xl shadow-theme-xs">
          <p className="font-semibold">Scanner Error</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      )}

      {/* Scanned Booking Details & Verification Desk Panel */}
      {scannedBooking && !loading && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <span className="text-xs text-gray-400 font-semibold uppercase">Booking Reference</span>
                <h2 className="text-lg font-bold text-gray-800 dark:text-white mt-0.5">{scannedBooking.bookingId}</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                scannedBooking.bookingStatus === 'PICKED_UP' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                scannedBooking.bookingStatus === 'CONFIRMED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                scannedBooking.bookingStatus === 'RETURNED' ? 'bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-400' :
                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
              }`}>
                {scannedBooking.bookingStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400">Customer Name</span>
                <p className="font-semibold text-gray-800 dark:text-white mt-0.5">{scannedBooking.customerName}</p>
              </div>
              <div>
                <span className="text-gray-400">Passport Number</span>
                <p className="font-semibold text-gray-800 dark:text-white mt-0.5">{scannedBooking.passportNumber} ({scannedBooking.nationality})</p>
              </div>
              <div>
                <span className="text-gray-400">Scooter Rented</span>
                <p className="font-semibold text-gray-800 dark:text-white mt-0.5">
                  {scannedBooking.scooter?.brand} {scannedBooking.scooter?.model} ({scannedBooking.scooter?.plateNumber})
                </p>
              </div>
              <div>
                <span className="text-gray-400">Rental Duration</span>
                <p className="font-semibold text-gray-800 dark:text-white mt-0.5">
                  {scannedBooking.rentalDays} days ({new Date(scannedBooking.pickupDate).toLocaleDateString()} to {new Date(scannedBooking.returnDate).toLocaleDateString()})
                </p>
              </div>
            </div>
          </div>

          {/* ─────────────────── pickup desk flow ─────────────────── */}
          {scannedBooking.bookingStatus !== "PICKED_UP" && scannedBooking.bookingStatus !== "RETURNED" && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">Scooter Pickup Verification Desk</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Review documents and collect booking payments</p>
              </div>

              {scannedBooking.bankSlipImage && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase block">Customer Bank Transfer Slip</span>
                  <div className="border rounded-xl p-2 bg-gray-50 dark:bg-gray-950 flex justify-center">
                    <img 
                      src={`${API_BASE}${scannedBooking.bankSlipImage}`} 
                      alt="Bank Slip" 
                      className="max-h-60 object-contain rounded-lg shadow-sm"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Select Payment Method at Desk</label>
                  <div className="grid grid-cols-3 gap-3">
                    {["CASH", "CARD", "BANK_TRANSFER"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPickupPaymentMethod(m as any)}
                        className={`py-3 px-4 border rounded-xl text-xs font-bold transition-all text-center ${
                          pickupPaymentMethod === m
                            ? "border-brand-500 bg-brand-500/5 text-brand-500"
                            : "border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {m === "BANK_TRANSFER" ? "Bank Transfer" : m === "CARD" ? "Card Payment (+3.5%)" : "Cash (At Pickup)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-950 p-4 rounded-xl border dark:border-gray-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Base Booking Fee</span>
                    <span className="font-medium text-gray-800 dark:text-white">Rs. {Number(scannedBooking.totalAmount).toFixed(2)}</span>
                  </div>
                  {pickupPaymentMethod === "CARD" && (
                    <div className="flex justify-between text-yellow-600">
                      <span>Card Processing Surcharge (3.5%)</span>
                      <span className="font-medium">+ Rs. {(Number(scannedBooking.totalAmount) * 0.035).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t dark:border-gray-800 pt-2 font-bold text-sm">
                    <span className="text-gray-900 dark:text-white">Amount to Charge</span>
                    <span className="text-brand-500">Rs. {getPickupTotal().toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Internal Desk Reference Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Card payment verified via POS terminal ID #4928"
                    value={pickupNote}
                    onChange={(e) => setPickupNote(e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-850"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setScannedBooking(null)}
                  className="flex-1 py-3 border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all text-center"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPickup}
                  disabled={actionLoading}
                  className="flex-[2] py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all text-center disabled:opacity-50"
                >
                  {actionLoading ? "Processing Pickup..." : "Confirm Payment & Complete Pickup 🛵"}
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────── return desk flow ─────────────────── */}
          {scannedBooking.bookingStatus === "PICKED_UP" && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-base">Scooter Return Verification Desk</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Verify scooter drop-off inspection and capture extra extension costs</p>
              </div>

              {pendingExtension ? (
                <div className="space-y-4 border border-yellow-200/60 dark:border-yellow-950/30 rounded-xl p-4 bg-yellow-500/5">
                  <div className="flex items-center gap-2 text-yellow-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-xs font-bold uppercase">Approved Rental Extension Detected</span>
                  </div>
                  
                  <div className="text-xs space-y-2 text-gray-600 dark:text-gray-400">
                    <p>Renter extended their trip until: <strong>{new Date(pendingExtension.requestedUntil).toLocaleDateString()}</strong></p>
                    <p>Extra cost due: <strong className="text-brand-500 text-sm">Rs. {Number(pendingExtension.extraAmount).toFixed(2)}</strong></p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Extension Payment Method</label>
                    <div className="grid grid-cols-3 gap-3">
                      {["CASH", "CARD", "BANK_TRANSFER"].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setReturnPaymentMethod(m as any)}
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
                      <span className="font-medium text-gray-800 dark:text-white">Rs. {Number(pendingExtension.extraAmount).toFixed(2)}</span>
                    </div>
                    {returnPaymentMethod === "CARD" && (
                      <div className="flex justify-between text-yellow-600">
                        <span>Card Processing Surcharge (3.5%)</span>
                        <span className="font-medium">+ Rs. {(Number(pendingExtension.extraAmount) * 0.035).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t dark:border-gray-800 pt-2 font-bold text-sm">
                      <span className="text-gray-900 dark:text-white">Total Amount to Charge</span>
                      <span className="text-brand-500">Rs. {(Number(pendingExtension.extraAmount) * (returnPaymentMethod === "CARD" ? 1.035 : 1)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-green-500/5 border border-green-200/50 dark:border-green-950/20 rounded-xl p-4 text-xs text-green-600">
                  ✓ No pending extension payments are due for this booking. Proceed to complete scooter drop-off inspection.
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Internal Desk Return Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Scooter inspected. Fuel full. Minor cosmetic scratch on bumper, waived."
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-850"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setScannedBooking(null)}
                  className="flex-1 py-3 border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all text-center"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmReturn(pendingExtension)}
                  disabled={actionLoading}
                  className="flex-[2] py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-bold transition-all text-center disabled:opacity-50"
                >
                  {actionLoading ? "Processing Return..." : "Confirm Return & Mark Available 🏁"}
                </button>
              </div>
            </div>
          )}

          {/* ─────────────────── already returned ─────────────────── */}
          {scannedBooking.bookingStatus === "RETURNED" && (
            <div className="bg-gray-50 dark:bg-gray-950 p-6 rounded-2xl border text-center text-xs space-y-3 dark:border-gray-800">
              <span className="text-3xl block">🏁</span>
              <p className="font-bold text-gray-800 dark:text-white text-sm">Scooter has already been Returned</p>
              <p className="text-gray-400">This booking is completed. Scooter is available in fleet.</p>
              <button
                type="button"
                onClick={() => setScannedBooking(null)}
                className="px-5 py-2 border rounded-xl font-semibold hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Done
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
