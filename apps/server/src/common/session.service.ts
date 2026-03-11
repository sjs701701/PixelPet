import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { LocalPersistenceService } from "./local-persistence.service";

@Injectable()
export class AuthSessionService {
  private readonly sessions = new Map<string, string>();

  constructor(
    @Inject(LocalPersistenceService)
    private readonly persistence: LocalPersistenceService,
  ) {
    for (const session of this.persistence.getSessions()) {
      this.sessions.set(session.token, session.userId);
    }
  }

  createSession(userId: string) {
    const token = Buffer.from(`${userId}:${Date.now()}`).toString("base64url");
    this.sessions.set(token, userId);
    this.persistence.saveSessions(this.sessions.entries());
    return token;
  }

  verifyToken(token?: string) {
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const userId = this.sessions.get(token);
    if (!userId) {
      throw new UnauthorizedException("Invalid session");
    }

    return userId;
  }
}
