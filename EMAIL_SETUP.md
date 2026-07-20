# SMTP email setup

The email layer is disabled by default. It validates configuration only when
`EMAIL_ENABLED=true`, so local development can run without an SMTP account.

## Configure

Copy the email variables from `.env.example` into `.env`, then replace every
placeholder with values from your mail provider.

- Port `587`: set `SMTP_SECURE=false` (STARTTLS).
- Port `465`: set `SMTP_SECURE=true` (implicit TLS).
- Keep `SMTP_REQUIRE_TLS=true` in normal environments.
- Use an app password or provider SMTP credential, not your normal mailbox
  password. Never commit `.env`.
- `EMAIL_FROM_ADDRESS` must normally be a sender/domain approved by the provider.
- Put one or more admin addresses in `ADMIN_NOTIFICATION_EMAILS`, separated by
  commas.

For Gmail, enable two-step verification and use a Google app password. For a
transactional provider, use the exact SMTP host, port, username, and password
shown in its dashboard.

## Verify without sending

Run:

```sh
npm run email:verify
```

This checks the SMTP connection, TLS negotiation, and authentication. It does
not send an email.

## Use in an application event

Resolve the target teacher's email from the database, then call the helper only
after the related database change succeeds:

```ts
await sendEmailToTeacherAndAdmins(teacher.email, {
  subject: "Student record updated",
  text: `The record for ${student.name} was updated.`,
  html: `<p>The record for <strong>${student.name}</strong> was updated.</p>`
});
```

The teacher is the primary recipient and configured admins are copied. For
production-grade event delivery, the next step should use a background job/outbox
with retry handling so an SMTP outage does not fail the user's API request.
