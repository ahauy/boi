import { ClientSession, Model, Types } from 'mongoose';
import { DeviceDocument } from '../schemas/device.schema';

/**
 * Quà VIP hằng ngày chỉ nhận một lần mỗi thiết bị mỗi ngày, theo cùng mẫu `checkinDay`/`checkinUserId`.
 * Không có nó, xoá tài khoản rồi khôi phục VIP trên tài khoản mới trong cùng ngày sẽ nhận quà lần nữa.
 * Tài khoản không có `deviceIdHash` (hoặc thiết bị chưa có bản ghi) giữ hành vi cũ: chỉ giới hạn theo tài khoản.
 */
export async function isVipDailyBlockedByDevice(
  deviceModel: Model<DeviceDocument>,
  deviceIdHash: string | null | undefined,
  userId: Types.ObjectId,
  rewardDay: string,
  session?: ClientSession,
): Promise<boolean> {
  if (!deviceIdHash) return false;
  const device = await deviceModel
    .findOne({ deviceIdHash })
    .select('vipDailyDay vipDailyUserId')
    .session(session ?? null)
    .lean();
  return Boolean(
    device &&
      device.vipDailyDay === rewardDay &&
      device.vipDailyUserId &&
      device.vipDailyUserId.toString() !== userId.toString(),
  );
}

export async function markVipDailyOnDevice(
  deviceModel: Model<DeviceDocument>,
  deviceIdHash: string | null | undefined,
  userId: Types.ObjectId,
  rewardDay: string,
  session?: ClientSession,
): Promise<void> {
  if (!deviceIdHash) return;
  await deviceModel.updateOne(
    { deviceIdHash },
    { $set: { vipDailyDay: rewardDay, vipDailyUserId: userId } },
    { session },
  );
}
