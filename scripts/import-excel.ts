import "dotenv/config";
import path from "node:path";
import { importAllRepositoryExcel } from "../src/lib/importer";
import { prisma } from "../src/lib/prisma";

const excelRoot = path.join(process.cwd(), "data", "imports", "excel");

async function main() {
  console.log("Internship Excel import");
  console.log("Scanning:", excelRoot);
  console.log("");

  const result = await importAllRepositoryExcel(excelRoot);

  console.log("--- Per sheet ---");
  for (const sheet of result.sheetResults) {
    console.log(
      `  ${sheet.fileName} [${sheet.sheetName}]: imported ${sheet.imported}/${sheet.rowsRead} rows (${sheet.uniqueUsnsTouched} USNs), skipped ${sheet.skippedNoUsn}`,
    );
  }

  console.log("");
  console.log("--- Summary ---");
  console.log(`Files scanned:        ${result.filesScanned}`);
  console.log(`Sheets processed:     ${result.sheetsProcessed}`);
  console.log(`Rows read:            ${result.rowsRead}`);
  console.log(`Rows imported:        ${result.rowsImported}`);
  console.log(`Rows skipped (no USN): ${result.skippedNoUsn}`);
  console.log(`Unique USNs touched:  ${result.uniqueUsnsTouched}`);
  console.log(`Total students in DB: ${result.totalStudentsInDb}`);
  console.log("");
  console.log("Open Prisma Studio: npx prisma studio");
  console.log("Verify chatbot with a USN from the list above.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Import failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
