import { Inject, Injectable } from "@nestjs/common";
import {
  BattleAction,
  BattleFighterSnapshot,
  BattleSnapshot,
  BattleTurnLog,
  ElementType,
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

  getBattleDetails(battleId: string) {
    const battle = this.battles.get(battleId);
    if (!battle) throw new Error("Battle not found");
    const [left, right] = battle.fighters;
    return {
      ...this.toSnapshot(battle),
      fighters: [
        { userId: left.userId, name: left.name, element: left.element, level: left.level, hp: left.hp, maxHp: left.maxHp, attack: left.attack, defense: left.defense, speed: left.speed },
        { userId: right.userId, name: right.name, element: right.element, level: right.level, hp: right.hp, maxHp: right.maxHp, attack: right.attack, defense: right.defense, speed: right.speed },
      ],
      logs: battle.logs,
    };
  }

  /** Submit player action then auto-submit bot action for dev testing */
  submitActionDev(battleId: string, userId: string, action: BattleAction): any {
    const battle = this.battles.get(battleId);
    if (!battle) throw new Error("Battle not found");

    // Pre-set bot action so both are ready when submitAction processes
    const botFighter = battle.fighters.find((f) => f.userId === "bot-trainer");
    if (botFighter && !battle.pendingActions.has(botFighter.userId)) {
      const roll = Math.random();
      const botAction: BattleAction = roll < 0.6 ? "attack" : roll < 0.85 ? "skill" : "guard";
      battle.pendingActions.set(botFighter.userId, botAction);
    }

    // submitAction will set the player's action and resolve the turn
    const snapshot = this.submitAction(battleId, userId, action);

    const updated = this.battles.get(battleId);
    if (!updated) return snapshot;
    const [left, right] = updated.fighters;
    return {
      ...snapshot,
      fighters: [
        { userId: left.userId, name: left.name, element: left.element, level: left.level, hp: left.hp, maxHp: left.maxHp, attack: left.attack, defense: left.defense, speed: left.speed },
        { userId: right.userId, name: right.name, element: right.element, level: right.level, hp: right.hp, maxHp: right.maxHp, attack: right.attack, defense: right.defense, speed: right.speed },
      ],
      logs: updated.logs.slice(-2),
    };
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

  /** Dev-only: instantly match against a random bot */
  queueForBattleDev(userId: string, petId: string) {
    const pet = this.store.getPetOrThrow(petId);
    const template = PET_TEMPLATES.find((t) => t.id === pet.templateId);
    if (!template) throw new Error("Template missing");

    // Pick a random template for the bot (different element if possible)
    const otherTemplates = PET_TEMPLATES.filter((t) => t.element !== template.element);
    const botTemplate = otherTemplates[Math.floor(Math.random() * otherTemplates.length)];

    const botFighter = createBattleStats({
      userId: "bot-trainer",
      petId: "bot-pet",
      name: botTemplate.name,
      element: botTemplate.element as ElementType,
      level: pet.level,
      hp: botTemplate.baseStats.hp,
      maxHp: botTemplate.baseStats.hp,
      attack: botTemplate.baseStats.attack,
      defense: botTemplate.baseStats.defense,
      speed: botTemplate.baseStats.speed,
      guarding: false,
      premiumStatus: "free",
    });

    const playerFighter = this.buildFighter(userId, petId);

    const battle: LiveBattle = {
      id: `battle-${this.battles.size + 1}`,
      fighters: [playerFighter, botFighter],
      turn: 1,
      logs: [],
      pendingActions: new Map(),
      timer: 20,
    };
    this.battles.set(battle.id, battle);

    return { matched: true, battleId: battle.id, battle: this.toSnapshot(battle) };
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
