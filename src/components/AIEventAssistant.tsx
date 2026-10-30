import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import {
  searchBookingAgent,
  type BookingProposal,
} from "../api/aiBookingAgent";
import { createDraftFromProposal } from "../api/aiBookingDraft";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  proposal?: BookingProposal | null;
};

export default function AIEventAssistant() {
  const navigate = useNavigate();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "assistant",
      text: "Hi! I can help you find events, check available seats, and prepare a booking proposal. Try asking: Find two adjacent seats for an event in Boston.",
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = input.trim();

    if (!query || loading || reviewing) return;

    setInput("");
    setLoading(true);
    setReviewError(null);

    setMessages((previous) => [
      ...previous,
      {
        id: Date.now(),
        role: "user",
        text: query,
      },
    ]);

    try {
      const data = await searchBookingAgent(query);

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: data.message,
          proposal: data.proposal,
        },
      ]);
    } catch (error) {
      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleReviewBooking(proposal: BookingProposal) {
    if (reviewing || loading) return;

    setReviewing(true);
    setReviewError(null);

    try {
      const draft = await createDraftFromProposal(proposal);

      navigate("/checkout", {
        state: { draft },
      });
    } catch (error) {
      setReviewError(
        error instanceof Error
          ? error.message
          : "Unable to prepare checkout. Please try again."
      );
    } finally {
      setReviewing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900">
          AI Booking Agent
        </h2>

        <p className="mt-1 text-sm text-gray-600">
          Find events, explore available seats, and prepare bookings using AI.
        </p>
      </div>

      <div
        aria-live="polite"
        className="mb-5 flex max-h-[420px] min-h-[220px] flex-col gap-4 overflow-y-auto rounded-xl bg-gray-50 p-4"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[90%] rounded-xl p-4 ${
              message.role === "user"
                ? "self-end bg-purple-700 text-white"
                : "self-start border border-gray-200 bg-white text-gray-800"
            }`}
          >
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {message.text}
            </p>

            {message.proposal && (
              <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-purple-700">
                  Booking Proposal
                </p>

                <h3 className="mt-2 text-lg font-bold text-gray-900">
                  {message.proposal.eventTitle}
                </h3>

                <p className="mt-3 text-sm text-gray-600">
                  Recommended Seats
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {message.proposal.seats.map((seat) => (
                    <span
                      key={seat}
                      className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-semibold text-purple-800"
                    >
                      {seat}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-purple-200 pt-4">
                  <span className="font-semibold text-gray-700">
                    Total
                  </span>

                  <span className="text-xl font-bold text-purple-800">
                    ${(message.proposal.totalPriceCents / 100).toFixed(2)}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={reviewing || loading}
                  onClick={() => {
                    void handleReviewBooking(message.proposal!);
                  }}
                  className="mt-4 w-full rounded-lg bg-purple-700 px-4 py-3 font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reviewing ? "Checking Seats..." : "Review Booking"}
                </button>

                <p className="mt-2 text-xs text-gray-500">
                  No booking has been created. Seats and prices will be
                  checked again before checkout.
                </p>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <p className="text-sm text-gray-500">
            AI is searching events and checking seats...
          </p>
        )}
      </div>

      {reviewError && (
        <p role="alert" className="mb-4 text-sm text-red-600">
          {reviewError}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Find two adjacent seats in Boston..."
          aria-label="Describe the events you want to find"
          maxLength={2000}
          disabled={loading || reviewing}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
        />

        <button
          type="submit"
          disabled={loading || reviewing || !input.trim()}
          className="rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Searching..." : "Send"}
        </button>
      </form>
    </section>
  );
}
