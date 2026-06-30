# Maktab Dashboard — Backend API (Student Module)

This README is the implementation spec for the **Student** module of the Maktab dashboard backend. It describes the tech stack, database schema, relationships, and REST API that should be built. Role management and full course-enrollment (many-to-many) are intentionally out of scope for this phase — see "Future Scope" at the bottom.

---

## 1. Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **File upload:** Cloudinary
- **Validation:** Zod
- **Other:** cors, dotenv, morgan (logging)

---

## 2. Scope of This Phase

Build:
1. `Student` table + full CRUD API
2. `Course` table (basic — students reference one course each for now)
3. `TeacherChange` table — a **history log**, since a student can change teachers multiple times over their time in the program

Not built yet (planned, not now):
- Role-based auth (admin / teacher / staff)
- Many-to-many `Student <-> Course` enrollment (a student taking multiple courses at once)

---

## 3. Data Model

### 3.1 Student

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | auto | Primary key |
| `image` | String | optional | URL/path to uploaded photo |
| `name` | String | required | Student full name |
| `country` | String | required | |
| `studentSince` | DateTime | required | Date student joined |
| `weeklySchedule` | String | required | Free text, e.g. `"Sat, Mon, Wed - 5:00 PM"` |
| `parentName` | String | required | |
| `parentEmail` | String | required | Validated email format |
| `parentPhone` | String | required | |
| `courseId` | UUID (FK → Course) | optional | Which course this student is on |
| `courseStage` | String / Enum | optional | e.g. `NAZIRA`, `HIFZ`, `TAJWEED` (suggested enum — adjust if your stages differ) |
| `groupClassSchedule` | String | optional | Current group class timing |
| `groupTeacher` | String | optional | Current assigned teacher (name) |
| `subject` | String | optional | Current group class subject |
| `createdAt` / `updatedAt` | DateTime | auto | |

### 3.2 Course

A simple, standalone table for now — every student belongs to (at most) one course via `courseId`. This will later expand into a many-to-many enrollment model.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | auto | |
| `name` | String | required | e.g. "Hifz Program" |
| `description` | String | optional | |
| `createdAt` / `updatedAt` | DateTime | auto | |

### 3.3 TeacherChange (history)

Every time a student's group teacher changes, a new row is added here — never overwritten. This is how we keep the full history even though `Student.groupTeacher` only ever holds the *current* teacher.

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | UUID | auto | |
| `studentId` | UUID (FK → Student) | required | |
| `previousTeacher` | String | required | Name of the teacher being replaced |
| `newTeacher` | String | optional | Name of the incoming teacher (recommended to store, even though not explicitly requested — makes history readable) |
| `reason` | String | required | Why the change happened |
| `changedAt` | DateTime | auto (`now()`) | |

---

## 4. Relationships

- `Student.courseId` → `Course.id` (many students : one course)
- `Student.id` → `TeacherChange.studentId` (one student : many teacher-change records)

---

## 5. Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CourseStage {
  NAZIRA
  HIFZ
  TAJWEED
}

model Course {
  id          String    @id @default(uuid())
  name        String
  description String?
  students    Student[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Student {
  id                 String          @id @default(uuid())
  image              String?
  name               String
  country            String
  studentSince       DateTime
  weeklySchedule     String

  parentName         String
  parentEmail        String
  parentPhone        String

  courseId           String?
  course             Course?         @relation(fields: [courseId], references: [id])
  courseStage        CourseStage?

  groupClassSchedule String?
  groupTeacher       String?
  subject            String?

  teacherChanges     TeacherChange[]

  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt
}

model TeacherChange {
  id              String   @id @default(uuid())
  studentId       String
  student         Student  @relation(fields: [studentId], references: [id], onDelete: Cascade)
  previousTeacher String
  newTeacher      String?
  reason          String
  changedAt       DateTime @default(now())
}
```

---

## 6. API Endpoints

Base path: `/api`

### 6.1 Courses (basic CRUD)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/courses` | Create a course |
| GET | `/courses` | List all courses |
| GET | `/courses/:id` | Get one course |
| PUT | `/courses/:id` | Update a course |
| DELETE | `/courses/:id` | Delete a course |

### 6.2 Students

| Method | Endpoint | Description |
|---|---|---|
| POST | `/students` | Create a student (`multipart/form-data` — includes image file) |
| GET | `/students` | List students — supports `?search=`, `?country=`, `?courseId=`, `?page=`, `?limit=` |
| GET | `/students/:id` | Get one student, **including** `course` and `teacherChanges` (use Prisma `include`) |
| PUT | `/students/:id` | Update a student (`multipart/form-data` if image is replaced) |
| DELETE | `/students/:id` | Delete a student |

**Create/Update body fields** (besides the `image` file):
```json
{
  "name": "string",
  "country": "string",
  "studentSince": "2026-01-15",
  "weeklySchedule": "Sat, Mon, Wed - 5:00 PM",
  "parentName": "string",
  "parentEmail": "parent@email.com",
  "parentPhone": "string",
  "courseId": "uuid",
  "courseStage": "NAZIRA",
  "groupClassSchedule": "string",
  "groupTeacher": "string",
  "subject": "string"
}
```

### 6.3 Teacher Change History (nested under student)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/students/:id/teacher-changes` | Log a teacher change for this student |
| GET | `/students/:id/teacher-changes` | Get full teacher-change history for this student |

**POST body:**
```json
{
  "previousTeacher": "string",
  "newTeacher": "string",
  "reason": "string"
}
```

**Important business logic:** when this endpoint is called, do two things in a single Prisma transaction:
1. Insert a new `TeacherChange` row.
2. Update `Student.groupTeacher` to the `newTeacher` value, so the student record always reflects the *current* teacher while the full history stays intact in `TeacherChange`.

---

## 7. Suggested Folder Structure

```
project-root/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── uploads/
├── src/
│   ├── config/
│   │   └── db.ts
│   ├── controllers/
│   │   ├── student.controller.ts
│   │   ├── course.controller.ts
│   │   └── teacherChange.controller.ts
│   ├── routes/
│   │   ├── student.routes.ts
│   │   ├── course.routes.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── student.service.ts
│   │   ├── course.service.ts
│   │   └── teacherChange.service.ts
│   ├── middlewares/
│   │   ├── upload.middleware.ts
│   │   ├── error.middleware.ts
│   │   └── validate.middleware.ts
│   ├── validators/
│   │   ├── student.validator.ts
│   │   └── course.validator.ts
│   ├── types/
│   ├── utils/
│   ├── app.ts
│   └── server.ts
├── .env
├── .env.example
├── tsconfig.json
├── package.json
└── README.md
```

---

## 8. Environment Variables

```
DATABASE_URL=postgresql://user:password@localhost:5432/maktab_db
PORT=5000
NODE_ENV=development
UPLOAD_DIR=uploads

# reserved for future role management phase
JWT_SECRET=
```

---

## 9. Validation Rules

- `name`, `country`, `studentSince`, `weeklySchedule`, `parentName`, `parentEmail`, `parentPhone` are required on create.
- `parentEmail` must be a valid email format.
- `studentSince` must be a valid date.
- `courseStage` must match one of the `CourseStage` enum values if provided.
- On `POST /students/:id/teacher-changes`: `previousTeacher` and `reason` are required.
- Use Zod schemas in `validators/`, applied via a `validate.middleware.ts`.

---

## 10. Image Upload

- Use Multer with disk storage to `uploads/` for now.
- Store only the resulting file path/URL string on `Student.image`.
- Keep the upload logic isolated in `upload.middleware.ts` so swapping to Cloudinary/S3 later only touches one file.

---

## 11. Future Scope (not part of this phase)

- **Role management:** admin / teacher / staff roles with auth middleware (JWT-based, `JWT_SECRET` is already reserved in `.env`).
- **Many-to-many enrollment:** replace `Student.courseId` (single course) with a join table (`StudentCourse`) once a student can be enrolled in multiple courses at once.
- Possibly a similar history table for group class changes (not just teacher changes), if that need comes up.

---

## 12. Build Order for the Agent

1. Set up Prisma schema (section 5) and run initial migration.
2. Build `Course` CRUD first (it's the dependency for `Student.courseId`).
3. Build `Student` CRUD with image upload via Multer.
4. Build `TeacherChange` nested routes + the transaction logic described in section 6.3.
5. Wire up centralized error handling and Zod validation middleware across all routes.