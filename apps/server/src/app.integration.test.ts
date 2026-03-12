import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

type DemoSession = {
  user: {
    id: string;
    displayName: string;
    installId?: string;
    premiumStatus: string;
  };
  accessToken: string;
};

type PetResponse = {
  id: string;
  ownerId: string;
  templateId: string;
  nickname?: string;
  level: number;
  experience: number;
  lifeState: string;
  freeRevivesRemaining: number;
  criticalSince?: string;
  diedAt?: string;
  careState: {
    hunger: number;
    mood: number;
    hygiene: number;
    energy: number;
    bond: number;
  };
};

const cleanupPaths = new Set<string>();

async function startTestServer(storeFile: string) {
  process.env.PIXELPET_STORE_FILE = storeFile;
  cleanupPaths.add(path.dirname(storeFile));

  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0);

  const address = app.getHttpServer().address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return { app, baseUrl };
}

async function stopTestServer(app?: INestApplication) {
  if (app) {
    await app.close();
  }
  delete process.env.PIXELPET_STORE_FILE;
}

async function requestJson<T>(
  baseUrl: string,
  pathName: string,
  init?: RequestInit,
) {
  const response = await fetch(`${baseUrl}${pathName}`, init);
  const text = await response.text();
  const body = (text ? JSON.parse(text) : null) as T | null;

  return { response, body };
}

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  for (const target of cleanupPaths) {
    fs.rmSync(target, { recursive: true, force: true });
  }
  cleanupPaths.clear();
  delete process.env.PIXELPET_STORE_FILE;
});

describe("server integration", () => {
  it("restores a saved session and pet after restart", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pixelpet-server-"));
    const storeFile = path.join(tempDir, "store.json");

    let app: INestApplication | undefined;
    try {
      ({ app } = await startTestServer(storeFile));

      const baseUrl = await (async () => {
        const address = app!.getHttpServer().address() as AddressInfo;
        return `http://127.0.0.1:${address.port}`;
      })();

      const login = await requestJson<DemoSession>(baseUrl, "/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Trainer A",
          installId: "install-alpha",
        }),
      });

      expect(login.response.status).toBe(201);
      expect(login.body?.user.id).toBe("user-install-alpha");

      const beforePet = await requestJson<PetResponse | null>(baseUrl, "/pets/me", {
        headers: authHeaders(login.body!.accessToken),
      });
      expect(beforePet.response.status).toBe(200);
      expect(beforePet.body).toBeNull();

      const createdPet = await requestJson<PetResponse>(baseUrl, "/pets/roll-initial", {
        method: "POST",
        headers: authHeaders(login.body!.accessToken),
        body: JSON.stringify({ nickname: "Nova" }),
      });

      expect(createdPet.response.status).toBe(201);
      expect(createdPet.body?.nickname).toBe("Nova");
      expect(createdPet.body?.experience).toBe(0);

      await stopTestServer(app);
      app = undefined;

      ({ app } = await startTestServer(storeFile));
      const restartedBaseUrl = await (async () => {
        const address = app!.getHttpServer().address() as AddressInfo;
        return `http://127.0.0.1:${address.port}`;
      })();

      const restoredPet = await requestJson<PetResponse | null>(restartedBaseUrl, "/pets/me", {
        headers: authHeaders(login.body!.accessToken),
      });

      expect(restoredPet.response.status).toBe(200);
      expect(restoredPet.body).toMatchObject({
        id: createdPet.body?.id,
        ownerId: login.body?.user.id,
        nickname: "Nova",
      });
    } finally {
      await stopTestServer(app);
    }
  });

  it("keeps install ids isolated between demo users", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pixelpet-server-"));
    const storeFile = path.join(tempDir, "store.json");

    let app: INestApplication | undefined;
    try {
      const started = await startTestServer(storeFile);
      app = started.app;

      const firstLogin = await requestJson<DemoSession>(started.baseUrl, "/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Trainer A",
          installId: "install-a",
        }),
      });
      const secondLogin = await requestJson<DemoSession>(started.baseUrl, "/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Trainer B",
          installId: "install-b",
        }),
      });

      expect(firstLogin.body?.user.id).toBe("user-install-a");
      expect(secondLogin.body?.user.id).toBe("user-install-b");
      expect(firstLogin.body?.user.id).not.toBe(secondLogin.body?.user.id);

      const firstPet = await requestJson<PetResponse>(started.baseUrl, "/pets/roll-initial", {
        method: "POST",
        headers: authHeaders(firstLogin.body!.accessToken),
        body: JSON.stringify({ nickname: "Solo" }),
      });
      const secondPet = await requestJson<PetResponse | null>(started.baseUrl, "/pets/me", {
        headers: authHeaders(secondLogin.body!.accessToken),
      });

      expect(firstPet.body?.ownerId).toBe(firstLogin.body?.user.id);
      expect(secondPet.body).toBeNull();
    } finally {
      await stopTestServer(app);
    }
  });

  it("returns unauthorized for an invalid session token", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pixelpet-server-"));
    const storeFile = path.join(tempDir, "store.json");

    let app: INestApplication | undefined;
    try {
      const started = await startTestServer(storeFile);
      app = started.app;

      const response = await requestJson<{ message: string }>(started.baseUrl, "/pets/me", {
        headers: authHeaders("not-a-real-token"),
      });

      expect(response.response.status).toBe(401);
      expect(response.body?.message).toBe("Invalid session");
    } finally {
      await stopTestServer(app);
    }
  });

  it("moves a neglected pet to dead and allows a free revive", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pixelpet-server-"));
    const storeFile = path.join(tempDir, "store.json");

    let app: INestApplication | undefined;
    try {
      const started = await startTestServer(storeFile);
      app = started.app;

      const login = await requestJson<DemoSession>(started.baseUrl, "/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Trainer A",
          installId: "install-dead",
        }),
      });
      const createdPet = await requestJson<PetResponse>(started.baseUrl, "/pets/roll-initial", {
        method: "POST",
        headers: authHeaders(login.body!.accessToken),
        body: JSON.stringify({ nickname: "Nova" }),
      });

      await stopTestServer(app);
      app = undefined;

      const persisted = JSON.parse(fs.readFileSync(storeFile, "utf8")) as {
        pets: PetResponse[];
      };
      persisted.pets[0] = {
        ...persisted.pets[0],
        lifeState: "critical",
        criticalSince: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
        careState: {
          hunger: 8,
          mood: 32,
          hygiene: 32,
          energy: 32,
          bond: 50,
        },
      };
      fs.writeFileSync(storeFile, JSON.stringify(persisted, null, 2), "utf8");

      ({ app } = await startTestServer(storeFile));
      const address = app.getHttpServer().address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const deadPet = await requestJson<PetResponse | null>(baseUrl, "/pets/me", {
        headers: authHeaders(login.body!.accessToken),
      });
      expect(deadPet.body?.lifeState).toBe("dead");

      const revived = await requestJson<PetResponse>(baseUrl, `/pets/${createdPet.body!.id}/revive`, {
        method: "POST",
        headers: authHeaders(login.body!.accessToken),
      });

      expect(revived.response.status).toBe(201);
      expect(revived.body?.lifeState).toBe("alive");
      expect(revived.body?.freeRevivesRemaining).toBe(2);
      expect(revived.body?.careState).toMatchObject({
        hunger: 60,
        mood: 60,
        hygiene: 60,
        energy: 60,
      });
    } finally {
      await stopTestServer(app);
    }
  });

  it("allows accepting death when free revives are exhausted", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pixelpet-server-"));
    const storeFile = path.join(tempDir, "store.json");

    let app: INestApplication | undefined;
    try {
      const started = await startTestServer(storeFile);
      app = started.app;

      const login = await requestJson<DemoSession>(started.baseUrl, "/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Trainer A",
          installId: "install-accept",
        }),
      });
      const createdPet = await requestJson<PetResponse>(started.baseUrl, "/pets/roll-initial", {
        method: "POST",
        headers: authHeaders(login.body!.accessToken),
        body: JSON.stringify({ nickname: "Nova" }),
      });

      await stopTestServer(app);
      app = undefined;

      const persisted = JSON.parse(fs.readFileSync(storeFile, "utf8")) as {
        pets: PetResponse[];
      };
      persisted.pets[0] = {
        ...persisted.pets[0],
        lifeState: "dead",
        criticalSince: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString(),
        diedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        freeRevivesRemaining: 0,
      };
      fs.writeFileSync(storeFile, JSON.stringify(persisted, null, 2), "utf8");

      ({ app } = await startTestServer(storeFile));
      const address = app.getHttpServer().address() as AddressInfo;
      const baseUrl = `http://127.0.0.1:${address.port}`;

      const reviveBlocked = await requestJson<{ message: string }>(baseUrl, `/pets/${createdPet.body!.id}/revive`, {
        method: "POST",
        headers: authHeaders(login.body!.accessToken),
      });
      expect(reviveBlocked.response.status).toBe(400);

      const accepted = await requestJson<{ accepted: boolean }>(baseUrl, `/pets/${createdPet.body!.id}/accept-death`, {
        method: "POST",
        headers: authHeaders(login.body!.accessToken),
      });
      expect(accepted.response.status).toBe(201);
      expect(accepted.body?.accepted).toBe(true);

      const petAfter = await requestJson<PetResponse | null>(baseUrl, "/pets/me", {
        headers: authHeaders(login.body!.accessToken),
      });
      expect(petAfter.body).toBeNull();
    } finally {
      await stopTestServer(app);
    }
  });

  it("persists battle XP and stat aftermath after a dev battle ends", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pixelpet-server-"));
    const storeFile = path.join(tempDir, "store.json");

    let app: INestApplication | undefined;
    try {
      const started = await startTestServer(storeFile);
      app = started.app;
      vi.spyOn(Math, "random").mockReturnValue(0);

      const login = await requestJson<DemoSession>(started.baseUrl, "/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Trainer A",
          installId: "install-battle",
        }),
      });
      const createdPet = await requestJson<PetResponse>(started.baseUrl, "/pets/roll-initial", {
        method: "POST",
        headers: authHeaders(login.body!.accessToken),
        body: JSON.stringify({ nickname: "Nova" }),
      });

      const queue = await requestJson<{ battleId: string }>(started.baseUrl, "/battle/queue-dev", {
        method: "POST",
        headers: authHeaders(login.body!.accessToken),
        body: JSON.stringify({ petId: createdPet.body!.id }),
      });
      expect(queue.response.status).toBe(201);

      let battleResult: { result?: { winnerUserId: string } } | null = null;
      for (let turn = 0; turn < 20; turn += 1) {
        const action = await requestJson<{ result?: { winnerUserId: string } }>(
          started.baseUrl,
          `/battle/${queue.body!.battleId}/action`,
          {
            method: "POST",
            headers: authHeaders(login.body!.accessToken),
            body: JSON.stringify({ action: "attack" }),
          },
        );
        battleResult = action.body;
        if (battleResult?.result) {
          break;
        }
      }

      expect(battleResult?.result).toBeDefined();

      const updatedPet = await requestJson<PetResponse | null>(started.baseUrl, "/pets/me", {
        headers: authHeaders(login.body!.accessToken),
      });

      expect(updatedPet.body?.experience).toBeGreaterThan(createdPet.body!.experience);
      expect(updatedPet.body?.careState).not.toEqual(createdPet.body!.careState);
    } finally {
      await stopTestServer(app);
    }
  });
});
