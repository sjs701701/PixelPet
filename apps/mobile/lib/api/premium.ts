import { User } from "@pixel-pet-arena/shared";
import { request } from "./client";

export type PremiumStatusResponse = {
  premiumStatus: "free" | "premium";
  premiumSource: "dev-toggle" | "none";
  devModeEnabled: boolean;
  realVerificationAvailable: boolean;
};

export type PremiumToggleResponse = PremiumStatusResponse & {
  user: User;
};

export async function getPremiumStatus(token: string) {
  return request<PremiumStatusResponse>("/premium/status", undefined, token);
}

export async function togglePremiumDev(token: string, enabled: boolean) {
  return request<PremiumToggleResponse>(
    "/premium/dev/toggle",
    {
      method: "POST",
      body: JSON.stringify({ enabled }),
    },
    token,
  );
}
