import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClassReportWhere,
  classReportMonthNames,
  parseClassReportFilters
} from "./classReport.service.js";

const expectBadRequest = (callback: () => unknown, messagePattern: RegExp) => {
  assert.throws(callback, (error: Error & { statusCode?: number }) => {
    assert.equal(error.statusCode, 400);
    assert.match(error.message, messagePattern);
    return true;
  });
};

void test("no query parameters preserve empty filters", () => {
  assert.deepEqual(parseClassReportFilters({}), {
    reportType: undefined,
    search: undefined,
    studentId: undefined,
    teacherId: undefined,
    month: undefined
  });
});

void test("search is trimmed and uses case-insensitive partial matching on every field", () => {
  const filters = parseClassReportFilters({ search: "  amina  " });
  const where = buildClassReportWhere(filters);
  const searchFilter = where?.AND?.[0];

  assert.equal(filters.search, "amina");
  assert.ok(searchFilter && "OR" in searchFilter);
  assert.equal(searchFilter.OR?.length, 6);
  assert.deepEqual(searchFilter.OR?.slice(0, 4), [
    { studentName: { contains: "amina", mode: "insensitive" } },
    { teacherName: { contains: "amina", mode: "insensitive" } },
    { teacherNote: { contains: "amina", mode: "insensitive" } },
    { adminNote: { contains: "amina", mode: "insensitive" } }
  ]);
});

void test("whitespace-only search behaves as no search", () => {
  const filters = parseClassReportFilters({ search: "   " });

  assert.equal(filters.search, undefined);
  assert.equal(buildClassReportWhere(filters), undefined);
});

void test("month, teacher, and student filters work independently", () => {
  assert.deepEqual(buildClassReportWhere(parseClassReportFilters({ month: "July" })), {
    AND: [{ month: "July" }]
  });
  assert.deepEqual(buildClassReportWhere(parseClassReportFilters({ teacherId: "42" })), {
    AND: [{ teacherId: "42" }]
  });
  assert.deepEqual(buildClassReportWhere(parseClassReportFilters({ studentId: "105" })), {
    AND: [{ studentId: "105" }]
  });
});

void test("search and structured filters combine with AND logic", () => {
  const where = buildClassReportWhere(
    parseClassReportFilters({
      search: "amina",
      month: "July",
      teacherId: "42",
      studentId: "105"
    })
  );

  assert.equal(where?.AND?.length, 4);
  assert.deepEqual(where?.AND?.slice(1), [
    { studentId: "105" },
    { teacherId: "42" },
    { month: "July" }
  ]);
});

void test("invalid IDs and months return clear 400 errors", () => {
  expectBadRequest(
    () => parseClassReportFilters({ teacherId: "not valid!" }),
    /teacherId must be a valid ID/
  );
  expectBadRequest(
    () => parseClassReportFilters({ studentId: ["1", "2"] }),
    /studentId must be supplied only once/
  );
  expectBadRequest(
    () => parseClassReportFilters({ month: "Jul" }),
    /month must be a valid month name/
  );
  assert.equal(classReportMonthNames.length, 12);
});
