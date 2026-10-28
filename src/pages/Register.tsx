
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submitting) return;

    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 12) {
      setError(
        "Password must contain at least 12 characters."
      );
      return;
    }

    setSubmitting(true);

    try {
      await register(
        name.trim(),
        email.trim(),
        password
      );

      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="p-12 text-center">
        Checking session...
      </main>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="mx-auto max-w-md px-6 py-14">
      <h1 className="text-3xl font-bold">
        Create Account
      </h1>

      <p className="mt-2 text-gray-600">
        Join EventHub to manage your bookings.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-5 rounded-xl border bg-white p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="registerName"
            className="block text-sm font-semibold"
          >
            Full Name
          </label>

          <input
            id="registerName"
            type="text"
            required
            maxLength={100}
            autoComplete="name"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            className="mt-2 w-full rounded-lg border px-4 py-3"
            placeholder="Your full name"
          />
        </div>

        <div>
          <label
            htmlFor="registerEmail"
            className="block text-sm font-semibold"
          >
            Email Address
          </label>

          <input
            id="registerEmail"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            className="mt-2 w-full rounded-lg border px-4 py-3"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="registerPassword"
            className="block text-sm font-semibold"
          >
            Password
          </label>

          <input
            id="registerPassword"
            type="password"
            required
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            className="mt-2 w-full rounded-lg border px-4 py-3"
            placeholder="At least 12 characters"
          />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-semibold"
          >
            Confirm Password
          </label>

          <input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            className="mt-2 w-full rounded-lg border px-4 py-3"
            placeholder="Confirm your password"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {submitting
            ? "Creating Account..."
            : "Create Account"}
        </button>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-semibold text-purple-700 hover:underline"
          >
            Sign In
          </Link>
        </p>
      </form>
    </main>
  );
}
