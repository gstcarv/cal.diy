import { v5 as uuidv5 } from "uuid";

import { Prisma } from "../client";
import { BookingStatus } from "../enums";

function generateIdempotencyKey({
  startTime,
  endTime,
  userId,
  eventTypeId,
  reassignedById,
}: {
  startTime: Date | string;
  endTime: Date | string;
  userId?: number;
  eventTypeId?: number | null;
  reassignedById?: number | null;
}) {
  const parts = [startTime.valueOf(), endTime.valueOf(), userId];
  if (eventTypeId) parts.push(`et${eventTypeId}`);
  if (reassignedById) parts.push(reassignedById);
  return uuidv5(parts.join("."), uuidv5.URL);
}

export function bookingIdempotencyKeyExtension() {
  return Prisma.defineExtension({
    query: {
      booking: {
        async create({ args, query }) {
          if (args.data.status === BookingStatus.ACCEPTED) {
            const idempotencyKey = generateIdempotencyKey({
              startTime: args.data.startTime,
              endTime: args.data.endTime,
              userId: args.data.user?.connect?.id,
              eventTypeId: args.data.eventTypeId ?? args.data.eventType?.connect?.id,
              reassignedById: args.data.reassignById,
            });
            args.data.idempotencyKey = idempotencyKey;
          }
          return query(args);
        },
        async update({ args, query }) {
          if (args.data.status === BookingStatus.CANCELLED || args.data.status === BookingStatus.REJECTED) {
            args.data.idempotencyKey = null;
          }
          return query(args);
        },
        async updateMany({ args, query }) {
          if (args.data.status === BookingStatus.CANCELLED || args.data.status === BookingStatus.REJECTED) {
            args.data.idempotencyKey = null;
          }
          return query(args);
        },
      },
    },
  });
}
