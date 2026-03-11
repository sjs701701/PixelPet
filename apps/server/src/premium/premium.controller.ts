import { Body, Controller, Get, Inject, Post, UseGuards } from "@nestjs/common";
import { AuthUser } from "../common/auth-user.decorator";
import { AuthGuard } from "../common/auth.guard";
import { PremiumService } from "./premium.service";

@Controller("premium")
@UseGuards(AuthGuard)
export class PremiumController {
  constructor(
    @Inject(PremiumService)
    private readonly premiumService: PremiumService,
  ) {}

  @Get("status")
  getStatus(@AuthUser() userId: string) {
    return this.premiumService.getStatus(userId);
  }

  @Post("verify-purchase")
  verify(
    @AuthUser() userId: string,
    @Body() body: { receipt?: string },
  ) {
    return this.premiumService.verifyPurchase(userId, body.receipt);
  }

  @Post("dev/toggle")
  toggleDevPremium(
    @AuthUser() userId: string,
    @Body() body: { enabled?: boolean },
  ) {
    return this.premiumService.toggleDevPremium(userId, body.enabled === true);
  }
}
