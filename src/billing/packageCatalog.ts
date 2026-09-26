export type BillingCycle = "MONTHLY" | "QUARTERLY";

export type StudentPackage = {
  code: string;
  durationMinutes: number | null;
  classesPerWeek: number | null;
  weeklyHours: number;
  monthlyPriceBdt: number;
  quarterlyPriceBdt: number;
  groupClass: boolean;
};

const timed = (
  durationMinutes: number,
  rows: Array<[string, number, number, number]>
): StudentPackage[] => rows.map(([code, classesPerWeek, monthlyPriceBdt, quarterlyPriceBdt]) => ({
  code,
  durationMinutes,
  classesPerWeek,
  weeklyHours: durationMinutes * classesPerWeek / 60,
  monthlyPriceBdt,
  quarterlyPriceBdt,
  groupClass: false
}));

export const studentPackages: StudentPackage[] = [
  ...timed(30, [["A", 2, 2800, 8000], ["B", 3, 4200, 11500], ["C", 4, 5500, 15500], ["D", 5, 6500, 18500], ["E", 6, 7500, 21500]]),
  ...timed(45, [["F", 2, 4200, 11500], ["G", 3, 6000, 17000], ["H", 4, 7500, 21500], ["I", 5, 9000, 26000], ["J", 6, 10500, 30500]]),
  ...timed(60, [["K", 1, 2800, 8000], ["L", 2, 5500, 15500], ["M", 3, 7500, 21500], ["N", 4, 9500, 27500], ["O", 5, 11500, 33500], ["P", 6, 13500, 39500]]),
  ...([1, 2, 3, 4, 5, 6] as const).map((classesPerWeek, index) => ({
    code: String.fromCharCode("Q".charCodeAt(0) + index), durationMinutes: 60,
    classesPerWeek, weeklyHours: classesPerWeek, monthlyPriceBdt: classesPerWeek * 3000,
    quarterlyPriceBdt: 6000, groupClass: true
  })),
  ...([
    ["W", 1.25, 3500, 10000], ["X", 1.75, 4800, 13500], ["Y", 2.75, 7000, 20000], ["Z", 3.25, 8000, 23000],
    ["Z1", 3.5, 8500, 24500], ["Z2", 4.25, 10000, 29000], ["Z3", 4.75, 11000, 32000], ["Z4", 5.25, 12000, 35000],
    ["Z5", 5.5, 12500, 36500], ["Z6", 5.75, 13000, 38000], ["Z7", 6.25, 14000, 41000], ["Z8", 6.5, 14500, 42500],
    ["Z9", 6.75, 15000, 44000], ["Z10", 7, 15800, 46500], ["Z11", 7.25, 16500, 48500], ["Z12", 7.5, 17000, 50000],
    ["Z13", 7.75, 17500, 51500], ["Z14", 8, 18000, 53000]
  ] as Array<[string, number, number, number]>).map(([code, weeklyHours, monthlyPriceBdt, quarterlyPriceBdt]) => ({
    code, durationMinutes: null, classesPerWeek: null, weeklyHours, monthlyPriceBdt, quarterlyPriceBdt, groupClass: false
  }))
];

export const findStudentPackage = (input: { durationMinutes?: number | null; classesPerWeek?: number | null; weeklyHours: number; groupClass?: boolean }) => {
  const exact = studentPackages.find((item) => item.groupClass === Boolean(input.groupClass) && item.durationMinutes === input.durationMinutes && item.classesPerWeek === input.classesPerWeek);
  if (exact) return exact;
  return studentPackages
    .filter((item) => !item.groupClass && item.durationMinutes === null)
    .sort((a, b) => Math.abs(a.weeklyHours - input.weeklyHours) - Math.abs(b.weeklyHours - input.weeklyHours))[0] ?? null;
};

export const packageAmount = (item: StudentPackage, cycle: BillingCycle) =>
  cycle === "QUARTERLY" ? item.quarterlyPriceBdt : item.monthlyPriceBdt;
