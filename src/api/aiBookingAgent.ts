export interface BookingProposal {
  eventId: number;
  eventTitle: string;
  seats: string[];
  totalPriceCents: number;
}

export interface AiBookingAgentResponse {
  message: string;
  toolsUsed: string[];
  proposal: BookingProposal | null;
}

interface CsrfResponse {
  headerName: string;
  token: string;
}

export class AiBookingAgentError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AiBookingAgentError";
    this.status = status;
  }
}

export async function searchBookingAgent(
  message: string
): Promise<AiBookingAgentResponse> {
  const query = message.trim();

  if (!query || query.length > 2000) {
    throw new AiBookingAgentError(
      "Please enter a message between 1 and 2000 characters.",
      400
    );
  }

  const csrfResponse = await fetch("/api/auth/csrf", {
    credentials: "include",
  });

  if (!csrfResponse.ok) {
    throw new AiBookingAgentError(
      "Unable to initialize secure request.",
      csrfResponse.status
    );
  }

  const csrf: CsrfResponse = await csrfResponse.json();

  const response = await fetch("/api/ai/booking-agent", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      [csrf.headerName]: csrf.token,
    },
    body: JSON.stringify({ message: query }),
  });

  if (response.status === 401 || response.status === 403) {
    throw new AiBookingAgentError(
      "Please log in to use the AI Booking Agent.",
      response.status
    );
  }

  if (!response.ok) {
    throw new AiBookingAgentError(
      "AI Booking Agent is temporarily unavailable. Please try again.",
      response.status
    );
  }

  return response.json() as Promise<AiBookingAgentResponse>;
}
