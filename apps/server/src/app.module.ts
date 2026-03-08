import { Module } from "@nestjs/common";
import { AuthModule } from "./auth/auth.module";
import { BattleModule } from "./battle/battle.module";
import { CareModule } from "./care/care.module";
import { CommonModule } from "./common/common.module";
import { ContentModule } from "./content/content.module";
import { PetModule } from "./pet/pet.module";
import { PremiumModule } from "./premium/premium.module";
import { ReplayModule } from "./replay/replay.module";

@Module({
  imports: [
    CommonModule,
    AuthModule,
    ContentModule,
    PetModule,
    CareModule,
    BattleModule,
    PremiumModule,
    ReplayModule,
  ],
})
export class AppModule {}
