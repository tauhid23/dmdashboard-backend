import moment from "moment-timezone";

export const countryTimeZones = (country: string) => moment.tz.zonesForCountry(country) ?? [];
export const allTimeZones = moment.tz.names();
const invalid = (message: string) => Object.assign(new Error(message), { statusCode: 422, code: "VALIDATION_ERROR" });

export const convertRegistrationSchedule = (raw: unknown) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw invalid("Enter your class preferences.");
  const body = raw as Record<string, unknown>;
  const timeZone = typeof body.timeZone === "string" ? body.timeZone : "";
  const countryZones = countryTimeZones(typeof body.country === "string" ? body.country : "");
  const zone = moment.tz.zone(timeZone);
  if (!zone || (countryZones.length && !countryZones.includes(timeZone))) throw invalid("Choose a time zone for your country.");
  const time = typeof body.classStartTime === "string" ? body.classStartTime : "";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw invalid("Enter a valid local class time.");
  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const start = moment.utc(startDate, "YYYY-MM-DD", true);
  if (!start.isValid() || start.year() < 2020 || start.year() > 2100) throw invalid("Choose a valid preferred start date.");
  if (!Array.isArray(body.classDays) || !body.classDays.length || body.classDays.length > 7
    || body.classDays.some((day) => typeof day !== "number" || !Number.isInteger(day) || day < 0 || day > 6)) throw invalid("Choose valid local weekdays.");
  const days = [...new Set(body.classDays as number[])].sort();
  const duration = body.classDurationMinutes;
  if (typeof duration !== "number" || ![30, 45, 60].includes(duration)) throw invalid("Choose a class duration of 30, 45 or 60 minutes.");
  const converted: { date: string; day: number; time: string }[] = [];
  for (let offset = 0; offset < 7; offset += 1) {
    const date = start.clone().add(offset, "days");
    if (!days.includes(date.isoWeekday() - 1)) continue;
    const local = `${date.format("YYYY-MM-DD")} ${time}`;
    const wallTime = moment.utc(local, "YYYY-MM-DD HH:mm", true).valueOf();
    // Enumerate possible offsets so neither skipped nor duplicated DST times are silently changed.
    const candidates = [...new Set(zone.offsets)].map((minutes) => wallTime + minutes * 60_000)
      .filter((instant) => moment.tz(instant, timeZone).format("YYYY-MM-DD HH:mm") === local);
    if (candidates.length !== 1) throw invalid(`The local time ${local} is ${candidates.length ? "ambiguous" : "unavailable"} because of a clock change. Choose another time or start date.`);
    const bd = moment.tz(candidates[0], "Asia/Dhaka");
    if (bd.hours() * 60 + bd.minutes() + duration > 1440) throw invalid("This class would cross midnight in Bangladesh. Choose an earlier or later local time.");
    converted.push({ date: bd.format("YYYY-MM-DD"), day: bd.isoWeekday() - 1, time: bd.format("HH:mm") });
  }
  if (new Set(converted.map((item) => item.time)).size !== 1) throw invalid("Your first class week crosses a daylight-saving change. Choose a start date after the clock change so staff receive one consistent Bangladesh schedule.");
  return {
    classStartTime: converted[0].time,
    classDays: [...new Set(converted.map((item) => item.day))].sort(),
    classStartDate: new Date(`${converted[0].date}T00:00:00Z`),
    preferredTimeZone: timeZone, preferredLocalTime: time, preferredLocalDays: days,
    preferredStartDate: start.toDate(),
  };
};
