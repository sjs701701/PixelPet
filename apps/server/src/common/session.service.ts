import { Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class AuthSessionService {
  private readonly sessions = new Map<string, string>();

  createSession(userId: string) {
    const token = Buffer.from(`${userId}:${Date.now()}`).toString("base64url");
    this.sessions.set(token, userId);
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
