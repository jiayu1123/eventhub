import type { Event } from "../types/event";

interface EventsResponse {
  success: boolean;
  count: number;
  data: Event[];
}

export async function fetchEvents(): Promise<Event[]> {
  const response = await fetch("http://localhost:3001/api/events");

  if (!response.ok) {
    throw new Error("Failed to fetch events");
  }

  const result: EventsResponse = await response.json();

  if (!result.success) {
    throw new Error("API returned an error");
  }

  return result.data;
}

export async function fetchEventById(id: number): Promise<Event> {
  const response = await fetch(
    `http://localhost:3001/api/events/${id}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch event details");
  }

  const result: {
    success: boolean;
    data: Event;
  } = await response.json();

  if (!result.success) {
    throw new Error("Event not found");
  }

  return result.data;
}