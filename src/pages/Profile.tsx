
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { changePassword } from "../api/auth";
import { useAuth } from "../context/AuthContext";

function formatMemberSince(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Profile() {
  const {
    user,
    loading,
    updateProfile,
  } = useAuth();

  // Edit Profile states
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  // Change Password states
  const [
    changingPassword,
    setChangingPassword,
  ] = useState(false);

  const [
    currentPassword,
    setCurrentPassword,
  ] = useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [
    passwordSaving,
    setPasswordSaving,
  ] = useState(false);

  const [
    passwordError,
    setPasswordError,
  ] = useState("");

  const [
    passwordSuccess,
    setPasswordSuccess,
  ] = useState("");

  useEffect(() => {
    setName(user?.name ?? "");
  }, [user?.name]);

  // Start editing profile
  function startEditing() {
    if (!user) return;

    setName(user.name);
    setError("");
    setSuccessMessage("");
    setEditing(true);
  }

  // Cancel editing profile
  function cancelEditing() {
    setName(user?.name ?? "");
    setError("");
    setEditing(false);
  }

  // Save updated profile
  async function handleSave(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user || saving) return;

    const trimmedName = name.trim();

    if (
      trimmedName.length < 2 ||
      trimmedName.length > 80
    ) {
      setError(
        "Name must be between 2 and 80 characters."
      );
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      await updateProfile(trimmedName);

      setEditing(false);

      setSuccessMessage(
        "Your profile has been updated successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update profile."
      );
    } finally {
      setSaving(false);
    }
  }

  // Start changing password
  function startChangingPassword() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
    setChangingPassword(true);
  }

  // Cancel changing password
  function cancelChangingPassword() {
    if (passwordSaving) return;

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setChangingPassword(false);
  }

  // Submit password change
  async function handlePasswordChange(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user || passwordSaving) return;

    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError(
        "Please enter your current password."
      );
      return;
    }

    if (
      newPassword.length < 12 ||
      newPassword.length > 128
    ) {
      setPasswordError(
        "New password must be between 12 and 128 characters."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        "New passwords do not match."
      );
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        "New password must be different from your current password."
      );
      return;
    }

    setPasswordSaving(true);

    try {
      await changePassword(
        currentPassword,
        newPassword
      );

      // Clear sensitive inputs after success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setChangingPassword(false);

      setPasswordSuccess(
        "Your password has been changed successfully."
      );
    } catch (err) {
      setPasswordError(
        err instanceof Error
          ? err.message
          : "Failed to change password."
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-gray-600">
          Loading your profile...
        </p>
      </main>
    );
  }

  // Authentication required
  if (!user) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-3xl font-bold">
            Login Required
          </h1>

          <p className="mt-4 text-gray-600">
            Please log in to view your profile.
          </p>

          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white hover:bg-purple-700"
          >
            Log In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          My Profile
        </h1>

        <p className="mt-2 text-gray-600">
          View and manage your EventHub account.
        </p>
      </div>

      {/* Profile Success Message */}
      {successMessage && (
        <div
          role="status"
          className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700"
        >
          {successMessage}
        </div>
      )}

      {/* Profile Error Message */}
      {error && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
        >
          {error}
        </div>
      )}

      {/* Profile Information */}
      <section className="rounded-2xl border bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-purple-100 text-2xl font-bold text-purple-700">
              {user.name.charAt(0).toUpperCase()}
            </div>

            <div>
              <h2 className="text-xl font-bold">
                {user.name}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                EventHub Member
              </p>
            </div>
          </div>

          {!editing && (
            <button
              type="button"
              onClick={startEditing}
              className="rounded-lg bg-purple-600 px-5 py-2 font-semibold text-white hover:bg-purple-700"
            >
              Edit Profile
            </button>
          )}
        </div>

        <div className="mt-6 space-y-6">
          {/* Full Name */}
          <div>
            <p className="text-sm font-semibold text-gray-500">
              FULL NAME
            </p>

            {editing ? (
              <form
                onSubmit={handleSave}
                className="mt-3 space-y-4"
              >
                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  minLength={2}
                  maxLength={80}
                  required
                  autoFocus
                  disabled={saving}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
                />

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                  >
                    {saving
                      ? "Saving..."
                      : "Save Changes"}
                  </button>

                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving}
                    className="rounded-lg border px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p className="mt-2 text-lg">
                {user.name}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="border-t pt-6">
            <p className="text-sm font-semibold text-gray-500">
              EMAIL ADDRESS
            </p>

            <p className="mt-2 break-all text-lg">
              {user.email}
            </p>
          </div>

          {/* Member Since */}
          <div className="border-t pt-6">
            <p className="text-sm font-semibold text-gray-500">
              MEMBER SINCE
            </p>

            <p className="mt-2 text-lg">
              {formatMemberSince(user.createdAt)}
            </p>
          </div>
        </div>
      </section>

      {/* Account Security */}
      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              Account Security
            </h2>

            <p className="mt-2 text-gray-600">
              Manage your account password.
            </p>
          </div>

          {!changingPassword && (
            <button
              type="button"
              onClick={startChangingPassword}
              className="rounded-lg bg-purple-600 px-5 py-2 font-semibold text-white hover:bg-purple-700"
            >
              Change Password
            </button>
          )}
        </div>

        {/* Password Success */}
        {passwordSuccess && (
          <div
            role="status"
            className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700"
          >
            {passwordSuccess}
          </div>
        )}

        {/* Password Error */}
        {passwordError && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700"
          >
            {passwordError}
          </div>
        )}

        {/* Change Password Form */}
        {changingPassword && (
          <form
            onSubmit={handlePasswordChange}
            className="mt-6 space-y-5"
          >
            {/* Current Password */}
            <div>
              <label
                htmlFor="currentPassword"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Current Password
              </label>

              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(
                    event.target.value
                  )
                }
                required
                disabled={passwordSaving}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
              />
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="newPassword"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                New Password
              </label>

              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(event.target.value)
                }
                minLength={12}
                maxLength={128}
                required
                disabled={passwordSaving}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
              />

              <p className="mt-2 text-sm text-gray-500">
                Must contain 12–128 characters.
              </p>
            </div>

            {/* Confirm New Password */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold text-gray-700"
              >
                Confirm New Password
              </label>

              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                minLength={12}
                maxLength={128}
                required
                disabled={passwordSaving}
                className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-purple-500"
              />
            </div>

            {/* Form Actions */}
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={passwordSaving}
                className="rounded-lg bg-purple-600 px-5 py-3 font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {passwordSaving
                  ? "Updating..."
                  : "Update Password"}
              </button>

              <button
                type="button"
                onClick={cancelChangingPassword}
                disabled={passwordSaving}
                className="rounded-lg border px-5 py-3 font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {/* My Bookings Link */}
      <div className="mt-6">
        <Link
          to="/bookings"
          className="font-semibold text-purple-700 hover:underline"
        >
          View My Bookings →
        </Link>
      </div>
    </main>
  );
}
