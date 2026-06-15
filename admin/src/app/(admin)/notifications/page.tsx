"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/api";

type TemplateItem = {
  subject?: string;
  body: string;
};

type TemplatesState = {
  new_booking_email: TemplateItem;
  new_booking_whatsapp: TemplateItem;
  confirm_email: TemplateItem;
  confirm_whatsapp: TemplateItem;
  payment_success_email: TemplateItem;
  payment_success_whatsapp: TemplateItem;
  return_reminder_email: TemplateItem;
  return_reminder_whatsapp: TemplateItem;
};

const defaultTemplates: TemplatesState = {
  new_booking_email: { subject: "", body: "" },
  new_booking_whatsapp: { body: "" },
  confirm_email: { subject: "", body: "" },
  confirm_whatsapp: { body: "" },
  payment_success_email: { subject: "", body: "" },
  payment_success_whatsapp: { body: "" },
  return_reminder_email: { subject: "", body: "" },
  return_reminder_whatsapp: { body: "" },
};

const TAB_META = {
  new_booking: {
    label: "New Booking Notification",
    emailKey: "new_booking_email" as const,
    whatsappKey: "new_booking_whatsapp" as const,
    placeholders: ["customerName", "bookingId", "scooterTitle", "pickupDate", "returnDate", "totalAmount", "securityDeposit", "systemName", "paymentLink"],
  },
  confirm: {
    label: "Booking Confirmed",
    emailKey: "confirm_email" as const,
    whatsappKey: "confirm_whatsapp" as const,
    placeholders: ["customerName", "bookingId", "scooterTitle", "pickupDate", "returnDate", "systemName"],
  },
  payment_success: {
    label: "Payment Done Thank You",
    emailKey: "payment_success_email" as const,
    whatsappKey: "payment_success_whatsapp" as const,
    placeholders: ["customerName", "bookingId", "paymentAmount", "systemName"],
  },
  return_reminder: {
    label: "Return Date Reminder",
    emailKey: "return_reminder_email" as const,
    whatsappKey: "return_reminder_whatsapp" as const,
    placeholders: ["customerName", "bookingId", "scooterTitle", "returnDate", "systemName"],
  },
};

const DUMMY_CONTEXT = {
  customerName: "Savindu Senanayake",
  bookingId: "B-8839",
  scooterTitle: "Vespa Primavera 150",
  pickupDate: "Mon Jun 15 2026",
  returnDate: "Mon Jun 22 2026",
  totalAmount: "120.00",
  securityDeposit: "100.00",
  paymentAmount: "120.00",
  systemName: "Migga",
  paymentLink: "https://www.sandbox.paypal.com/checkoutnow?token=EC-8839",
};

export default function NotificationsPage() {
  const [templates, setTemplates] = useState<TemplatesState>(defaultTemplates);
  const [activeTab, setActiveTab] = useState<keyof typeof TAB_META>("new_booking");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Custom notification fields
  const [customChannel, setCustomChannel] = useState<"email" | "whatsapp">("email");
  const [customTo, setCustomTo] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customMessage, setCustomMessage] = useState("");

  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await api.get("/notifications/templates");
      if (res.data?.success && res.data?.data) {
        setTemplates(res.data.data);
      }
    } catch (e) {
      console.error(e);
      showToast("Failed to load templates", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch("/notifications/templates", templates);
      if (res.data?.success) {
        showToast("Templates saved successfully!");
      } else {
        showToast("Failed to save templates", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Error saving templates", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSendCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTo.trim() || !customMessage.trim()) {
      showToast("Please fill in receiver and message", "error");
      return;
    }

    setSending(true);
    try {
      const res = await api.post("/notifications/send-custom", {
        type: customChannel,
        to: customTo,
        subject: customChannel === "email" ? customSubject : undefined,
        message: customMessage,
      });

      if (res.data?.success) {
        showToast(`Manual ${customChannel} sent successfully!`);
        // Reset manual form except fields if needed
        setCustomTo("");
        setCustomSubject("");
        setCustomMessage("");
      } else {
        showToast("Failed to send notification", "error");
      }
    } catch (e: any) {
      console.error(e);
      showToast(e.response?.data?.message || "Error sending notification", "error");
    } finally {
      setSending(false);
    }
  };

  const handleQuickTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) return;

    const [key, channel] = val.split(":");
    if (channel === "email") {
      const t = templates[key as keyof TemplatesState];
      setCustomChannel("email");
      setCustomSubject(t.subject || "");
      setCustomMessage(t.body);
    } else {
      const t = templates[key as keyof TemplatesState];
      setCustomChannel("whatsapp");
      setCustomSubject("");
      setCustomMessage(t.body);
    }
    // Reset selection dropdown
    e.target.value = "";
  };

  const insertPlaceholder = (key: keyof TemplatesState, field: "subject" | "body", placeholder: string) => {
    setTemplates((prev) => {
      const target = prev[key];
      if (field === "subject") {
        return {
          ...prev,
          [key]: {
            ...target,
            subject: (target.subject || "") + ` {{${placeholder}}}`,
          },
        };
      } else {
        return {
          ...prev,
          [key]: {
            ...target,
            body: target.body + ` {{${placeholder}}}`,
          },
        };
      }
    });
  };

  const renderCompiledPreview = (text: string) => {
    if (!text) return <span className="text-gray-400 italic">No content</span>;
    let compiled = text;
    Object.entries(DUMMY_CONTEXT).forEach(([key, val]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
      compiled = compiled.replace(regex, val);
    });
    return compiled.split("\n").map((line, i) => (
      <React.Fragment key={i}>
        {line}
        <br />
      </React.Fragment>
    ));
  };

  const activeMeta = TAB_META[activeTab];
  const activeEmail = templates[activeMeta.emailKey];
  const activeWhatsapp = templates[activeMeta.whatsappKey];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-[9999] flex items-center gap-3 px-5 py-3.5 rounded-xl border shadow-lg transition-all transform duration-300 translate-y-0 ${
            toast.type === "success"
              ? "bg-green-50 dark:bg-green-950/60 border-green-200 dark:border-green-900/60 text-green-700 dark:text-green-300"
              : "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300"
          }`}
        >
          {toast.type === "success" ? (
            <svg className="w-5 h-5 flex-shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          <span className="text-sm font-semibold">{toast.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Templates</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Customize system emails and WhatsApp notification templates, or send messages manually.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:bg-brand-400 text-white font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/25"
        >
          {saving ? (
            <>
              <svg className="animate-spin -ml-1 mr-1 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving Changes...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Save All Templates
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800 flex overflow-x-auto gap-2 no-scrollbar">
        {Object.entries(TAB_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as keyof typeof TAB_META)}
            className={`whitespace-nowrap px-4 py-3 border-b-2 font-medium text-sm transition-all focus:outline-none ${
              activeTab === key
                ? "border-brand-500 text-brand-500"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-700"
            }`}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl">
          <svg className="animate-spin h-8 w-8 text-brand-500 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading templates...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Editors */}
          <div className="lg:col-span-2 space-y-6">
            {/* Email Template Form */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs">
              <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800/60 mb-6">
                <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Email Channel Template</h3>
                  <p className="text-xs text-gray-400">Customizable subject and rich layout wrapper</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Email Subject
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={activeEmail?.subject || ""}
                      onChange={(e) =>
                        setTemplates((prev) => ({
                          ...prev,
                          [activeMeta.emailKey]: { ...prev[activeMeta.emailKey], subject: e.target.value },
                        }))
                      }
                      placeholder="e.g. Booking confirmed — {{bookingId}}"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-gray-950 focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 text-sm text-gray-950 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    Email Body Content
                  </label>
                  <textarea
                    rows={8}
                    value={activeEmail?.body || ""}
                    onChange={(e) =>
                      setTemplates((prev) => ({
                        ...prev,
                        [activeMeta.emailKey]: { ...prev[activeMeta.emailKey], body: e.target.value },
                      }))
                    }
                    placeholder="Enter template body (Markdown or plain text)"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-gray-950 focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 text-sm text-gray-950 dark:text-white font-mono leading-relaxed"
                  />
                </div>

                {/* Placeholders helper */}
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Available Placeholders (Click to insert)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeMeta.placeholders.map((p) => (
                      <button
                        key={p}
                        onClick={() => insertPlaceholder(activeMeta.emailKey, "body", p)}
                        className="px-2.5 py-1 rounded bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-xs font-mono text-gray-600 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 transition-colors"
                      >
                        {`{{${p}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* WhatsApp Template Form */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs">
              <div className="flex items-center gap-2.5 pb-4 border-b border-gray-100 dark:border-gray-800/60 mb-6">
                <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-950/60 text-green-600 dark:text-green-400 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">WhatsApp Channel Template</h3>
                  <p className="text-xs text-gray-400">Bold text (*text*) and emojis supported</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                    WhatsApp Message Body
                  </label>
                  <textarea
                    rows={6}
                    value={activeWhatsapp?.body || ""}
                    onChange={(e) =>
                      setTemplates((prev) => ({
                        ...prev,
                        [activeMeta.whatsappKey]: { ...prev[activeMeta.whatsappKey], body: e.target.value },
                      }))
                    }
                    placeholder="Enter WhatsApp message template"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-gray-950 focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 text-sm text-gray-950 dark:text-white font-mono leading-relaxed"
                  />
                </div>

                {/* Placeholders helper */}
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    Available Placeholders (Click to insert)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeMeta.placeholders.map((p) => (
                      <button
                        key={p}
                        onClick={() => insertPlaceholder(activeMeta.whatsappKey, "body", p)}
                        className="px-2.5 py-1 rounded bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-750 text-xs font-mono text-gray-600 dark:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 transition-colors"
                      >
                        {`{{${p}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar preview & manual dispatch */}
          <div className="space-y-6 lg:sticky lg:top-20 h-fit">
            {/* Live Preview Panel */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs">
              <h3 className="font-semibold text-gray-900 dark:text-white pb-3 border-b border-gray-100 dark:border-gray-800 mb-4 flex items-center justify-between">
                <span>Live Rendering Preview</span>
                <span className="text-[10px] bg-brand-500/10 text-brand-500 font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Demo Data
                </span>
              </h3>

              <div className="space-y-4">
                {/* Email preview */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                    Email Preview
                  </span>
                  <div className="rounded-xl border border-gray-100 dark:border-gray-800/80 p-4 bg-gray-50/50 dark:bg-gray-950/40 text-xs leading-relaxed max-h-60 overflow-y-auto">
                    <p className="font-bold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 pb-2 mb-2">
                      Subject: {renderCompiledPreview(activeEmail?.subject || "")}
                    </p>
                    <div className="text-gray-700 dark:text-gray-300 font-sans">
                      {renderCompiledPreview(activeEmail?.body || "")}
                    </div>
                  </div>
                </div>

                {/* WhatsApp preview */}
                <div className="space-y-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
                    WhatsApp Preview
                  </span>
                  <div className="rounded-xl border border-gray-100 dark:border-gray-800/80 p-4 bg-emerald-50/20 dark:bg-emerald-950/10 text-xs font-mono text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto leading-relaxed border-l-4 border-l-emerald-500">
                    {renderCompiledPreview(activeWhatsapp?.body || "")}
                  </div>
                </div>
              </div>
            </div>

            {/* Send Custom Notification */}
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-theme-xs">
              <div className="pb-3 border-b border-gray-100 dark:border-gray-800 mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">Send Custom Notification</h3>
                <p className="text-xs text-gray-400 mt-0.5">Send a quick ad-hoc message manually</p>
              </div>

              <form onSubmit={handleSendCustom} className="space-y-4">
                {/* Quick Templates Selector */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Insert Quick Template
                  </label>
                  <select
                    onChange={handleQuickTemplateSelect}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-gray-950 text-xs text-gray-800 dark:text-gray-200 focus:ring-1 focus:ring-brand-500 focus:border-brand-500"
                  >
                    <option value="">-- Select Template to Copy --</option>
                    <option value="new_booking_email:email">New Booking (Email)</option>
                    <option value="new_booking_whatsapp:whatsapp">New Booking (WhatsApp)</option>
                    <option value="confirm_email:email">Booking Confirmed (Email)</option>
                    <option value="confirm_whatsapp:whatsapp">Booking Confirmed (WhatsApp)</option>
                    <option value="payment_success_email:email">Payment Done (Email)</option>
                    <option value="payment_success_whatsapp:whatsapp">Payment Done (WhatsApp)</option>
                    <option value="return_reminder_email:email">Return Reminder (Email)</option>
                    <option value="return_reminder_whatsapp:whatsapp">Return Reminder (WhatsApp)</option>
                  </select>
                </div>

                {/* Channel Switch */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Channel
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-950 p-1 rounded-xl border border-gray-150 dark:border-gray-850">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomChannel("email");
                        setCustomTo("");
                      }}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        customChannel === "email"
                          ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      Email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomChannel("whatsapp");
                        setCustomTo("");
                      }}
                      className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        customChannel === "whatsapp"
                          ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      WhatsApp
                    </button>
                  </div>
                </div>

                {/* Destination */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    {customChannel === "email" ? "Email Address" : "Phone Number (WhatsApp)"}
                  </label>
                  <input
                    type={customChannel === "email" ? "email" : "text"}
                    required
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    placeholder={customChannel === "email" ? "customer@example.com" : "e.g. +94771234567"}
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-gray-950 text-xs focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 text-gray-950 dark:text-white"
                  />
                </div>

                {/* Email Subject (if email) */}
                {customChannel === "email" && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                      Subject
                    </label>
                    <input
                      type="text"
                      required
                      value={customSubject}
                      onChange={(e) => setCustomSubject(e.target.value)}
                      placeholder="Enter email subject"
                      className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-gray-950 text-xs focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 text-gray-950 dark:text-white"
                    />
                  </div>
                )}

                {/* Message Body */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Message Body
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Enter manual message content"
                    className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-800 dark:bg-gray-950 text-xs focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 text-gray-950 dark:text-white font-mono leading-relaxed"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={sending}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-850 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 disabled:opacity-50 text-white text-xs font-semibold shadow transition-all focus:outline-none"
                >
                  {sending ? (
                    <>
                      <svg className="animate-spin h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Dispatch Notification
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
