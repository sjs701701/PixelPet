import { Inject, Injectable } from "@nestjs/common";
import {
  BattleAction,
  BattleFighterSnapshot,
  BattleSnapshot,
  BattleTurnLog,
  PET_TEMPLATES,
  ReplayRecord,
  createBattleStats,
  compareInitiative,
  getRandomFactor,
  resolveTurn,
} from "@pixel-pet-arena/shared";
import { StoreService } from "../common/store.service";

type LiveBattle = {
  id: string;
  fighters: [BattleFighterSnapshot, BattleFighterSnapshot];
  turn: number;
  logs: BattleTurnLog[];
  pendingActions: Map<string, BattleAction>;
  timer: number;
};

@Injectable()
export class BattleService {
  private readonly battles = new Map<string, LiveBattle>();

  constructor(
    @Inject(StoreService)
    private readonly store: StoreService,
  ) {}

  queueForBattle(userId: string, petId: string) {
    this.store.enqueueBattle(userId, petId);
    const pair = this.store.popMatchFor(userId);
    if (!pair) {
      return { matched: false, queueDepth: this.store.listQueue().length };
    }

    const [left, right] = pair;
    const battle = this.createBattle(left.userId, left.petId, right.userId, right.petId);
    return { matched: true, battleId: battle.id, battle };
  }

  getBattle(battleId: string) {
    return this.battles.get(battleId);
  }

  submitAction(battleId: string, userId: string, action: BattleAction): BattleSnapshot {
    const battle = this.battles.get(battleId);
    if (!battle) {
      throw new Error("Battle not found");
    }

    battle.pendingActions.set(userId, action);
    if (battle.pendingActions.size < 2) {
      return this.toSnapshot(battle);
    }

    const ordered = [...battle.fighters].sort(compareInitiative);
    let left = ordered[0];
    let right = ordered[1];
    const turnLogs: BattleTurnLog[] = [];

    const leftAction = battle.pendingActions.get(left.userId) ?? "attack";
    const leftResolution = resolveTurn(
      battle.turn,
      left,
      right,
      leftAction,
      getRandomFactor(),
    );
    turnLogs.push(leftResolution.log);
    left = leftResolution.nextActor;
    right = leftResolution.nextDefender;

    if (right.hp > 0) {
      const rightAction = battle.pendingActions.get(right.userId) ?? "attack";
      const rightResolution = resolveTurn(
        battle.turn,
        right,
        left,
        rightAction,
        getRandomFactor(),
      );
      turnLogs.push(rightResolution.log);
      right = rightResolution.nextActor;
      left = rightResolution.nextDefender;
    }

    battle.fighters = [left, right];
    battle.logs.push(...turnLogs);
    battle.pendingActions.clear();
    battle.turn += 1;

    const winner =
      left.hp === 0
        ? right.userId
        : right.hp === 0
          ? left.userId
          : undefined;

    if (winner) {
      const loser = winner === left.userId ? right.userId : left.userId;
      const replay: ReplayRecord = {
        battleId: battle.id,
        createdAt: new Date().toISOString(),
        winnerUserId: winner,
        loserUserId: loser,
        turns: battle.logs,
      };
      this.store.addReplay(replay);
    }

    return this.toSnapshot(battle, winner);
  }

  private createBattle(userOneId: string, petOneId: string, userTwoId: string, petTwoId: string) {
    const one = this.buildFighter(userOneId, petOneId);
    const two = this.buildFighter(userTwoId, petTwoId);
    const battle: LiveBattle = {
      id: `battle-${this.battles.size + 1}`,
      fighters: [one, two],
      turn: 1,
      logs: [],
      pendingActions: new Map(),
      timer: 20,
    };
    this.battles.set(battle.id, battle);
    return battle;
  }

  private buildFighter(userId: string, petId: string) {
    const pet = this.store.getPetOrThrow(petId);
    const user = this.store.getUser(userId);
    const template = PET_TEMPLATES.find((entry) => entry.id === pet.templateId);
    if (!template) {
      throw new Error("Template missing");
    }

    return createBattleStats({
      userId,
      petId,
      name: template.name,
      element: template.element,
      level: pet.level,
      hp: template.baseStats.hp,
      maxHp: template.baseStats.hp,
      attack: template.baseStats.attack,
      defense: template.baseStats.defense,
      speed: template.baseStats.speed,
      guarding: false,
      premiumStatus: user.premiumStatus,
    });
  }

  private toSnapshot(battle: LiveBattle, winnerUserId?: string): BattleSnapshot {
    const [left, right] = battle.fighters;
    return {
      battleId: battle.id,
      turn: battle.turn,
      hp: {
        [left.userId]: left.hp,
        [right.userId]: right.hp,
      },
      statusEffects: {
        [left.userId]: left.guarding ? ["guard"] : [],
        [right.userId]: right.guarding ? ["guard"] : [],
      },
      timer: battle.timer,
      result: winnerUserId
        ? {
            winnerUserId,
            loserUserId: winnerUserId === left.userId ? right.userId : left.userId,
          }
        : undefined,
    };
  }
}
