# dmdashboard-backend

Server-side API for the DM Dashboard built with Node.js, Express.js, TypeScript, Prisma, and PostgreSQL.

The dashboard will manage students, their parent details, course information, group class details, teacher change history, and later role management.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment file:

   ```bash
   cp .env.example .env
   ```

3. Update `DATABASE_URL` in `.env`.

4. Generate Prisma Client:

   ```bash
   npm run prisma:generate
   ```

5. Run the first migration:

   ```bash
   npm run prisma:migrate -- --name init
   ```

6. Start development server:

   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` - start the development server with watch mode
- `npm run build` - compile TypeScript to `dist`
- `npm start` - run the compiled server
- `npm run prisma:generate` - generate Prisma Client
- `npm run prisma:migrate` - create and run a Prisma migration
- `npm run prisma:studio` - open Prisma Studio

## API

- `GET /api/v1/health`
- `GET /api/v1/users`
- `POST /api/v1/users`

## Student Module

Students are stored in the `Student` table. Course information is stored in a separate `StudentCourse` table because one student can have multiple courses. Teacher change history is stored in `TeacherChange` because one student can change teachers many times and every change must be saved.

### Student Fields

- `image` - optional image URL or uploaded image path
- `name` - student name
- `country` - student country
- `studentSince` - date string, for example `2026-06-23`
- `weeklySchedule` - schedule text
- `parentName`
- `parentEmail`
- `parentPhone`
- `groupClassSchedule`
- `groupTeacher`
- `subject`
- `courses` - array of course records
- `teacherChanges` - array of teacher change records

### Student API

- `POST /api/v1/students` - create student
- `GET /api/v1/students` - get all students
- `GET /api/v1/students/:id` - get one student
- `PATCH /api/v1/students/:id` - update student
- `DELETE /api/v1/students/:id` - delete student

### Create Student Example

```json
{
  "image": "https://example.com/student.jpg",
  "name": "John Doe",
  "country": "Bangladesh",
  "studentSince": "2026-06-23",
  "weeklySchedule": "Sunday and Tuesday 8 PM",
  "parentName": "Jane Doe",
  "parentEmail": "parent@example.com",
  "parentPhone": "+8801711111111",
  "courses": [
    {
      "courseInformation": "Quran Recitation",
      "courseStage": "Beginner"
    }
  ],
  "groupClassSchedule": "Friday 9 PM",
  "groupTeacher": "Teacher A",
  "subject": "Quran",
  "teacherChanges": [
    {
      "previousTeacherName": "Teacher Old",
      "newTeacherName": "Teacher A",
      "changingReason": "Schedule conflict",
      "changedAt": "2026-06-23"
    }
  ]
}
```

### Response Shape

```json
{
  "success": true,
  "data": {
    "id": "student_id",
    "name": "John Doe",
    "courses": [],
    "teacherChanges": []
  }
}
```

## Next Work

- Add authentication and role management.
- Add proper request validation.
- Add image upload storage.
- Expand course management into a full course module if courses need their own lifecycle.
# dmdashboard-backend
