# Public student registration

- `/signup`: student name, parent name, contact email, unique username, WhatsApp country code/number, country, duration, time, weekdays and password. A live package and monthly price preview follows the selected duration and weekdays. Billing-cycle selection remains staff-only.
- `/login`: shared login for students, teachers and staff. Staff and teacher accounts remain administrator-managed; public requests can only create the `STUDENT` role.
- `/enrollment`: a signed-in student can see approval status and their preferred schedule. Active students can open their own profile.
- Families choose their local time, local weekdays, country-linked IANA time zone and preferred start date. A server-generated preview converts the first class week to Bangladesh time, shifting weekdays and the first class date when necessary. Admin schedule fields and staff emails use the converted Bangladesh values; original preferences are retained on the student profile.
- The existing recurring schedule remains fixed in Bangladesh time. Staff must review it when the family's daylight-saving offset changes; registration does not silently reschedule existing lessons. Nonexistent/ambiguous local times and a first week spanning two different Bangladesh times are rejected with a corrective message. Classes crossing Bangladesh midnight remain unsupported by the existing schedule editor.
- Registration leaves the package and monetary billing fields unset and ignores submitted billing, role, tutor and status fields. Staff configure the package and billing cycle in the existing student editor when assigning a tutor. The schema's internal monthly-cycle default is not a parent selection or an agreed billing plan.

## Staff review

New students are saved as `NEW_SIGN_UP`, without a tutor or confirmed schedule. Account creation, student creation, audit event and staff email are one database transaction. Nothing is billed or scheduled at registration.

Admins and managers (the existing `MODERATOR` role) see a persistent registration alert in the dashboard. Open **Review registration**, verify the parent's contact details, change status to **Active**, assign a tutor and set the class start date. The existing schedule workflow then applies. The alert clears once the student leaves New Sign-up status.

Approval is checked on every API request, not only in the browser. Pending/inactive students can access their enrollment status, but cannot access dashboard data or self-approve. Students sign in with their unique username; siblings may use the same parent email. Students cannot change or reset their own username or password after registration. An administrator updates credentials in Edit Student. Email ownership is not automatically verified; staff must verify contact details during approval.

## Email and deployment

The existing email outbox retries delivery to active Super Admin, Admin and Moderator accounts, plus configured manager/fallback addresses. Enable SMTP using `EMAIL_SETUP.md`. With email disabled, registrations and in-app alerts still work; queued emails wait for SMTP to be enabled. Never use public placeholder addresses for staff accounts.

Keep the backend worker running. Run `npx prisma migrate deploy` to install the student-role data migration, then restart the backend after installing dependencies. The migration preserves existing staff roles and ensures student read access to their scoped records.

Public registration is limited to 10 attempts per IP per hour and login to 30 failed attempts per IP per 15 minutes. The default limiter store is per process. Configure a shared store or equivalent gateway limits before running multiple backend instances. Behind a reverse proxy, set `TRUST_PROXY_HOPS` to the exact trusted hop count and prevent direct access that bypasses that proxy. Do not trust arbitrary forwarded IP headers.

## Tests

- `npm test`: validation, server-owned pricing, pending-access restrictions, and signup rate limiting.
- `npx tsx src/scripts/test-registration.ts`: real database registration, linked role, password hashing, outbox/audit atomicity and approval linkage. Test data is rolled back; no email is sent.
