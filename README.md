# DSCE AIML Internship Tracking Website

Web app for Dayananda Sagar College of Engineering (AIML) to track internship records by batch, semester, and USN.

## Features

- Dashboard UI inspired by the reference screenshots
- Batch and semester selection:
  - 2020 -> Semester 8
  - 2021 -> Semester 4 and Semester 6
- USN-based student search
- Internship details view (company, role, stipend, grade, dates, duration)
- CO-PO-PSO mapping panel
- Report soft-copy download endpoint
- Local-first backend with SQLite + Prisma
- Excel import script for later data upload

## Tech Stack

- Next.js (App Router) + TypeScript
- Prisma ORM + SQLite
- Tailwind CSS

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create and migrate the database:

```bash
npm run db:migrate
```

3. Seed demo data:

```bash
npm run db:seed
```

4. Run the web app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### If you see `The table main.Batch does not exist`

The app must use `prisma/dev.db` (not an empty `dev.db` in the project root).

1. Stop the dev server (Ctrl+C).
2. Run:

```bash
npm run db:deploy
npm run dev:clean
```

3. If `dev.db` in the project root still exists, delete it after stopping the server, then run `npm run dev` again.

## Importing Your Excel Files

Place Excel files under:

- `data/imports/excel/2020/` (2020 batch sheets)
- `data/imports/excel/2021/` (2021 batch sheets)

The import command scans all `.xlsx` / `.xls` / `.csv` files recursively, detects sheets with a USN column, normalizes USNs, and upserts students (safe duplicates via `usn` unique key).

```bash
npm run db:deploy
npm rebuild better-sqlite3
npm run import:excel
```

After import, the script prints **total students in DB** (expect 100+ when all batch sheets are present). Open Prisma Studio with `npx prisma studio` to verify.

## Upload From Website (Scalable for new years)

Use the `Settings` tab in the portal and open `Upload New Batch/Sem Data`.

- Upload Excel/CSV for new batches and semesters
- Enter batch year + semester + optional sheet/header/course info
- The system auto-creates missing batch/semester records and imports rows
- You can also upload report files (`.pdf`, `.doc`, `.docx`, `.txt`) for later USN-based download matching

## Linking Student Report Files

Place report/software-copy files in:

- `data/imports/reports/`

The current seeded demo links documents by file name. The download API route is:

- `/api/documents/:documentId`

## Future LLM Hook

A placeholder service boundary for future LLM features is available in:

- `src/lib/ai/internship-ai.ts`

Current mode supports direct database answers and optional local Ollama fallback.

## InternBot (ML CO/PO/PSO + DB + optional Ollama)

- Floating **InternBot** button on the dashboard (mint/navy DSCE theme).
- Uses a **multinomial Naive Bayes intent classifier** for CO / PO / PSO questions.
- Builds **per-student** outcome answers by intersecting each student's recorded PO/PSO list with the course CO–PO–PSO matrix in `src/lib/co-po-pso.ts`.
- Uses the currently selected student USN when you ask from the overview tab.
- Falls back to local Ollama (`http://127.0.0.1:11434`) for other internship questions when available.

Examples:
- `Show CO PO PSO mapping for 1DS21AI001`
- `What are the relevant POs for Adithya N Awati?`
- `Explain CO1 justification for this intern` (with a student selected on the dashboard)
- `What internship company did 1DS21AI001 do?`

Optional environment variable:

```bash
OLLAMA_MODEL=llama3.2
```
