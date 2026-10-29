import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

type SearchEvent = {
  id: number;
  title: string;
  city: string;
  venue: string;
  startsAt: string;
  priceCents: number;
};

type AiSearchResponse = {
  events: SearchEvent[];
  totalResults: number;
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  events?: SearchEvent[];
};

export default function AIEventAssistant() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: "assistant",
      text: "Hi! Tell me what kind of events you're looking for. For example: Find events in Boston under $100.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const query = input.trim();

    if (!query || loading) return;

    setInput("");
    setLoading(true);

    setMessages((previous) => [
      ...previous,
      {
        id: Date.now(),
        role: "user",
        text: query,
      },
    ]);

    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "include",
      });

      if (!csrfResponse.ok) {
        throw new Error("Unable to initialize secure request.");
      }

      const csrfData: {
        token: string;
        headerName: string;
      } = await csrfResponse.json();

      const response = await fetch("/api/ai/events/search", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          [csrfData.headerName]: csrfData.token,
        },
        body: JSON.stringify({ message: query }),
      });

      if (response.status === 401) {
        throw new Error("Please log in to use AI Event Assistant.");
      }

      if (!response.ok) {
        throw new Error("AI search failed. Please try again.");
      }

      const data: AiSearchResponse = await response.json();

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now() + 1,
          role: "assistant",
          text:
            data.totalResults === 0
              ? "I couldn't find any matching events. Try another city, date, or price range."
              : `I found ${data.totalResults} matching event${
                  data.totalResults === 1 ? "" : "s"
                } for you.`,
          events: data.events,
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

  return (
    <section className="rounded-2xl border border-purple-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900">
          AI Event Assistant
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Find events using natural language.
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
            <p className="text-sm leading-relaxed">{message.text}</p>

            {message.events && message.events.length > 0 && (
              <div className="mt-4 space-y-3">
                {message.events.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <h3 className="font-semibold text-gray-900">
                      {event.title}
                    </h3>

                    <p className="mt-1 text-sm text-gray-600">
                      {event.venue}, {event.city}
                    </p>

                    <p className="mt-1 text-sm text-gray-600">
                      {new Date(event.startsAt).toLocaleString()}
                    </p>

                    <p className="mt-2 font-semibold text-purple-700">
                      ${(event.priceCents / 100).toFixed(2)}
                    </p>

                    <Link
                      to={`/events/${event.id}`}
                      className="mt-3 inline-block text-sm font-semibold text-purple-700 hover:underline"
                    >
                      View Event Details
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <p className="text-sm text-gray-500">
            Searching events...
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Find events in Boston under $100..."
          aria-label="Describe the events you want to find"
          maxLength={2000}
          disabled={loading}
          className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
        />

        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-purple-700 px-5 py-3 font-semibold text-white hover:bg-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Searching..." : "Send"}
        </button>
      </form>
    </section>
  );
}
