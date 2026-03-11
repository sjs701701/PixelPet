import { Global, Module } from "@nestjs/common";
import { AuthSessionService } from "./session.service";
import { LocalPersistenceService } from "./local-persistence.service";
import { StoreService } from "./store.service";

@Global()
@Module({
  providers: [LocalPersistenceService, StoreService, AuthSessionService],
  exports: [LocalPersistenceService, StoreService, AuthSessionService],
})
export class CommonModule {}
