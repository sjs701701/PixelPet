import { request } from "./client";

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

/** Dev-only: instant match against a bot */
export async function queueBattleDev(token: string, petId: string) {
  return request<{ matched: boolean; battleId?: string; battle?: any }>(
    "/battle/queue-dev",
    {
      method: "POST",
      body: JSON.stringify({ petId }),
    },
    token,
  );
}

export async function getBattleDetails(token: string, battleId: string) {
  return request<any>(`/battle/${battleId}`, undefined, token);
}

export async function submitBattleAction(
  token: string,
  battleId: string,
  action: "attack" | "guard" | "skill",
) {
  return request<any>(
    `/battle/${battleId}/action`,
    {
      method: "POST",
      body: JSON.stringify({ action }),
    },
    token,
  );
}
