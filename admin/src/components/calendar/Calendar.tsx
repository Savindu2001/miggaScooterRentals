"use client";
import React, { useState, useRef, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  EventInput,
  EventClickArg,
  EventContentArg,
} from "@fullcalendar/core";
import { useModal } from "@/hooks/useModal";
import { Modal } from "@/components/ui/modal";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface CalendarEvent extends EventInput {
  extendedProps: {
    calendar: string;
    bookingId: string;
    customerName: string;
    email: string;
    phone: string;
    nationality: string;
    passportNumber: string;
    scooterName: string;
    pickupDate: string;
    returnDate: string;
    totalAmount: number;
    securityDeposit: number;
    bookingStatus: string;
    paymentMethod?: string;
  };
}

const Calendar: React.FC = () => {
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const calendarRef = useRef<FullCalendar>(null);
  const { isOpen, openModal, closeModal } = useModal();

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings', { params: { limit: 500 } });
      const bookingsData = res.data?.data ?? res.data;
      const bookings = Array.isArray(bookingsData) ? bookingsData : bookingsData?.data ?? [];

      const calendarEvents = bookings.map((b: any) => {
        let colorType = "Warning"; // default PENDING
        if (b.bookingStatus === 'CONFIRMED') colorType = "Success";
        else if (b.bookingStatus === 'PICKED_UP') colorType = "Primary";
        else if (b.bookingStatus === 'RETURNED') colorType = "Success";
        else if (b.bookingStatus === 'CANCELLED') colorType = "Danger";
        else if (b.bookingStatus === 'AWAITING_PAYMENT') colorType = "Danger";

        // FullCalendar end date is exclusive. Add 1 day to returnDate to display it properly.
        const endObj = new Date(b.returnDate);
        endObj.setDate(endObj.getDate() + 1);
        const endStr = endObj.toISOString().split('T')[0];

        return {
          id: b.id,
          title: `${b.bookingId} - ${b.customerName}`,
          start: b.pickupDate.split('T')[0],
          end: endStr,
          allDay: true,
          extendedProps: {
            calendar: colorType,
            bookingId: b.bookingId,
            customerName: b.customerName,
            email: b.email,
            phone: b.phone,
            nationality: b.nationality,
            passportNumber: b.passportNumber,
            scooterName: b.scooter ? `${b.scooter.brand} ${b.scooter.model}` : 'N/A',
            pickupDate: b.pickupDate.split('T')[0],
            returnDate: b.returnDate.split('T')[0],
            totalAmount: Number(b.totalAmount),
            securityDeposit: Number(b.securityDeposit),
            bookingStatus: b.bookingStatus,
            paymentMethod: b.paymentMethod,
          }
        };
      });
      setEvents(calendarEvents);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load booking events for the calendar.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleEventClick = (clickInfo: EventClickArg) => {
    const event = clickInfo.event;
    setSelectedEvent(event as unknown as CalendarEvent);
    openModal();
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
        </div>
      ) : (
        <div className="custom-calendar">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            events={events}
            selectable={false}
            eventClick={handleEventClick}
            eventContent={renderEventContent}
          />
        </div>
      )}

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        className="max-w-[600px] p-6 lg:p-8"
      >
        {selectedEvent && (
          <div className="flex flex-col px-2 overflow-y-auto custom-scrollbar">
            <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
              <h5 className="mb-1 font-semibold text-gray-800 dark:text-white/90 text-xl">
                Booking Details
              </h5>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium text-brand-500">
                {selectedEvent.extendedProps.bookingId}
              </p>
            </div>

            <div className="mt-6 space-y-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Renter Name</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">{selectedEvent.extendedProps.customerName}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Passport Number</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">{selectedEvent.extendedProps.passportNumber} ({selectedEvent.extendedProps.nationality})</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Phone</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">{selectedEvent.extendedProps.phone}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Email</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">{selectedEvent.extendedProps.email}</span>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 dark:border-gray-800" />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Scooter Model</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">{selectedEvent.extendedProps.scooterName}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Status</span>
                  <span className="font-medium text-gray-800 dark:text-white/90 uppercase">{selectedEvent.extendedProps.bookingStatus}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Pickup Date</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">{selectedEvent.extendedProps.pickupDate}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Return Date</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">{selectedEvent.extendedProps.returnDate}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Total Amount</span>
                  <span className="font-bold text-gray-900 dark:text-white">Rs. {Number(selectedEvent.extendedProps.totalAmount).toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Security Deposit</span>
                  <span className="font-medium text-gray-800 dark:text-white/90">Rs. {Number(selectedEvent.extendedProps.securityDeposit).toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs font-semibold uppercase text-gray-400">Payment Method</span>
                  <span className="font-medium text-gray-800 dark:text-white/90 uppercase">{selectedEvent.extendedProps.paymentMethod || 'CASH'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-8 modal-footer justify-end">
              <button
                onClick={closeModal}
                type="button"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]"
              >
                Close
              </button>
              <Link
                href={`/bookings?search=${selectedEvent.extendedProps.bookingId}`}
                onClick={closeModal}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 flex items-center justify-center"
              >
                Go to Booking Record
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

const renderEventContent = (eventInfo: EventContentArg) => {
  const colorClass = `fc-bg-${eventInfo.event.extendedProps.calendar.toLowerCase()}`;
  return (
    <div
      className={`event-fc-color flex fc-event-main ${colorClass} p-1.5 rounded-lg text-xs font-medium cursor-pointer shadow-sm`}
    >
      <div className="fc-daygrid-event-dot"></div>
      <div className="fc-event-title truncate">{eventInfo.event.title}</div>
    </div>
  );
};

export default Calendar;
