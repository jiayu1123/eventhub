
const API_URL = "http://localhost:3001/api/auth";

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const result: ApiResponse<T> = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || "Authentication request failed."
    );
  }

  if (result.data === undefined) {
    throw new Error("Response data is missing.");
  }

  return result.data;
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthUser> {
  return request<AuthUser>("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerUser(
  name: string,
  email: string,
  password: string
): Promise<AuthUser> {
  return request<AuthUser>("/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function getCurrentUser():
  Promise<AuthUser | null> {
  try {
    return await request<AuthUser>("/me");
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  const response = await fetch(`${API_URL}/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to log out.");
  }
}

export async function updateProfileName(
  name: string
): Promise<AuthUser> {
  const response = await fetch(
    "http://localhost:3001/api/auth/me",
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    }
  );

  const result: {
    success: boolean;
    data?: AuthUser;
    message?: string;
  } = await response.json();

  if (!response.ok || !result.success || !result.data) {
    throw new Error(
      result.message || "Failed to update profile."
    );
  }

  return result.data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const response = await fetch(
    "http://localhost:3001/api/auth/password",
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    }
  );

  const result: {
    success: boolean;
    message?: string;
  } = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || "Failed to change password."
    );
  }
}
