import { Inject, Injectable } from "@nestjs/common";
import { LoginProvider, User } from "@pixel-pet-arena/shared";
import { AuthSessionService } from "../common/session.service";
import { StoreService } from "../common/store.service";

@Injectable()
export class AuthService {
  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
    @Inject(AuthSessionService)
    private readonly sessions: AuthSessionService,
  ) {}

  signIn(displayName?: string, provider?: LoginProvider) {
    const safeDisplayName = displayName?.trim() || "Pixel Trainer";
    const safeProvider: LoginProvider = provider ?? "google";
    const user: User = this.store.upsertUser({
      id: `user-${safeDisplayName.toLowerCase().replace(/\s+/g, "-")}`,
      displayName: safeDisplayName,
      loginProvider: safeProvider,
      premiumStatus: "free",
    });

    return {
      user,
      accessToken: this.sessions.createSession(user.id),
    };
  }
}
