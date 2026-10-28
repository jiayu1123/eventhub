
import { randomUUID } from "node:crypto";
import { db } from "./database.js";

export interface User {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface UserRow {
  user_id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export function findUserByEmail(
  email: string
): UserRow | null {
  const row = db.prepare(`
    SELECT *
    FROM users
    WHERE email = ? COLLATE NOCASE
  `).get(email) as unknown as UserRow | undefined;

  return row ?? null;
}

export function createUser(
  name: string,
  email: string,
  passwordHash: string
): User {
  const user: User = {
    userId: randomUUID(),
    name,
    email,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO users (
      user_id,
      name,
      email,
      password_hash,
      created_at
    )
    VALUES (?, ?, ?, ?, ?)
  `).run(
    user.userId,
    user.name,
    user.email,
    passwordHash,
    user.createdAt
  );

  return user;
}

export function updateUserName(
  userId: string,
  name: string
): boolean {
  const result = db
    .prepare(
      "UPDATE users SET name = ? WHERE user_id = ?"
    )
    .run(name, userId);

  return result.changes > 0;
}

export function updateUserPassword(
  userId: string,
  passwordHash: string
): boolean {
  const result = db.prepare(`
    UPDATE users
    SET password_hash = ?
    WHERE user_id = ?
  `).run(passwordHash, userId);

  return result.changes > 0;
}

