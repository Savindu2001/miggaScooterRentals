"use client";

import api from "@/lib/api";
import Link from "next/link";
import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface VerificationResult {
  success: boolean;
  message: string;
  booking?: {
    bookingId: string;
    customerName: string;
    pickupDate: string;
    returnDate: string;
    scooter?: { title: string; plateNumber: string };
  };
}

export default function VerifyQrPage() {
  const [scannerActive, setScannerActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  
  // Manual entry fallback
  const [manualCode, setManualCode] = useState("");
  
  const qrRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "qr-reader-target";

  // Toggle camera scanner
  const startScanner = async () => {
    setResult(null);
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
    // Stop scanner immediately on first successful detection
    await stopScanner();
    verifyQrCode(decodedText);
  };

  const verifyQrCode = async (qrData: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.post("/bookings/verify-qr", { qrData });
      setResult({
        success: true,
        message: res.data?.message ?? "Verified successfully",
        booking: res.data?.booking ?? res.data?.data?.booking,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to verify QR code. Please ensure it is a valid booking QR.");
      setResult({
        success: false,
        message: err?.response?.data?.message ?? "Verification failed",
      });
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
          (err) => {
            // Keep scanning - errors are just frame detection failures
          }
        )
        .catch((err) => {
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
    verifyQrCode(manualCode.trim());
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/bookings" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Verify Booking</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Scan customer booking QR code to complete scooter pickup</p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs flex flex-col items-center gap-6">
        
        {/* Scanner target element */}
        {scannerActive ? (
          <div className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden bg-black border border-brand-500/30 flex items-center justify-center">
            <div id={scannerId} className="w-full h-full" />
            
            {/* Visual scan frame overlay */}
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
            {/* Pulsing red/green scanning laser */}
            <div className="absolute inset-x-0 h-0.5 bg-brand-500/80 shadow-[0_0_8px_rgba(233,69,96,0.8)] animate-pulse top-1/2 pointer-events-none" />
          </div>
        ) : (
          <div className="w-full max-w-sm aspect-square rounded-2xl border-2 border-dashed border-gray-250 dark:border-gray-800 flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950 p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 4v2m-6 4h12M4 6h16M4 18h16" /></svg>
            </div>
            <div>
              <p className="font-semibold text-gray-800 dark:text-white">Camera Scanner Inactive</p>
              <p className="text-xs text-gray-400 mt-1">Activate the scanner to verify booking verification token</p>
            </div>
            <button
              onClick={startScanner}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              Start Camera Scanner
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

      {/* Manual Entry Fallback */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs space-y-4">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">Or enter QR Token manually</h3>
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <input
            type="text"
            required
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder='e.g. {"bookingId":"MS-001-2024","verificationToken":"..."}'
            className="flex-1 h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-xs text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-850"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-4 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify Token"}
          </button>
        </form>
      </div>

      {/* Results / Feedback */}
      {loading && (
        <div className="flex items-center justify-center p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
          <svg className="animate-spin h-6 w-6 text-brand-500 mr-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          <span className="text-sm text-gray-500 dark:text-gray-400">Verifying booking token with server...</span>
        </div>
      )}

      {error && !loading && (
        <div className="p-4 bg-red-50 dark:bg-red-900/25 border border-red-150 dark:border-red-950/20 text-red-600 dark:text-red-400 text-sm rounded-2xl shadow-theme-xs">
          <p className="font-semibold">Verification Error</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      )}

      {result && result.success && !loading && (
        <div className="p-6 bg-green-50 dark:bg-green-950/25 border border-green-150 dark:border-green-950/20 text-green-700 dark:text-green-400 rounded-2xl shadow-theme-xs space-y-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="font-semibold text-sm">QR Code Verified Successfully!</h3>
          </div>
          <p className="text-xs text-green-600 dark:text-green-500 font-medium">The booking status is updated to Picked Up. The scooter has been rented out.</p>
          
          {result.booking && (
            <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-green-200/40 dark:border-green-950/30 text-gray-800 dark:text-gray-200 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400">Booking ID</span>
                <p className="font-semibold mt-0.5">{result.booking.bookingId}</p>
              </div>
              <div>
                <span className="text-gray-400">Customer</span>
                <p className="font-semibold mt-0.5">{result.booking.customerName}</p>
              </div>
              <div>
                <span className="text-gray-400">Associated Scooter</span>
                <p className="font-semibold mt-0.5">{result.booking.scooter?.title ?? "N/A"}</p>
              </div>
              <div>
                <span className="text-gray-400">Plate Number</span>
                <p className="font-semibold mt-0.5 font-mono">{result.booking.scooter?.plateNumber ?? "N/A"}</p>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Link href="/bookings" className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 transition-colors">
              Return to Bookings
            </Link>
            <button onClick={startScanner} className="px-4 py-2 bg-white text-green-700 border border-green-300 dark:border-green-900 rounded-lg text-xs font-semibold hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors">
              Scan Another QR
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
