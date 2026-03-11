import fs from "node:fs";
import path from "node:path";
import { Injectable } from "@nestjs/common";
import { PetInstance, ReplayRecord, User } from "@pixel-pet-arena/shared";

type PersistedSession = {
  token: string;
  userId: string;
};

type PersistedState = {
  users: User[];
  pets: PetInstance[];
  replays: ReplayRecord[];
  sessions: PersistedSession[];
};

const EMPTY_STATE: PersistedState = {
  users: [],
  pets: [],
  replays: [],
  sessions: [],
};

function resolveServerRoot() {
  const cwd = process.cwd();
  const looksLikeServerRoot =
    path.basename(cwd) === "server" &&
    fs.existsSync(path.resolve(cwd, "src")) &&
    fs.existsSync(path.resolve(cwd, "package.json"));

  return looksLikeServerRoot ? cwd : path.resolve(cwd, "apps", "server");
}

function resolveDataFile(serverRoot: string) {
  const override = process.env.PIXELPET_STORE_FILE?.trim();
  if (!override) {
    return path.resolve(serverRoot, "data", "store.json");
  }

  return path.isAbsolute(override)
    ? override
    : path.resolve(process.cwd(), override);
}

function cloneEmptyState(): PersistedState {
  return {
    users: [],
    pets: [],
    replays: [],
    sessions: [],
  };
}

@Injectable()
export class LocalPersistenceService {
  private readonly serverRoot = resolveServerRoot();
  private readonly dataFile = resolveDataFile(this.serverRoot);
  private readonly dataDir = path.dirname(this.dataFile);
  private state: PersistedState;

  constructor() {
    this.state = this.loadState();
  }

  getUsers() {
    return this.state.users;
  }

  getPets() {
    return this.state.pets;
  }

  getReplays() {
    return this.state.replays;
  }

  getSessions() {
    return this.state.sessions;
  }

  saveUsers(users: Iterable<User>) {
    this.state.users = Array.from(users);
    this.flush();
  }

  savePets(pets: Iterable<PetInstance>) {
    this.state.pets = Array.from(pets);
    this.flush();
  }

  saveReplays(replays: ReplayRecord[]) {
    this.state.replays = [...replays];
    this.flush();
  }

  saveSessions(entries: Iterable<[string, string]>) {
    this.state.sessions = Array.from(entries, ([token, userId]) => ({ token, userId }));
    this.flush();
  }

  private loadState(): PersistedState {
    fs.mkdirSync(this.dataDir, { recursive: true });

    if (!fs.existsSync(this.dataFile)) {
      const initial = cloneEmptyState();
      this.writeState(initial);
      return initial;
    }

    try {
      const raw = fs.readFileSync(this.dataFile, "utf8").trim();
      if (!raw) {
        const initial = cloneEmptyState();
        this.writeState(initial);
        return initial;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      return {
        users: Array.isArray(parsed.users) ? parsed.users as User[] : [...EMPTY_STATE.users],
        pets: Array.isArray(parsed.pets) ? parsed.pets as PetInstance[] : [...EMPTY_STATE.pets],
        replays: Array.isArray(parsed.replays) ? parsed.replays as ReplayRecord[] : [...EMPTY_STATE.replays],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions as PersistedSession[] : [...EMPTY_STATE.sessions],
      };
    } catch (error) {
      throw new Error(`Failed to load local store at ${this.dataFile}: ${String(error)}`);
    }
  }

  private flush() {
    this.writeState(this.state);
  }

  private writeState(nextState: PersistedState) {
    const tempFile = `${this.dataFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(nextState, null, 2), "utf8");
    fs.renameSync(tempFile, this.dataFile);
  }
}
