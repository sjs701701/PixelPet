import { BadRequestException, ForbiddenException, Inject, Injectable } from "@nestjs/common";
import {
  BATTLE_LOSS_XP,
  BATTLE_WIN_XP,
  REVIVE_RESTORE_VALUE,
  applyBattleAftermath,
  applyExperienceGain,
  simulatePetProgress,
} from "@pixel-pet-arena/shared";
import { StoreService } from "../common/store.service";

@Injectable()
export class PetService {
  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
  ) {}

  rollInitialPet(userId: string, nickname?: string) {
    return this.store.rollInitialPet(userId, nickname);
  }

  getMyPet(userId: string) {
    const pet = this.store.getUserPet(userId);
    if (!pet) {
      return null;
    }

    return this.syncPet(userId, pet);
  }

  assertOwnership(userId: string, petId: string) {
    const pet = this.store.getPetOrThrow(petId);
    if (pet.ownerId !== userId) {
      throw new ForbiddenException("Pet does not belong to user");
    }

    return this.syncPet(userId, pet);
  }

  assertActionable(userId: string, petId: string) {
    const pet = this.assertOwnership(userId, petId);
    if (pet.lifeState === "dead") {
      throw new BadRequestException("Dead pets cannot act");
    }
    return pet;
  }

  applyCareState(userId: string, pet: ReturnType<PetService["assertOwnership"]>) {
    return this.savePet(userId, pet);
  }

  applyBattleOutcome(userId: string, petId: string, result: "win" | "lose") {
    const pet = this.assertOwnership(userId, petId);
    const xp = result === "win" ? BATTLE_WIN_XP : BATTLE_LOSS_XP;
    const rewarded = applyExperienceGain(applyBattleAftermath(pet, result), xp);
    return this.savePet(userId, rewarded);
  }

  revivePet(userId: string, petId: string) {
    const pet = this.assertOwnership(userId, petId);
    if (pet.lifeState !== "dead") {
      throw new BadRequestException("Only dead pets can be revived");
    }
    if (pet.freeRevivesRemaining <= 0) {
      throw new BadRequestException("No free revives remaining");
    }

    const revived = this.savePet(userId, {
      ...pet,
      careState: {
        ...pet.careState,
        hunger: REVIVE_RESTORE_VALUE,
        mood: REVIVE_RESTORE_VALUE,
        hygiene: REVIVE_RESTORE_VALUE,
        energy: REVIVE_RESTORE_VALUE,
      },
      lifeState: "alive",
      criticalSince: undefined,
      diedAt: undefined,
      freeRevivesRemaining: pet.freeRevivesRemaining - 1,
      lastSimulatedAt: new Date().toISOString(),
    });

    return revived;
  }

  acceptDeath(userId: string, petId: string) {
    const pet = this.assertOwnership(userId, petId);
    if (pet.lifeState !== "dead") {
      throw new BadRequestException("Only dead pets can be accepted");
    }

    this.store.deletePet(petId);
    return { accepted: true };
  }

  private savePet(userId: string, pet: ReturnType<PetService["assertOwnership"]>) {
    const synced = this.simulateForUser(userId, pet, new Date().toISOString());
    return this.store.updatePet(synced);
  }

  private syncPet(userId: string, pet: ReturnType<StoreService["getPetOrThrow"]>) {
    const synced = this.simulateForUser(userId, pet, new Date().toISOString());
    if (JSON.stringify(synced) !== JSON.stringify(pet)) {
      return this.store.updatePet(synced);
    }

    return synced;
  }

  private simulateForUser(userId: string, pet: ReturnType<StoreService["getPetOrThrow"]>, now: string) {
    const user = this.store.getUser(userId);
    return simulatePetProgress(pet, now, user.premiumStatus === "premium");
  }
}
