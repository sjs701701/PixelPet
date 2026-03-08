import { Global, Module } from "@nestjs/common";
import { AuthSessionService } from "./session.service";
import { StoreService } from "./store.service";

@Global()
@Module({
  providers: [StoreService, AuthSessionService],
  exports: [StoreService, AuthSessionService],
})
export class CommonModule {}
