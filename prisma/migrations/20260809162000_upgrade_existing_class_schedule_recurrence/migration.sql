WITH recurring_groups AS (
  SELECT
    "recurrenceGroupId",
    ARRAY_AGG(DISTINCT ((EXTRACT(DOW FROM "scheduledDate")::INTEGER + 6) % 7)) AS "repeatDays",
    COUNT(DISTINCT "scheduledDate"::DATE) AS "dateCount"
  FROM "ClassScheduleEvent"
  WHERE "recurrenceGroupId" IS NOT NULL
  GROUP BY "recurrenceGroupId"
),
series_sources AS (
  SELECT DISTINCT ON (event."recurrenceGroupId", event."studentId")
    event."id",
    group_info."repeatDays"
  FROM "ClassScheduleEvent" event
  INNER JOIN recurring_groups group_info
    ON group_info."recurrenceGroupId" = event."recurrenceGroupId"
  WHERE group_info."dateCount" > 1
  ORDER BY event."recurrenceGroupId", event."studentId", event."scheduledDate" ASC, event."createdAt" ASC
)
UPDATE "ClassScheduleEvent" event
SET
  "isRecurring" = true,
  "repeatDays" = source."repeatDays",
  "repeatIndefinitely" = true
FROM series_sources source
WHERE event."id" = source."id";
