export const MAKEUP_RATE_BDT = 500;
const OFFSET = 6 * 60 * 60_000;

export const makeupPeriod = (date: Date) => {
  const local = new Date(date.getTime() + OFFSET);
  const year = local.getUTCFullYear();
  const half = local.getUTCMonth() < 6 ? 1 : 2;
  return {
    key: `${year}-H${half}`,
    expiresAt: new Date(Date.UTC(year, half === 1 ? 6 : 12, 1) - OFFSET),
  };
};

export const makeupAmount = (minutes: number) => Math.round(minutes * MAKEUP_RATE_BDT * 100 / 60) / 100;

export const remainingMinutes = (credit: {
  durationMinutes: number; adjustedMinutes: number;
  uses: { minutes: number; status: string }[];
}) => Math.max(0, credit.durationMinutes - credit.adjustedMinutes - credit.uses
  .filter((use) => use.status !== "RELEASED")
  .reduce((sum, use) => sum + use.minutes, 0));
