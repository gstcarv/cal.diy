import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { test } from "./lib/fixtures";
import { bookTimeSlot } from "./lib/testUtils";

test.describe.configure({ mode: "parallel" });

test.afterEach(async ({ users }) => {
  await users.deleteAll();
});

// Opens the first available day of next month and returns the label of its first time slot,
// without selecting it. Mirrors selectFirstAvailableTimeSlotNextMonth but stops before booking.
async function openFirstAvailableDayNextMonth(page: Page): Promise<string> {
  const incrementMonth = page.getByTestId("incrementMonth");
  await incrementMonth.waitFor();
  await page.locator('[data-testid="day"][data-disabled="false"]').nth(0).waitFor();

  const scheduleResponse = page.waitForResponse(
    (resp) => resp.url().includes("getSchedule") && resp.status() === 200
  );
  await incrementMonth.click();
  await scheduleResponse;

  const firstAvailableDay = page.locator('[data-testid="day"][data-disabled="false"]').nth(0);
  await firstAvailableDay.waitFor();
  await firstAvailableDay.click();

  const firstTimeSlot = page.locator('[data-testid="time"]').nth(0);
  await firstTimeSlot.waitFor();
  return (await firstTimeSlot.textContent())?.trim() ?? "";
}

async function bookFirstTimeSlot(page: Page) {
  await page.locator('[data-testid="time"]').nth(0).click();
  await bookTimeSlot(page);
  await expect(page.locator("[data-testid=success-page]")).toBeVisible();
}

test.describe("Booking conflict check scope", () => {
  test("EVENT_TYPE scope ignores bookings from the user's other event types", async ({ page, users }) => {
    const user = await users.create({
      eventTypes: [
        { title: "Resource A", slug: "resource-a", length: 60 },
        { title: "Resource B", slug: "resource-b", length: 60, conflictCheckScope: "EVENT_TYPE" },
      ],
    });

    // Book the first available slot on Resource A.
    await page.goto(`/${user.username}/resource-a`);
    const bookedTime = await openFirstAvailableDayNextMonth(page);
    await bookFirstTimeSlot(page);

    // Resource B is EVENT_TYPE scoped, so Resource A's booking must not block it:
    // the very same slot is still offered and bookable at the same time.
    await page.goto(`/${user.username}/resource-b`);
    const offeredTime = await openFirstAvailableDayNextMonth(page);
    expect(offeredTime).toBe(bookedTime);
    await bookFirstTimeSlot(page);
  });

  test("USER scope blocks the slot across the user's other event types", async ({ page, users }) => {
    const user = await users.create({
      eventTypes: [
        { title: "Event C", slug: "event-c", length: 60 },
        { title: "Event D", slug: "event-d", length: 60 },
      ],
    });

    // Book the first available slot on Event C.
    await page.goto(`/${user.username}/event-c`);
    const bookedTime = await openFirstAvailableDayNextMonth(page);
    await bookFirstTimeSlot(page);

    // Event D uses the default USER scope, so Event C's booking blocks that slot:
    // the first offered time on the same day must differ from the one just booked.
    await page.goto(`/${user.username}/event-d`);
    const offeredTime = await openFirstAvailableDayNextMonth(page);
    expect(offeredTime).not.toBe(bookedTime);
  });
});
