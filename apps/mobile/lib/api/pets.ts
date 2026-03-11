import { PetInstance } from "@pixel-pet-arena/shared";
import { request } from "./client";

export async function rollInitialPet(token: string, nickname?: string) {
  return request<PetInstance>(
    "/pets/roll-initial",
    {
      method: "POST",
      body: JSON.stringify({ nickname }),
    },
    token,
  );
}

export async function getMyPet(token: string) {
  return request<PetInstance | null>("/pets/me", undefined, token);
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

export async function revivePet(token: string, petId: string) {
  return request<PetInstance>(
    `/pets/${petId}/revive`,
    {
      method: "POST",
    },
    token,
  );
}

export async function acceptPetDeath(token: string, petId: string) {
  return request<{ accepted: boolean }>(
    `/pets/${petId}/accept-death`,
    {
      method: "POST",
    },
    token,
  );
}
