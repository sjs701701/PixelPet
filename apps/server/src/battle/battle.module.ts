import { Module } from "@nestjs/common";
import { BattleController } from "./battle.controller";
import { BattleGateway } from "./battle.gateway";
import { BattleService } from "./battle.service";
import { PetModule } from "../pet/pet.module";

@Module({
  imports: [PetModule],
  controllers: [BattleController],
  providers: [BattleService, BattleGateway],
})
export class BattleModule {}
