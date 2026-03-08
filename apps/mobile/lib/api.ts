import { PetInstance, User } from "@pixel-pet-arena/shared";

const API_URL = "http://10.0.2.2:3001";

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${path}`);
  }

  return response.json();
}

export async function signIn(displayName: string, provider: "google" | "apple") {
  return request<{ user: User; accessToken: string }>("/auth/social", {
    method: "POST",
    body: JSON.stringify({ displayName, provider }),
  });
}

export async function rollInitialPet(token: string) {
  return request<PetInstance>(
    "/pets/roll-initial",
    {
      method: "POST",
    },
    token,
  );
}

export async function performCare(
  token: string,
  petId: string,
  action: "feed" | "clean" | "play" | "rest",
) {
  return request<PetInstance>(
    `/pets/${petId}/care`,
    {
      method: "POST",
      body: JSON.stringify({ action }),
    },
    token,
  );
}

export async function queueBattle(token: string, petId: string) {
  return request<{ matched: boolean; battleId?: string }>(
    "/battle/queue",
    {
      method: "POST",
      body: JSON.stringify({ petId }),
    },
    token,
  );
}
