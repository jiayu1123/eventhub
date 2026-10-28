
import type { Event } from "../types/event.js";

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
