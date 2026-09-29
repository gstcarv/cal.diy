import type { PrismaClient } from "@calcom/prisma";
import { ConflictCheckScope } from "@calcom/prisma/enums";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingRepository } from "./BookingRepository";

describe("BookingRepository", () => {
  let repository: BookingRepository;
  let mockPrismaClient: {
    $queryRaw: ReturnType<typeof vi.fn>;
    booking: { findMany: ReturnType<typeof vi.fn> };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrismaClient = {
      $queryRaw: vi.fn(),
      booking: { findMany: vi.fn().mockResolvedValue([]) },
    };

    repository = new BookingRepository(mockPrismaClient as unknown as PrismaClient);
  });

  describe("getTotalBookingDuration", () => {
    it("should return total minutes from the database result", async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ totalMinutes: 120 }]);

      const result = await repository.getTotalBookingDuration({
        eventId: 52,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
      });

      expect(result).toBe(120);
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it("should return 0 when totalMinutes is null", async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ totalMinutes: null }]);

      const result = await repository.getTotalBookingDuration({
        eventId: 52,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
      });

      expect(result).toBe(0);
    });

    it("should call query when rescheduleUid is provided", async () => {
      mockPrismaClient.$queryRaw.mockResolvedValue([{ totalMinutes: 90 }]);

      const result = await repository.getTotalBookingDuration({
        eventId: 52,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        rescheduleUid: "existing-booking-uid",
      });

      expect(result).toBe(90);
      expect(mockPrismaClient.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });

  describe("findAllExistingBookingsForEventTypeBetween", () => {
    const baseParams = {
      eventTypeId: 42,
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-02T00:00:00Z"),
      userIdAndEmailMap: new Map([[1, "user@example.com"]]),
    };

    it("does not filter by eventTypeId when scope is USER (default)", async () => {
      await repository.findAllExistingBookingsForEventTypeBetween(baseParams);

      // queryOne (userId) is the first findMany call
      const firstWhere = mockPrismaClient.booking.findMany.mock.calls[0][0].where;
      expect(firstWhere.eventTypeId).toBeUndefined();
    });

    it("filters by eventTypeId when scope is EVENT_TYPE", async () => {
      await repository.findAllExistingBookingsForEventTypeBetween({
        ...baseParams,
        conflictCheckScope: ConflictCheckScope.EVENT_TYPE,
      });

      const firstWhere = mockPrismaClient.booking.findMany.mock.calls[0][0].where;
      expect(firstWhere.eventTypeId).toBe(42);
    });

    it("ignores EVENT_TYPE scope when no eventTypeId is provided", async () => {
      await repository.findAllExistingBookingsForEventTypeBetween({
        ...baseParams,
        eventTypeId: undefined,
        conflictCheckScope: ConflictCheckScope.EVENT_TYPE,
      });

      const firstWhere = mockPrismaClient.booking.findMany.mock.calls[0][0].where;
      expect(firstWhere.eventTypeId).toBeUndefined();
    });
  });
});
