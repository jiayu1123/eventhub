import { Link } from "react-router-dom";
import type { Event } from "../types/event";

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 p-5 shadow-sm transition hover:shadow-md">
      <div>
        <span className="text-sm font-medium text-purple-600">
          {event.category}
        </span>

        <h2 className="mt-2 text-xl font-bold">{event.title}</h2>

        <p className="mt-2 text-gray-600">{event.location}</p>
        <p className="text-gray-600">{event.date}</p>
      </div>

      <div className="mt-auto pt-3">
        <p className="font-semibold text-purple-600">
          From ${event.price}
        </p>

        <Link
          to={`/events/${event.id}`}
          className="mt-4 inline-block rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
        >
          View Tickets
        </Link>
      </div>
    </div>
  );
}
