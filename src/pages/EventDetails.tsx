
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SeatMap from "../components/SeatMap";
import { fetchEventById } from "../api/events";
import type { Event } from "../types/event";

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadEvent() {
      setLoading(true);
      setError(null);
      setEvent(null);

      try {
        const eventId = Number(id);

        if (!id || !Number.isInteger(eventId) || eventId <= 0) {
          throw new Error("Invalid event ID");
        }

        const data = await fetchEventById(eventId);

        if (active) {
          setEvent(data);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load event"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadEvent();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="p-10 text-center">
        <p>Loading event details...</p>
      </main>
    );
  }

  if (error || !event) {
    return (
      <main className="p-10 text-center">
        <h1 className="text-2xl font-bold">
          Unable to load event
        </h1>
        <p className="mt-2 text-red-600">
          {error || "Event not found"}
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-purple-600"
        >
          Back to Events
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <Link
          to="/"
          className="text-purple-600 hover:underline"
        >
          ← Back to Events
        </Link>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <span className="font-medium text-purple-600">
            {event.category}
          </span>

          <h1 className="mt-3 text-4xl font-bold">
            {event.title}
          </h1>

          <p className="mt-5 text-gray-600">
            Location: {event.location}
          </p>

          <p className="mt-2 text-gray-600">
            Date: {event.date}
          </p>

          <p className="mt-6 text-2xl font-bold text-purple-600">
            Tickets from ${event.price}
          </p>
        </div>

        <SeatMap
          basePrice={event.price}
          eventId={event.id}
        />
      </div>
    </main>
  );
}
