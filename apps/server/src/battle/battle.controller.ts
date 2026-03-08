import { Body, Controller, Inject, Post, UseGuards } from "@nestjs/common";
import { AuthUser } from "../common/auth-user.decorator";
import { AuthGuard } from "../common/auth.guard";
import { BattleService } from "./battle.service";

@Controller("battle")
@UseGuards(AuthGuard)
export class BattleController {
  constructor(
    @Inject(BattleService)
    private readonly battleService: BattleService,
  ) {}

  @Post("queue")
  queue(
    @AuthUser() userId: string,
    @Body() body: { petId: string },
  ) {
    return this.battleService.queueForBattle(userId, body.petId);
  }
}
