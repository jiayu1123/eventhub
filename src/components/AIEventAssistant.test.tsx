import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import AIEventAssistant from "./AIEventAssistant";
import { searchBookingAgent } from "../api/aiBookingAgent";
import { createDraftFromProposal } from "../api/aiBookingDraft";

const navigateMock = vi.fn();

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("../api/aiBookingAgent", () => ({
  searchBookingAgent: vi.fn(),
}));

vi.mock("../api/aiBookingDraft", () => ({
  createDraftFromProposal: vi.fn(),
}));

const searchMock = vi.mocked(searchBookingAgent);
const draftMock = vi.mocked(createDraftFromProposal);

const proposal = {
  eventId: 4,
  eventTitle: "Boston Live Music Night",
  seats: ["A1", "A2"],
  totalPriceCents: 13000,
};

beforeEach(() => {
  vi.clearAllMocks();
});

it("shows welcome message and disables empty submission", () => {
  render(<AIEventAssistant />);

  expect(
    screen.getByText(/Hi! I can help you find events/i)
  ).toBeInTheDocument();

  expect(
    screen.getByRole("button", { name: "Send" })
  ).toBeDisabled();
});

it("shows loading state while searching", async () => {
  searchMock.mockImplementation(
    () => new Promise(() => {})
  );

  render(<AIEventAssistant />);

  fireEvent.change(
    screen.getByRole("textbox"),
    { target: { value: "Find events in Boston" } }
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Send" })
  );

  expect(
    await screen.findByText(/AI is searching events/i)
  ).toBeInTheDocument();

  expect(
    screen.getByRole("button", { name: "Searching..." })
  ).toBeDisabled();
});

it("displays validated booking proposal", async () => {
  searchMock.mockResolvedValue({
    message: "I found two available adjacent seats.",
    toolsUsed: [
      "search_events",
      "get_available_seats",
      "propose_booking",
    ],
    proposal,
  });

  render(<AIEventAssistant />);

  fireEvent.change(
    screen.getByRole("textbox"),
    {
      target: {
        value: "Find two adjacent seats in Boston",
      },
    }
  );

  fireEvent.click(
    screen.getByRole("button", { name: "Send" })
  );

  expect(
    await screen.findByText("Boston Live Music Night")
  ).toBeInTheDocument();

  expect(screen.getByText("A1")).toBeInTheDocument();
  expect(screen.getByText("A2")).toBeInTheDocument();
  expect(screen.getByText("$130.00")).toBeInTheDocument();

  expect(
    screen.getByRole("button", { name: "Review Booking" })
  ).toBeInTheDocument();
});

it("does not show booking button when proposal is null", async () => {
  searchMock.mockResolvedValue({
    message: "I couldn't find matching events.",
    toolsUsed: ["search_events"],
    proposal: null,
  });

  render(<AIEventAssistant />);

  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Find events in Chicago" },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Send" })
  );

  expect(
    await screen.findByText(/couldn't find matching events/i)
  ).toBeInTheDocument();

  expect(
    screen.queryByRole("button", { name: "Review Booking" })
  ).not.toBeInTheDocument();
});

it("shows login message when AI API returns 401", async () => {
  searchMock.mockRejectedValue(
    new Error("Please log in to use the AI Booking Agent.")
  );

  render(<AIEventAssistant />);

  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Find Boston events" },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Send" })
  );

  expect(
    await screen.findByText(
      "Please log in to use the AI Booking Agent."
    )
  ).toBeInTheDocument();
});

it("navigates to checkout after reviewing proposal", async () => {
  searchMock.mockResolvedValue({
    message: "Two adjacent seats are available.",
    toolsUsed: ["propose_booking"],
    proposal,
  });

  draftMock.mockResolvedValue({
    eventId: 4,
    seats: [
      { id: "A1", price: 65 },
      { id: "A2", price: 65 },
    ],
  });

  render(<AIEventAssistant />);

  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Find two adjacent seats" },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Send" })
  );

  const reviewButton = await screen.findByRole(
    "button",
    { name: "Review Booking" }
  );

  expect(navigateMock).not.toHaveBeenCalled();
  expect(draftMock).not.toHaveBeenCalled();

  fireEvent.click(reviewButton);

  await waitFor(() => {
    expect(navigateMock).toHaveBeenCalledWith(
      "/checkout",
      {
        state: {
          draft: {
            eventId: 4,
            seats: [
              { id: "A1", price: 65 },
              { id: "A2", price: 65 },
            ],
          },
        },
      }
    );
  });
});

it("does not navigate when recommended seats are unavailable", async () => {
  searchMock.mockResolvedValue({
    message: "Here is a booking proposal.",
    toolsUsed: ["propose_booking"],
    proposal,
  });

  draftMock.mockRejectedValue(
    new Error("One or more recommended seats are no longer available.")
  );

  render(<AIEventAssistant />);

  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Find two seats" },
  });

  fireEvent.click(
    screen.getByRole("button", { name: "Send" })
  );

  fireEvent.click(
    await screen.findByRole("button", {
      name: "Review Booking",
    })
  );

  expect(
    await screen.findByRole("alert")
  ).toHaveTextContent(/no longer available/i);

  expect(navigateMock).not.toHaveBeenCalled();
});
