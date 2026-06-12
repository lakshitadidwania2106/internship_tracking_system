import "dotenv/config";
import { prisma } from "../src/lib/prisma";

/** Remove all imported student data but keep admin emails and batch/semester structure. */
async function main() {
  await prisma.studentDocument.deleteMany();
  await prisma.storedFile.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.studentReviewMark.deleteMany();
  await prisma.outcomeMapping.deleteMany();
  await prisma.internship.deleteMany();
  await prisma.student.deleteMany();
  console.log("Cleared all students, internships, marks, and import history.");
  console.log("Allowed emails and batch/semester records were kept.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
