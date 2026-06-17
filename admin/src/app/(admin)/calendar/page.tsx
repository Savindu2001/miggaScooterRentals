"use client";
import React from "react";
import Calendar from "@/components/calendar/Calendar";

export default function CalendarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings Calendar</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Visualize, search and inspect active scooter rentals on the calendar grid.
        </p>
      </div>

      <Calendar />
    </div>
  );
}
