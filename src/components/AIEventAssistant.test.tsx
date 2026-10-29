import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import AIEventAssistant from "./AIEventAssistant";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);

  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAssistant() {
  return render(
    <MemoryRouter>
      <AIEventAssistant />
    </MemoryRouter>
  );
}

function mockCsrfResponse() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      token: "test-csrf-token",
      headerName: "X-XSRF-TOKEN",
    }),
  });
}

test("shows welcome message and disables empty submission", () => {
  renderAssistant();

  expect(
    screen.getByText(/Hi! Tell me what kind of events/i)
  ).toBeInTheDocument();

  expect(
    screen.getByRole("button", { name: "Send" })
  ).toBeDisabled();

  expect(mockFetch).not.toHaveBeenCalled();
});

test("shows loading state while searching", async () => {
  const user = userEvent.setup();

  mockCsrfResponse();

  mockFetch.mockImplementationOnce(
    () => new Promise(() => {})
  );

  renderAssistant();

  await user.type(
    screen.getByRole("textbox", {
      name: "Describe the events you want to find",
    }),
    "Find events in Boston"
  );

  await user.click(
    screen.getByRole("button", { name: "Send" })
  );

  expect(
    await screen.findByText("Searching events...")
  ).toBeInTheDocument();

  expect(
    screen.getByRole("button", { name: "Searching..." })
  ).toBeDisabled();
});

test("displays matching events with correct details link", async () => {
  const user = userEvent.setup();

  mockCsrfResponse();

  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      totalResults: 1,
      events: [
        {
          id: 2,
          title: "Live Music Night",
          city: "Boston",
          venue: "MGM Music Hall",
          startsAt: "2026-11-21T01:00:00Z",
          priceCents: 6500,
        },
      ],
    }),
  });

  renderAssistant();

  await user.type(
    screen.getByRole("textbox", {
      name: "Describe the events you want to find",
    }),
    "Find events in Boston under $100"
  );

  await user.click(
    screen.getByRole("button", { name: "Send" })
  );

  expect(
    await screen.findByText("Live Music Night")
  ).toBeInTheDocument();

  expect(
    screen.getByText("MGM Music Hall, Boston")
  ).toBeInTheDocument();

  expect(
    screen.getByText("$65.00")
  ).toBeInTheDocument();

  expect(
    screen.getByRole("link", {
      name: "View Event Details",
    })
  ).toHaveAttribute("href", "/events/2");

  await waitFor(() => {
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/ai/events/search",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "X-XSRF-TOKEN": "test-csrf-token",
        }),
        body: JSON.stringify({
          message: "Find events in Boston under $100",
        }),
      })
    );
  });
});

test("shows helpful message when no events match", async () => {
  const user = userEvent.setup();

  mockCsrfResponse();

  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({
      totalResults: 0,
      events: [],
    }),
  });

  renderAssistant();

  await user.type(
    screen.getByRole("textbox", {
      name: "Describe the events you want to find",
    }),
    "Find events in Chicago"
  );

  await user.click(
    screen.getByRole("button", { name: "Send" })
  );

  expect(
    await screen.findByText(/couldn't find any matching events/i)
  ).toBeInTheDocument();
});

test("shows login message when AI API returns 401", async () => {
  const user = userEvent.setup();

  mockCsrfResponse();

  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
  });

  renderAssistant();

  await user.type(
    screen.getByRole("textbox", {
      name: "Describe the events you want to find",
    }),
    "Find Boston events"
  );

  await user.click(
    screen.getByRole("button", { name: "Send" })
  );

  expect(
    await screen.findByText(
      "Please log in to use AI Event Assistant."
    )
  ).toBeInTheDocument();
});
