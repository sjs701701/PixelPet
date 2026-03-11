import { Inject, Injectable } from "@nestjs/common";
import { applyCareAction } from "@pixel-pet-arena/shared";
import { PetService } from "../pet/pet.service";

@Injectable()
export class CareService {
  constructor(
    @Inject(PetService)
    private readonly pets: PetService,
  ) {}

  performCare(
    userId: string,
    petId: string,
    action: "feed" | "clean" | "play" | "rest",
  ) {
    const pet = this.pets.assertActionable(userId, petId);
    const updated = {
      ...pet,
      careState: applyCareAction(pet.careState, action),
    };
    return this.pets.applyCareState(userId, updated);
  }
}
