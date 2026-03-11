import { Body, Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
import { AuthUser } from "../common/auth-user.decorator";
import { AuthGuard } from "../common/auth.guard";
import { PetService } from "./pet.service";

@Controller("pets")
@UseGuards(AuthGuard)
export class PetController {
  constructor(
    @Inject(PetService)
    private readonly petService: PetService,
  ) {}

  @Post("roll-initial")
  rollInitial(
    @AuthUser() userId: string,
    @Body() body?: { nickname?: string },
  ) {
    return this.petService.rollInitialPet(userId, body?.nickname);
  }

  @Get("me")
  getMine(@AuthUser() userId: string) {
    return this.petService.getMyPet(userId);
  }

  @Post(":id/revive")
  revive(@AuthUser() userId: string, @Param("id") petId: string) {
    return this.petService.revivePet(userId, petId);
  }

  @Post(":id/accept-death")
  acceptDeath(@AuthUser() userId: string, @Param("id") petId: string) {
    return this.petService.acceptDeath(userId, petId);
  }

  @Get(":id")
  getOne(@AuthUser() userId: string, @Param("id") petId: string) {
    return this.petService.assertOwnership(userId, petId);
  }
}
