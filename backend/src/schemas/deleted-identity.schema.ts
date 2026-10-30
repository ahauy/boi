import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DeletedIdentityKind } from '@palmsight/shared';

@Schema({
  collection: 'deleted_identities',
  timestamps: false,
})
export class DeletedIdentity {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, enum: Object.values(DeletedIdentityKind) })
  kind: DeletedIdentityKind;

  @Prop({ type: String, required: true, trim: true })
  valueHmac: string;

  @Prop({ type: Date, required: true, default: Date.now })
  deletedAt: Date;
}

export type DeletedIdentityDocument = HydratedDocument<DeletedIdentity>;
export const DeletedIdentitySchema =
  SchemaFactory.createForClass(DeletedIdentity);

// Indexes according to database-erd.md:
// - { valueHmac: 1 } unique
DeletedIdentitySchema.index({ valueHmac: 1 }, { unique: true });
