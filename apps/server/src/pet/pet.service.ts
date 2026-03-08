import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { StoreService } from "../common/store.service";

@Injectable()
export class PetService {
  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
  ) {}

  rollInitialPet(userId: string) {
    return this.store.rollInitialPet(userId);
  }

  getMyPet(userId: string) {
    return this.store.getUserPet(userId) ?? this.store.rollInitialPet(userId);
  }

  assertOwnership(userId: string, petId: string) {
    const pet = this.store.getPetOrThrow(petId);
    if (pet.ownerId !== userId) {
      throw new ForbiddenException("Pet does not belong to user");
    }
    return pet;
  }
}
