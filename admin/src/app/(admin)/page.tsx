"use client";

import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import React, { useEffect, useState, useCallback } from "react";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  overview: {
    totalScooters: number;
    availableScooters: number;
    activeRentals: number;
    reservedScooters: number;
  };
  financials: {
    monthlyRevenue: number;
    monthlyExpenses: number;
    netProfit: number;
    month: string;
  };
  bookingStats: Record<string, number>;
  recentBookings: Array<{
    id: string;
    bookingId: string;
    customerName: string;
    email: string;
    bookingStatus: string;
    totalAmount: number;
    pickupDate: string;
    returnDate: string;
    scooter: { title: string } | null;
  }>;
  upcomingReturns: Array<{
    id: string;
    bookingId: string;
    customerName: string;
    returnDate: string;
    scooter: { title: string };
  }>;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  AWAITING_PAYMENT: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  CONFIRMED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PICKED_UP: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  RETURNED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      {subtitle && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Modern Date Picker ────────────────────────────────────────────────────────

function ModernDatePicker({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const fp = flatpickr(ref.current, {
      dateFormat: "Y-m-d",
      defaultDate: value || undefined,
      onChange: (selectedDates, dateStr) => {
        onChange(dateStr);
      },
    });
    return () => fp.destroy();
  }, []);

  useEffect(() => {
    if (ref.current && (ref.current as any)._flatpickr) {
      (ref.current as any)._flatpickr.setDate(value, false);
    }
  }, [value]);

  return (
    <input
      ref={ref}
      placeholder={placeholder}
      className={className}
    />
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

type FilterPreset = "today" | "yesterday" | "week" | "custom" | "all";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [preset, setPreset] = useState<FilterPreset>("all");
  const [customDates, setCustomDates] = useState({ start: "", end: "" });

  const getFilterDates = useCallback((): { start: string; end: string } => {
    const today = new Date();
    const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

    switch (preset) {
      case "today":
        return { start: fmtDate(today), end: fmtDate(today) };
      case "yesterday": {
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        return { start: fmtDate(yesterday), end: fmtDate(yesterday) };
      }
      case "week": {
        const lastWeek = new Date();
        lastWeek.setDate(today.getDate() - 7);
        return { start: fmtDate(lastWeek), end: fmtDate(today) };
      }
      case "custom":
        return { start: customDates.start, end: customDates.end };
      case "all":
      default:
        return { start: "", end: "" };
    }
  }, [preset, customDates]);

  const loadStats = useCallback(() => {
    setLoading(true);
    const { start, end } = getFilterDates();
    const params: any = {};
    if (start) params.startDate = start;
    if (end) params.endDate = end;

    api
      .get<{ success: boolean; data: DashboardStats; timestamp: string }>("/dashboard/stats", { params })
      .then((res) => setStats(res.data.data))
      .catch(() => setError("Failed to load dashboard data."))
      .finally(() => setLoading(false));
  }, [getFilterDates]);

  useEffect(() => {
    loadStats();
  }, [preset, customDates.start, customDates.end, loadStats]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-brand-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-400">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 font-medium">{error ?? "No data available"}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm text-brand-500 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const { overview, financials, bookingStats, recentBookings, upcomingReturns } = stats;
  const safeBookingStats = bookingStats ?? {};
  const totalBookings = Object.values(safeBookingStats).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header with welcome and filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.name?.split(" ")[0] ?? "Admin"} 👋
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Here&apos;s what&apos;s happening at Migga.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-3 shadow-theme-xs">
          {(["all", "today", "yesterday", "week", "custom"] as FilterPreset[]).map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                preset === p
                  ? "bg-brand-500 text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {p}
            </button>
          ))}

          {preset === "custom" && (
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-800 animate-fade-in">
              <ModernDatePicker
                value={customDates.start}
                onChange={(val) => setCustomDates((c) => ({ ...c, start: val }))}
                placeholder="Start date"
                className="h-8 w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 text-xs focus:outline-none dark:text-white dark:bg-gray-800"
              />
              <span className="text-gray-400 text-xs">to</span>
              <ModernDatePicker
                value={customDates.end}
                onChange={(val) => setCustomDates((c) => ({ ...c, end: val }))}
                placeholder="End date"
                className="h-8 w-28 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-2 text-xs focus:outline-none dark:text-white dark:bg-gray-800"
              />
            </div>
          )}
        </div>
      </div>

      {/* Scooter Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Scooters"
          value={overview.totalScooters}
          subtitle="Fleet size"
          color="bg-blue-100 dark:bg-blue-900/30"
          icon={
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatCard
          title="Available"
          value={overview.availableScooters}
          subtitle="Ready to rent"
          color="bg-green-100 dark:bg-green-900/30"
          icon={
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatCard
          title="Active Rentals"
          value={overview.activeRentals}
          subtitle="Currently rented out"
          color="bg-purple-100 dark:bg-purple-900/30"
          icon={
            <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Reserved"
          value={overview.reservedScooters}
          subtitle="Pending pickup"
          color="bg-orange-100 dark:bg-orange-900/30"
          icon={
            <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      {/* Financials */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Period Revenue"
          value={`$${financials.monthlyRevenue.toFixed(2)}`}
          subtitle={financials.month}
          color="bg-emerald-100 dark:bg-emerald-900/30"
          icon={
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="Period Expenses"
          value={`$${financials.monthlyExpenses.toFixed(2)}`}
          subtitle={financials.month}
          color="bg-red-100 dark:bg-red-900/30"
          icon={
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatCard
          title="Net Profit"
          value={`$${financials.netProfit.toFixed(2)}`}
          subtitle={financials.netProfit >= 0 ? "▲ Positive" : "▼ Loss"}
          color={financials.netProfit >= 0 ? "bg-teal-100 dark:bg-teal-900/30" : "bg-red-100 dark:bg-red-900/30"}
          icon={
            <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          }
        />
      </div>

      {/* Two column lower section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Recent Bookings</h2>
            <span className="text-xs text-gray-400">{totalBookings} total</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {recentBookings.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 text-center">No bookings for selected period.</p>
            ) : (
              recentBookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {b.customerName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {b.scooter?.title ?? "N/A"} · {b.bookingId}
                    </p>
                  </div>
                  <div className="ml-4 flex flex-col items-end gap-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[b.bookingStatus] ?? "bg-gray-100 text-gray-600"}`}>
                      {b.bookingStatus.replace("_", " ")}
                    </span>
                    <span className="text-xs text-gray-500">${Number(b.totalAmount).toFixed(2)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Returns */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Upcoming Returns</h2>
            <span className="text-xs text-gray-400">Next 3 days</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {upcomingReturns.length === 0 ? (
              <p className="p-6 text-sm text-gray-400 text-center">No returns due soon.</p>
            ) : (
              upcomingReturns.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{r.customerName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{r.scooter?.title}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-orange-500">
                      {new Date(r.returnDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-gray-400">{r.bookingId}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Booking Status Breakdown */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 p-6">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Bookings by Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(safeBookingStats).map(([status, count]) => (
            <div key={status} className={`rounded-xl p-4 text-center ${statusColors[status] ?? "bg-gray-50"}`}>
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs mt-1 font-medium uppercase tracking-wide">
                {status.replace("_", " ")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
