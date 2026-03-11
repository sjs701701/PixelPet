import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
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
});
