import { Module } from "@nestjs/common";
import { ReplayController } from "./replay.controller";

@Module({
  controllers: [ReplayController],
})
export class ReplayModule {}
