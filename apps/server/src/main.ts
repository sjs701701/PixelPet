import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const express = require("express");
  const app = await NestFactory.create(AppModule, { cors: true });
  app.enableCors();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  await app.listen(3001);
}

bootstrap();
