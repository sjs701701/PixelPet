import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
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

  /** Dev-only: instant match against a bot */
  @Post("queue-dev")
  queueDev(
    @AuthUser() userId: string,
    @Body() body: { petId: string },
  ) {
    return this.battleService.queueForBattleDev(userId, body.petId);
  }

  /** Get battle details including fighter snapshots */
  @Get(":id")
  getBattle(@Param("id") battleId: string) {
    return this.battleService.getBattleDetails(battleId);
  }

  /** Submit action; bot auto-responds in dev mode */
  @Post(":id/action")
  submitAction(
    @AuthUser() userId: string,
    @Param("id") battleId: string,
    @Body() body: { action: "attack" | "guard" | "skill" },
  ) {
    return this.battleService.submitActionDev(battleId, userId, body.action);
  }
}
