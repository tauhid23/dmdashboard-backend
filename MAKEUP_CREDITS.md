# Attendance make-up credits

- `ABSENT_ISSUE_MAKEUP_CREDIT` and `TUTOR_CANCELLED_ISSUE_MAKEUP_CREDIT` issue one credit using the original class duration. Other attendance labels do not issue credit.
- A make-up booking reserves available minutes, oldest credits first. Marking it present consumes them. Cancellation or absence releases them, without issuing a second credit.
- Make-up classes are individual bookings, not recurring schedules. They do not change the student's billing package.
- Credits are grouped by the missed class date in Asia/Dhaka: January-June and July-December. Unused minutes become a billing discount after June 30 / December 31 at BDT 500 per hour, rounded once per adjustment batch.
- The existing invoice worker checks on startup and every 30 minutes. Settlement runs before scheduled invoice creation and also before manual invoice creation. The backend must be running; missed checks catch up on restart.
- Reserved credits wait for attendance, even after cutoff. An unresolved booking cannot both receive a refund and fund a class. Late attendance can therefore result in a later adjustment.
- Adjustments use the processing date and appear on the next applicable invoice as `Make-up credit adjusted`, including credit count, minutes, hours, rate and period. Previously generated invoice snapshots are not rewritten.
- Used or adjusted source credits cannot be changed. Ledger-linked classes cannot be deleted; cancellation preserves their history. Adjustment transactions cannot be edited; billing corrections must be separate entries.
- Migration preserves existing issue-credit attendance and links historical make-up bookings oldest-first. Students with underfunded historical make-up bookings are held from automatic adjustment and flagged on student details for attendance review. No missing credits are invented.

## Verification

`npm test` covers period boundaries and duration calculations.

`npx tsx src/scripts/test-makeup-credits.ts` exercises the ledger against PostgreSQL inside a rolled-back transaction. It creates no lasting student, attendance or billing data.

`npx tsx src/scripts/audit-makeup-credits.ts` performs a read-only balance audit and reports historical bookings needing review.

Deploy schema changes with `npx prisma migrate deploy`, then regenerate the Prisma client and restart the backend.
