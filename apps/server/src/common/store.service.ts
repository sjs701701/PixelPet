import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  DEFAULT_CARE_STATE,
  PET_TEMPLATES,
  PetInstance,
  PremiumStatus,
  ReplayRecord,
  User,
} from "@pixel-pet-arena/shared";
import { LocalPersistenceService } from "./local-persistence.service";

type BattleQueueEntry = {
  userId: string;
  petId: string;
  queuedAt: string;
};

@Injectable()
export class StoreService {
  private readonly users = new Map<string, User>();
  private readonly pets = new Map<string, PetInstance>();
  private readonly replays: ReplayRecord[] = [];
  private readonly battleQueue: BattleQueueEntry[] = [];

  constructor(
    @Inject(LocalPersistenceService)
    private readonly persistence: LocalPersistenceService,
  ) {
    for (const user of this.persistence.getUsers()) {
      this.users.set(user.id, user);
    }

    for (const pet of this.persistence.getPets()) {
      this.pets.set(pet.id, pet);
    }

    this.replays.push(...this.persistence.getReplays());
  }

  upsertUser(user: User) {
    this.users.set(user.id, user);
    this.persistence.saveUsers(this.users.values());
    return user;
  }

  findUserByInstallId(installId: string) {
    return Array.from(this.users.values()).find((user) => user.installId === installId);
  }

  getUser(userId: string) {
    const user = this.users.get(userId);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  listTemplates() {
    return PET_TEMPLATES;
  }

  getUserPet(userId: string) {
    return Array.from(this.pets.values()).find((pet) => pet.ownerId === userId);
  }

  rollInitialPet(userId: string, nickname?: string) {
    const existing = this.getUserPet(userId);
    if (existing) {
      return existing;
    }

    const safeNickname = nickname?.trim() || undefined;
    const template = PET_TEMPLATES[Math.floor(Math.random() * PET_TEMPLATES.length)];
    const pet: PetInstance = {
      id: `pet-${this.pets.size + 1}`,
      ownerId: userId,
      templateId: template.id,
      nickname: safeNickname,
      level: 1,
      experience: 35,
      careState: { ...DEFAULT_CARE_STATE },
      inventoryLoadout: {},
      cosmeticLoadout: {},
      createdAt: new Date().toISOString(),
    };
    this.pets.set(pet.id, pet);
    this.persistence.savePets(this.pets.values());
    return pet;
  }

  updatePet(pet: PetInstance) {
    this.pets.set(pet.id, pet);
    this.persistence.savePets(this.pets.values());
    return pet;
  }

  getPetOrThrow(petId: string) {
    const pet = this.pets.get(petId);
    if (!pet) {
      throw new NotFoundException("Pet not found");
    }
    return pet;
  }

  enqueueBattle(userId: string, petId: string) {
    this.battleQueue.push({ userId, petId, queuedAt: new Date().toISOString() });
    return this.battleQueue;
  }

  popMatchFor(userId: string) {
    const challengerIndex = this.battleQueue.findIndex((entry) => entry.userId === userId);
    if (challengerIndex === -1) {
      return undefined;
    }

    const challenger = this.battleQueue[challengerIndex];
    const opponentIndex = this.battleQueue.findIndex(
      (entry, index) => entry.userId !== userId && index !== challengerIndex,
    );

    if (opponentIndex === -1) {
      return undefined;
    }

    const opponent = this.battleQueue[opponentIndex];
    this.battleQueue.splice(Math.max(challengerIndex, opponentIndex), 1);
    this.battleQueue.splice(Math.min(challengerIndex, opponentIndex), 1);
    return [challenger, opponent];
  }

  listQueue() {
    return [...this.battleQueue];
  }

  addReplay(replay: ReplayRecord) {
    this.replays.unshift(replay);
    this.persistence.saveReplays(this.replays);
    return replay;
  }

  getReplaysForUser(userId: string, premiumStatus: PremiumStatus) {
    if (premiumStatus !== "premium") {
      return [];
    }
    return this.replays.filter(
      (replay) => replay.winnerUserId === userId || replay.loserUserId === userId,
    );
  }
}
