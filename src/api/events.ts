import type { Event, EventCategory } from "../types/event";

interface JavaEvent {
  id: number;
  title: string;
  city: string;
  venue: string;
  priceCents: number;
  startsAt: string;
}

function inferCategory(title: string): EventCategory {
  const value = title.toLowerCase();

  if (
    value.includes("celtics") ||
    value.includes("knicks") ||
    value.includes("basketball") ||
    value.includes("sports")
  ) {
    return "Sports";
  }

  if (
    value.includes("festival")
  ) {
    return "Festival";
  }

  return "Concert";
}

function toFrontendEvent(event: JavaEvent): Event {
  return {
    id: event.id,
    title: event.title,
    location: `${event.venue}, ${event.city}`,
    date: new Date(event.startsAt).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    price: event.priceCents / 100,
    category: inferCategory(event.title),
  };
}

export async function fetchEvents(): Promise<Event[]> {
  const response = await fetch("/api/events");

  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }

  const data: JavaEvent[] = await response.json();

  return data.map(toFrontendEvent);
}

export async function fetchEventById(id: number): Promise<Event> {
  const response = await fetch(`/api/events/${id}`);

  if (!response.ok) {
    throw new Error("Failed to fetch event details");
  }

  const data: JavaEvent = await response.json();

  return toFrontendEvent(data);
}
