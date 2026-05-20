import { NextResponse } from "next/server";
import { deleteStoredFileById } from "@/lib/batch-status";

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!id) {
    return NextResponse.json({ message: "Invalid file id." }, { status: 400 });
  }

  const deleted = await deleteStoredFileById(id);
  if (!deleted) {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }

  return NextResponse.json({
    message: "Stored file removed from storage and database. Re-upload from Data Management if needed.",
    deleted,
  });
}
