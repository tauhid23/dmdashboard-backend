INSERT INTO "Role" ("id", "code", "name", "description", "isSystem", "createdAt", "updatedAt")
SELECT 'public-student-role', 'STUDENT',
  CASE WHEN EXISTS (SELECT 1 FROM "Role" WHERE "name" = 'Student') THEN 'Student Portal' ELSE 'Student' END,
  'Student self-service access', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Role" WHERE "code" = 'STUDENT');

INSERT INTO "Permission" ("id", "resource", "action", "code", "description")
SELECT 'public-student-' || resource || '-view', resource, 'view', resource || ':view', 'View own student records'
FROM unnest(ARRAY['students', 'class-reports', 'exams', 'results']) AS resource
ON CONFLICT ("resource", "action") DO NOTHING;

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."code" = 'STUDENT' AND p."action" = 'view'
AND p."resource" IN ('students', 'class-reports', 'exams', 'results')
ON CONFLICT DO NOTHING;
