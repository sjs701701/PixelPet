import { Body, Controller, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { AuthUser } from "../common/auth-user.decorator";
import { AuthGuard } from "../common/auth.guard";
import { CareService } from "./care.service";

@Controller("pets")
@UseGuards(AuthGuard)
export class CareController {
  constructor(
    @Inject(CareService)
    private readonly careService: CareService,
  ) {}

  @Post(":id/care")
  care(
    @AuthUser() userId: string,
    @Param("id") petId: string,
    @Body() body: { action: "feed" | "clean" | "play" | "rest" },
  ) {
    return this.careService.performCare(userId, petId, body.action);
  }
}
