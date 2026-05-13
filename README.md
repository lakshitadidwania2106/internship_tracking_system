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

## Importing Your Excel Files

Place your files in:

- `data/imports/excel/2020_sem8.xlsx`
- `data/imports/excel/2021_sem4.xlsx`
- `data/imports/excel/2021_sem6.xlsx`

Then run:

```bash
npm run import:excel
```

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

## Teacher Chatbot (Ollama + DB)

- Floating chatbot button appears on the dashboard.
- It answers direct internship questions using database records first.
- If needed, it falls back to local Ollama (`http://127.0.0.1:11434`) for concise summaries.

Examples:
- `What internship company did 1DS21AI001 do?`
- `What is the stipend of Amit A?`
- `Show mapping for 1DS20AI024`

Optional environment variable:

```bash
OLLAMA_MODEL=llama3.2
```
