# Email setup

The backend sends invoice PDFs to parents and queues staff alerts when a class report is created, an exam is scheduled, or an exam is submitted. Active Admin and Super Admin accounts receive staff alerts. Additional manager addresses can be saved in Settings > Email alerts.

## Get SMTP credentials

Use an email provider that permits SMTP sending. For regular parent invoices, a transactional provider with a verified sender/domain is a good fit. These are two supported examples:

| Provider | Where to get credentials | Host / port | SMTP username | SMTP password |
| --- | --- | --- | --- | --- |
| Brevo | Settings > SMTP & API > SMTP; generate an SMTP key | `smtp-relay.brevo.com` / `587` | The SMTP login shown there | The new SMTP key, **not** your Brevo account password or API key |
| Gmail | Google Account > Security > 2-Step Verification > App passwords (if available for your account) | `smtp.gmail.com` / `587` | Your full Gmail address | A dedicated app password, **not** your normal Google password |

For Brevo, also add and verify the address used in `EMAIL_FROM_ADDRESS` under Senders, or authenticate its domain. The SMTP login and visible From address can be different. If your Google account does not offer app passwords, use a provider with SMTP credentials instead.

Provider references: [Brevo SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), [Brevo SMTP keys](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys), [Brevo sender verification](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email), [Gmail SMTP ports](https://developers.google.com/workspace/gmail/imap/imap-smtp), [Google app passwords](https://support.google.com/mail/answer/185833).

## Configure SMTP

Add the email variables from `.env.example` to the backend `.env` (or production secret manager), then replace the placeholders with credentials from your mail provider. Do not commit credentials.

- Set `EMAIL_ENABLED=true`.
- Set `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASSWORD` to the provider's SMTP values. Use an app password or SMTP token where required.
- For port 587, use `SMTP_PORT=587`, `SMTP_SECURE=false`, and `SMTP_REQUIRE_TLS=true` (STARTTLS).
- For port 465, use `SMTP_PORT=465`, `SMTP_SECURE=true`, and `SMTP_REQUIRE_TLS=true` (implicit TLS).
- Set `EMAIL_FROM_ADDRESS` to a verified sender address/domain and `EMAIL_FROM_NAME` to the sender name parents should see.
- Optionally set `ADMIN_NOTIFICATION_EMAILS` for a shared admin mailbox or distribution list. Active admin user emails are included automatically.
- Replace the seeded `admin@admin.com` account email with a real inbox; that placeholder is excluded from alert delivery.

The fields to prepare are the provider name, SMTP host, port, SMTP username, verified From address, and the real admin/manager recipient addresses. Keep `SMTP_PASSWORD` private: put it directly in the backend `.env` or production secret manager, not in chat, a ticket, or `.env.example`.

The SMTP credentials are read only by the backend process. They are never returned through Settings or stored in the application database.

## Verify

Restart the backend after changing `.env`. Run `npm run email:verify` from `dmdashboard-backend`; it checks the SMTP login and confirms at least one real staff alert recipient exists, without sending a message. Settings > Email alerts > Verify connection checks SMTP only. Once connected, create an invoice for a controlled test family address to verify actual delivery and the PDF attachment.

## Delivery behavior

- On the 2nd of a billing month (Dhaka time), the backend creates one draft invoice per eligible family. Monthly packages are due monthly; quarterly packages are due every three months from their confirmed class-start month. The worker can recover a missed 2nd on the 3rd, but does not generate late-month invoices automatically.
- Scheduled drafts are emailed with their PDF from the 3rd. An admin can open the PDF, edit the recipient and full email, and send any draft earlier. Manually created invoices are drafts and are not scheduled for automatic sending.
- Automatic email requires a valid parent address and working SMTP. A missing address leaves the draft unsent for admin correction; delivery failures retry later. An invoice sent manually is skipped by the automatic sender.
- Class report, scheduled exam, and completed exam alerts are recorded with the database change and sent by a background worker. The worker checks every 30 seconds and retries failures with backoff. Replaying an exam submission with the same idempotency key does not queue another alert.
- Staff alert recipients are taken from active Admin and Super Admin accounts, the optional environment distribution list, and manager addresses in Settings. Email alerts include the student's name and event details; parent addresses are not used for these staff alerts.
- Deploy database migrations before starting the updated backend: `npx prisma migrate deploy`.

The backend process must be running on the 2nd and 3rd for the timetable to execute. Run a single backend worker instance or keep the database migration and unique invoice keys in place when deploying multiple instances. The parent email template is editable under Settings > Invoices; the template is copied into each generated draft so later settings changes do not silently rewrite an existing invoice.
