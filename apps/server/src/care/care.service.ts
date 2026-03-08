import { Inject, Injectable } from "@nestjs/common";
import { applyCareAction } from "@pixel-pet-arena/shared";
import { StoreService } from "../common/store.service";
import { PetService } from "../pet/pet.service";

@Injectable()
export class CareService {
  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
    @Inject(PetService)
    private readonly pets: PetService,
  ) {}

  performCare(
    userId: string,
    petId: string,
    action: "feed" | "clean" | "play" | "rest",
  ) {
    const pet = this.pets.assertOwnership(userId, petId);
    const updated = {
      ...pet,
      careState: applyCareAction(pet.careState, action),
    };
    return this.store.updatePet(updated);
  }
}
