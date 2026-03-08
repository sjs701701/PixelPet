import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { AuthUser } from "../common/auth-user.decorator";
import { AuthGuard } from "../common/auth.guard";
import { StoreService } from "../common/store.service";

@Controller("battle")
@UseGuards(AuthGuard)
export class ReplayController {
  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
  ) {}

  @Get("replays")
  getReplays(@AuthUser() userId: string) {
    const user = this.store.getUser(userId);
    return this.store.getReplaysForUser(userId, user.premiumStatus);
  }
}
