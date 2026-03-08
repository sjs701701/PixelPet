import { Module } from "@nestjs/common";
import { PetModule } from "../pet/pet.module";
import { CareController } from "./care.controller";
import { CareService } from "./care.service";

@Module({
  imports: [PetModule],
  controllers: [CareController],
  providers: [CareService],
})
export class CareModule {}
