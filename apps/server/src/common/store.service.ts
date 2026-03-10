import { Injectable, NotFoundException } from "@nestjs/common";
import {
  DEFAULT_CARE_STATE,
  PET_TEMPLATES,
  PetInstance,
  PremiumStatus,
  ReplayRecord,
  User,
} from "@pixel-pet-arena/shared";

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

  upsertUser(user: User) {
    this.users.set(user.id, user);
    return user;
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

  rollInitialPet(userId: string) {
    const existing = this.getUserPet(userId);
    if (existing) {
      return existing;
    }

    const template = PET_TEMPLATES[Math.floor(Math.random() * PET_TEMPLATES.length)];
    const pet: PetInstance = {
      id: `pet-${this.pets.size + 1}`,
      ownerId: userId,
      templateId: template.id,
      level: 1,
      experience: 35,
      careState: { ...DEFAULT_CARE_STATE },
      inventoryLoadout: {},
      cosmeticLoadout: {},
      createdAt: new Date().toISOString(),
    };
    this.pets.set(pet.id, pet);
    return pet;
  }

  updatePet(pet: PetInstance) {
    this.pets.set(pet.id, pet);
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
