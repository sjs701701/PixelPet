import { User } from "@pixel-pet-arena/shared";
import { request } from "./client";

export async function signIn(displayName: string, provider: "google" | "apple") {
  return request<{ user: User; accessToken: string }>("/auth/social", {
    method: "POST",
    body: JSON.stringify({ displayName, provider }),
  });
}

export async function signInDemo(displayName: string, installId: string) {
  return request<{ user: User; accessToken: string }>("/auth/demo", {
    method: "POST",
    body: JSON.stringify({ displayName, installId }),
  });
}
