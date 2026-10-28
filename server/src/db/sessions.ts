
import { createHash, randomBytes } from "node:crypto";
import { db } from "./database.js";

export const SESSION_DURATION_MS =
  7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function createSession(userId: string): string {
  const token = randomBytes(32).toString("hex");
  const sessionId = hashToken(token);

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + SESSION_DURATION_MS
  );

  db.prepare(`
    INSERT INTO sessions (
      session_id,
      user_id,
      expires_at,
      created_at
    )
    VALUES (?, ?, ?, ?)
  `).run(
    sessionId,
    userId,
    expiresAt.toISOString(),
    now.toISOString()
  );

  return token;
}

export function getSessionUser(token: string) {
  const sessionId = hashToken(token);

  const row = db.prepare(`
    SELECT
      users.user_id,
      users.name,
      users.email,
      users.created_at
    FROM sessions
    JOIN users
      ON users.user_id = sessions.user_id
    WHERE sessions.session_id = ?
      AND sessions.expires_at > ?
  `).get(
    sessionId,
    new Date().toISOString()
  ) as unknown as {
    user_id: string;
    name: string;
    email: string;
    created_at: string;
  } | undefined;

  if (!row) return null;

  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

export function deleteSession(token: string): void {
  db.prepare(`
    DELETE FROM sessions
    WHERE session_id = ?
  `).run(hashToken(token));
}
