
const API_URL = "/api/auth";

export interface AuthUser {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

interface JavaAuthUser {
  id: number;
  email?: string;
}

interface CsrfResponse {
  headerName: string;
  token: string;
}

async function getCsrf(): Promise<CsrfResponse> {
  const response = await fetch(`${API_URL}/csrf`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to obtain CSRF token.");
  }

  return response.json();
}

async function postWithCsrf<T>(
  path: string,
  body?: unknown
): Promise<T> {
  const csrf = await getCsrf();

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      [csrf.headerName]: csrf.token,
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    ...(body === undefined
      ? {}
      : { body: JSON.stringify(body) }),
  });

  if (!response.ok) {
    throw new Error(
      `Authentication request failed (${response.status}).`
    );
  }

  return response.json();
}

function toAuthUser(user: JavaAuthUser): AuthUser {
  return {
    userId: String(user.id),
    name: user.email?.split("@")[0] ?? "User",
    email: user.email ?? "",
    createdAt: "",
  };
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthUser> {
  const result = await postWithCsrf<JavaAuthUser>(
    "/login",
    { email, password }
  );

  return toAuthUser(result);
}

export async function registerUser(
  _name: string,
  email: string,
  password: string
): Promise<AuthUser> {
  // The Java backend currently registers users with email and password.
  // Preserve the name parameter for compatibility with the UI.
  void _name;

  const result = await postWithCsrf<JavaAuthUser>(
    "/register",
    { email, password }
  );

  return toAuthUser(result);
}

export async function getCurrentUser():
  Promise<AuthUser | null> {
  const response = await fetch(`${API_URL}/me`, {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to restore session.");
  }

  const result: JavaAuthUser = await response.json();

  return toAuthUser(result);
}

export async function logoutUser(): Promise<void> {
  await postWithCsrf<{ message: string }>("/logout");
}

export async function updateProfileName(
  _name: string
): Promise<AuthUser> {
  void _name;

  throw new Error(
    "Profile updates are not yet supported by the Java backend."
  );
}

export async function changePassword(
  _currentPassword: string,
  _newPassword: string
): Promise<void> {
  void _currentPassword;
  void _newPassword;

  throw new Error(
    "Password changes are not yet supported by the Java backend."
  );
}
