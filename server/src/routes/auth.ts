
import { Router } from "express";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  createUser,
  findUserByEmail,
  updateUserName,
  updateUserPassword,
} from "../db/users.js";
import {
  createSession,
  deleteSession,
  getSessionUser,
  SESSION_DURATION_MS,
} from "../db/sessions.js";

const router = Router();
const scrypt = promisify(scryptCallback);

const COOKIE_NAME = "eventhub_session";

function readSessionCookie(
  cookieHeader: string | undefined
): string | null {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) =>
      part.startsWith(`${COOKIE_NAME}=`)
    );

  if (!cookie) return null;

  const token = cookie.slice(
    COOKIE_NAME.length + 1
  );

  return /^[a-f0-9]{64}$/.test(token)
    ? token
    : null;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 100 ||
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
    email.trim().length > 254 ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  ) {
    res.status(400).json({
      success: false,
      message:
        "Provide a valid name, email, and password of 12–128 characters.",
    });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    if (findUserByEmail(normalizedEmail)) {
      res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
      return;
    }

    const salt = randomBytes(16).toString("hex");

    const derivedKey = (await scrypt(
      password,
      salt,
      64
    )) as Buffer;

    const passwordHash =
      `${salt}:${derivedKey.toString("hex")}`;

    const user = createUser(
      name.trim(),
      normalizedEmail,
      passwordHash
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: user,
    });
  } catch (error) {
    console.error("Registration failed:", error);

    if (
      error instanceof Error &&
      /UNIQUE constraint failed/i.test(error.message)
    ) {
      res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
    return;
  }

  try {
    const user = findUserByEmail(
      email.trim().toLowerCase()
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const [salt, storedHash] =
      user.password_hash.split(":");

    if (
      !salt ||
      !storedHash ||
      !/^[a-f0-9]{32}$/.test(salt) ||
      !/^[a-f0-9]{128}$/.test(storedHash)
    ) {
      throw new Error("Invalid stored password hash");
    }

    const derivedKey = (await scrypt(
      password,
      salt,
      64
    )) as Buffer;

    const storedBuffer = Buffer.from(
      storedHash,
      "hex"
    );

    const validPassword = timingSafeEqual(
      derivedKey,
      storedBuffer
    );

    if (!validPassword) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
      return;
    }

    const token = createSession(user.user_id);

    res.cookie(
      COOKIE_NAME,
      token,
      {
        ...cookieOptions(),
        maxAge: SESSION_DURATION_MS,
      }
    );

    res.json({
      success: true,
      message: "Login successful",
      data: {
        userId: user.user_id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Login failed:", error);

    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  const token = readSessionCookie(
    req.headers.cookie
  );

  const user = token
    ? getSessionUser(token)
    : null;

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
    return;
  }

  res.json({
    success: true,
    data: user,
  });
});

/**
 * PATCH /api/auth/me
 * Update the currently authenticated user's name.
 */
router.patch("/me", (req, res) => {
  const token = readSessionCookie(
    req.headers.cookie
  );

  const user = token
    ? getSessionUser(token)
    : null;

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
    return;
  }

  const { name } = req.body ?? {};

  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 80
  ) {
    res.status(400).json({
      success: false,
      message: "Name must be between 2 and 80 characters.",
    });
    return;
  }

  try {
    const updated = updateUserName(
      user.userId,
      name.trim()
    );

    if (!updated) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    // Read the updated user through the existing session.
    const updatedUser = getSessionUser(token!);

    if (!updatedUser) {
      res.status(401).json({
        success: false,
        message: "Session expired",
      });
      return;
    }

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Profile update failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
});

/**
 * PATCH /api/auth/password
 * Change password for the authenticated user.
 */
router.patch("/password", async (req, res) => {
  const token = readSessionCookie(
    req.headers.cookie
  );

  const sessionUser = token
    ? getSessionUser(token)
    : null;

  if (!sessionUser) {
    res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
    return;
  }

  const { currentPassword, newPassword } =
    req.body ?? {};

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    newPassword.length < 12 ||
    newPassword.length > 128
  ) {
    res.status(400).json({
      success: false,
      message:
        "Provide your current password and a new password of 12–128 characters.",
    });
    return;
  }

  if (currentPassword === newPassword) {
    res.status(400).json({
      success: false,
      message:
        "New password must be different from your current password.",
    });
    return;
  }

  try {
    const user = findUserByEmail(
      sessionUser.email
    );

    if (!user || user.user_id !== sessionUser.userId) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    const [salt, storedHash] =
      user.password_hash.split(":");

    if (
      !salt ||
      !storedHash ||
      !/^[a-f0-9]{32}$/.test(salt) ||
      !/^[a-f0-9]{128}$/.test(storedHash)
    ) {
      throw new Error("Invalid stored password hash");
    }

    const derivedKey = (await scrypt(
      currentPassword,
      salt,
      64
    )) as Buffer;

    const storedBuffer = Buffer.from(
      storedHash,
      "hex"
    );

    const validPassword = timingSafeEqual(
      derivedKey,
      storedBuffer
    );

    if (!validPassword) {
      res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
      return;
    }

    const newSalt = randomBytes(16).toString("hex");

    const newDerivedKey = (await scrypt(
      newPassword,
      newSalt,
      64
    )) as Buffer;

    const newPasswordHash =
      `${newSalt}:${newDerivedKey.toString("hex")}`;

    const updated = updateUserPassword(
      sessionUser.userId,
      newPasswordHash
    );

    if (!updated) {
      res.status(404).json({
        success: false,
        message: "User not found",
      });
      return;
    }

    res.json({
      success: true,
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Password change failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to change password.",
    });
  }
});


// POST /api/auth/logout
router.post("/logout", (req, res) => {
  const token = readSessionCookie(
    req.headers.cookie
  );

  if (token) {
    deleteSession(token);
  }

  res.clearCookie(
    COOKIE_NAME,
    cookieOptions()
  );

  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

export default router;
