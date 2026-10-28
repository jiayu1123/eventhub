
import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { getSessionUser } from "../db/sessions.js";

export interface AuthenticatedUser {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface AuthenticatedRequest extends Request {
  authUser?: AuthenticatedUser;
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const cookieHeader = req.headers.cookie ?? "";

  const sessionCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) =>
      cookie.startsWith("eventhub_session=")
    );

  const token = sessionCookie
    ? sessionCookie.slice(
        "eventhub_session=".length
      )
    : "";

  if (!/^[a-f0-9]{64}$/.test(token)) {
    res.status(401).json({
      success: false,
      message: "Please log in to continue",
    });
    return;
  }

  const user = getSessionUser(token);

  if (!user) {
    res.status(401).json({
      success: false,
      message: "Session expired or invalid",
    });
    return;
  }

  req.authUser = user;
  next();
}
