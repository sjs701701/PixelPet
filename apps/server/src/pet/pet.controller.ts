import { Controller, Get, Inject, Param, Post, UseGuards } from "@nestjs/common";
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
  rollInitial(@AuthUser() userId: string) {
    return this.petService.rollInitialPet(userId);
  }

  @Get("me")
  getMine(@AuthUser() userId: string) {
    return this.petService.getMyPet(userId);
  }

  @Get(":id")
  getOne(@AuthUser() userId: string, @Param("id") petId: string) {
    return this.petService.assertOwnership(userId, petId);
  }
}
