import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  CreditTransaction,
  CreditTransactionSchema,
} from "../schemas/credit-transaction.schema";
import { User, UserSchema } from "../schemas/user.schema";
import { CreditLedgerService } from "./credit-ledger.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CreditTransaction.name, schema: CreditTransactionSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [CreditLedgerService],
  exports: [CreditLedgerService],
})
export class CreditsModule {}
