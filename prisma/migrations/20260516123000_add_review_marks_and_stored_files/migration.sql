-- AlterTable
ALTER TABLE "SemesterRecord" ADD COLUMN "reviewCount" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "StudentReviewMark" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "studentId" INTEGER NOT NULL,
    "reviewNumber" INTEGER NOT NULL,
    "rowJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentReviewMark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentReviewMark_studentId_reviewNumber_key" ON "StudentReviewMark"("studentId", "reviewNumber");

-- CreateTable
CREATE TABLE "StoredFile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kind" TEXT NOT NULL,
    "batchYear" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT,
    "contentType" TEXT,
    "byteSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
