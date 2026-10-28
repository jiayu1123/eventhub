
import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  NavLink,
  useNavigate,
} from "react-router-dom";

import MyBookings from "./pages/MyBookings";
import Checkout from "./pages/Checkout";
import BookingConfirmation from "./pages/BookingConfirmation";
import EventDetails from "./pages/EventDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";

import EventCard from "./components/EventCard";
import { fetchEvents } from "./api/events";
import { useAuth } from "./context/AuthContext";

import type {
  Event,
  EventCategory,
} from "./types/event";

type CategoryFilter = "All" | EventCategory;

function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] =
    useState<CategoryFilter>("All");

  const [loading, setLoading] = useState(true);
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      try {
        const data = await fetchEvents();

        if (active) {
          setEvents(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load events"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadEvents();

    return () => {
      active = false;
    };
  }, []);

  const filteredEvents = events.filter((event) => {
    const query = search.trim().toLowerCase();

    const matchesSearch =
      event.title.toLowerCase().includes(query) ||
      event.location.toLowerCase().includes(query);

    const matchesCategory =
      category === "All" ||
      event.category === category;

    return matchesSearch && matchesCategory;
  });

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-4xl font-bold text-gray-900">
          EventHub
        </h1>

        <p className="mb-8 text-gray-600">
          Discover concerts, sports, and live events.
        </p>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row">
          <input
            type="text"
            placeholder="Search events or cities..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 outline-none focus:border-purple-500"
          />

          <select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value as CategoryFilter
              )
            }
            className="rounded-lg border border-gray-300 bg-white px-4 py-3"
          >
            <option value="All">
              All Categories
            </option>
            <option value="Concert">Concerts</option>
            <option value="Sports">Sports</option>
            <option value="Festival">Festivals</option>
          </select>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-600">
            Loading events...
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700"
          >
            <h2 className="font-semibold">
              Failed to load events
            </h2>

            <p className="mt-2">{error}</p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-600">
              Showing {filteredEvents.length} events
            </p>

            {filteredEvents.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-3">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center">
                <h2 className="text-xl font-semibold">
                  No events found
                </h2>

                <p className="mt-2 text-gray-500">
                  Try a different search or category.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function App() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      await logout();
      navigate("/", { replace: true });
    } catch (err) {
      setLogoutError(
        err instanceof Error
          ? err.message
          : "Failed to log out."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  const navClass = ({
    isActive,
  }: {
    isActive: boolean;
  }) =>
    `font-medium transition-colors ${
      isActive
        ? "text-purple-700"
        : "text-gray-600 hover:text-purple-700"
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global Navigation */}
      <header className="border-b border-gray-200 bg-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <NavLink
            to="/"
            className="text-2xl font-bold text-purple-700"
          >
            EventHub
          </NavLink>

          <div className="flex flex-wrap items-center gap-5">
            <NavLink
              to="/"
              end
              className={navClass}
            >
              Events
            </NavLink>

            <NavLink
              to="/bookings"
              className={navClass}
            >
              My Bookings
            </NavLink>

            {!loading &&
              (user ? (
                <>
                  {/* Profile Navigation */}
                  <NavLink
                    to="/profile"
                    className={navClass}
                  >
                    My Profile
                  </NavLink>

                  <span className="text-sm font-medium text-gray-700">
                    Hi, {user.name}
                  </span>

                  <button
                    type="button"
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    {loggingOut
                      ? "Logging out..."
                      : "Logout"}
                  </button>
                </>
              ) : (
                <>
                  <NavLink
                    to="/login"
                    className={navClass}
                  >
                    Login
                  </NavLink>

                  <NavLink
                    to="/register"
                    className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white hover:bg-purple-700"
                  >
                    Register
                  </NavLink>
                </>
              ))}
          </div>
        </nav>
      </header>

      {logoutError && (
        <div
          role="alert"
          className="mx-auto mt-4 max-w-5xl rounded-lg bg-red-50 p-4 text-red-700"
        >
          {logoutError}
        </div>
      )}

      {/* Application Routes */}
      <Routes>
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/events/:id"
          element={<EventDetails />}
        />

        <Route
          path="/checkout"
          element={<Checkout />}
        />

        <Route
          path="/confirmation"
          element={<BookingConfirmation />}
        />

        <Route
          path="/bookings"
          element={<MyBookings />}
        />

        {/* User Profile */}
        <Route
          path="/profile"
          element={<Profile />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />
      </Routes>
    </div>
  );
}

export default App;
