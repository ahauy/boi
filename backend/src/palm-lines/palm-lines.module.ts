import { Module } from "@nestjs/common";
import { PalmLinesService } from "./palm-lines.service";

@Module({
  providers: [PalmLinesService],
  exports: [PalmLinesService],
})
export class PalmLinesModule {}
