# Excel import folder

Place your internship marks workbooks here, then run:

```bash
npm run import:excel
```

Place workbooks in either:

- `data/imports/excel/`
- `data/imports/excel/2020/` (batch 2020, semester 8)
- `data/imports/excel/2021/` (batch 2021, semester 6)

The import script resolves paths with `process.cwd()` and matches filenames case-insensitively (including accidental `.xlsx.xlsx` double extensions).

2021 examples (semester is **detected** from sheet text — VIII/8 → sem 8, VI/6 → sem 6):

- `INTERNSHIP EVALUATION SHEET.xlsx` — sheets: DETAILS, Marks Evaluation, Final Marks, Review 1
- `21INT68-intership marks 2021.xlsx` — sheets: REVIEW 1, REVIEW 2 (often Semester VIII in sheet body)
- `21INT68-intership sem6 final marks 2021.xlsx` — sheet: Sheet1 (explicit sem 6 in filename)
- `21INT82- … sem 8 …` workbooks — semester 8

After import, use **Batch 2021** with **Semester 6** or **Semester 8** in the portal to match where each student was stored.

See `scripts/import-excel.ts` for the full import map.

Or upload via **Data Management** in the portal (Review 1–3, final marks).
