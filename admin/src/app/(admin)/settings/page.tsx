"use client";

import api from "@/lib/api";
import React, { useEffect, useState } from "react";

export default function SettingsPage() {
  const [depositRequired, setDepositRequired] = useState(true);
  const [depositAmount, setDepositAmount] = useState(100);
  const [googleReviewLink, setGoogleReviewLink] = useState("");
  const [tripAdvisorReviewLink, setTripAdvisorReviewLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/settings")
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setGoogleReviewLink(data.googleReviewLink || "");
        setTripAdvisorReviewLink(data.tripAdvisorReviewLink || "");
        setDepositRequired(data.depositRequired !== false);
        setDepositAmount(data.depositAmount ?? 100);
      })
      .catch((err) => {
        console.error("Failed to load settings from backend, falling back to localStorage", err);
        const v = localStorage.getItem("migga_deposit_required");
        setDepositRequired(v === null ? true : v === "true");
        const a = localStorage.getItem("migga_deposit_amount");
        setDepositAmount(a === null ? 100 : Number(a));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = (val: boolean) => {
    setDepositRequired(val);
    localStorage.setItem("migga_deposit_required", String(val));
    
    // Sync to backend settings
    api.post("/settings", {
      googleReviewLink,
      tripAdvisorReviewLink,
      depositRequired: val,
      depositAmount,
    })
      .then(() => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to sync toggled deposit setting to backend", err);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.post("/settings", {
        googleReviewLink,
        tripAdvisorReviewLink,
        depositRequired,
        depositAmount,
      });
      localStorage.setItem("migga_deposit_required", String(depositRequired));
      localStorage.setItem("migga_deposit_amount", String(depositAmount));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      alert("Failed to save settings to backend");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <svg className="animate-spin h-6 w-6 text-brand-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage business rules and system settings</p>
      </div>

      {/* Security Deposit Settings */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Security Deposit Requirement</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md">
              Toggle whether a default security deposit is automatically applied and required during booking creation.
            </p>
          </div>
          <button
            onClick={() => handleToggle(!depositRequired)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/25 ${
              depositRequired ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-800"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                depositRequired ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {depositRequired && (
          <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Security Deposit Amount ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="e.g. 100"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 h-10"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        {saved && (
          <div className="mt-4 text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1.5 animate-fade-in">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Settings saved successfully
          </div>
        )}
      </div>

      {/* Review Links settings */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Customer Review Links</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Configure Google and TripAdvisor review URLs. These buttons will be shown to customers on the tracker page once their scooter is returned.
          </p>
        </div>

        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Google Review Link</label>
            <input
              type="url"
              placeholder="e.g. https://g.page/r/YOUR_BUSINESS_ID/review"
              value={googleReviewLink}
              onChange={(e) => setGoogleReviewLink(e.target.value)}
              className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">TripAdvisor Review Link</label>
            <input
              type="url"
              placeholder="e.g. https://www.tripadvisor.com/UserReview-g...html"
              value={tripAdvisorReviewLink}
              onChange={(e) => setTripAdvisorReviewLink(e.target.value)}
              className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-gray-800"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>

      {/* App Information */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs space-y-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">System Information</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">General configuration parameters from system environment</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {[
            ["API Endpoint", process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1"],
            ["System Mode", process.env.NODE_ENV ?? "development"],
            ["Local Storage State", "Active"],
            ["Business Currency", "USD ($)"],
          ].map(([l, v]) => (
            <div key={l} className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-4 border border-gray-100 dark:border-gray-800/60">
              <span className="text-xs text-gray-400">{l}</span>
              <p className="text-sm font-semibold text-gray-800 dark:text-white mt-0.5 truncate">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
