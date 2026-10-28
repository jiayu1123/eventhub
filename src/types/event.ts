export type EventCategory = "Concert" | "Sports" | "Festival";

export interface Event {
  id: number;
  title: string;
  location: string;
  date: string;
  price: number;
  category: EventCategory;
}