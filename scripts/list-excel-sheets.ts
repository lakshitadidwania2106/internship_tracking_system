import fs from "node:fs";
import path from "node:path";
import * as xlsx from "xlsx";

const root = path.join(process.cwd(), "data", "imports", "excel");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.xlsx?$/i.test(entry.name)) out.push(full);
  }
  return out;
}

for (const file of walk(root)) {
  const wb = xlsx.readFile(file);
  console.log("\n" + path.relative(root, file));
  console.log("  sheets:", wb.SheetNames.join(" | "));
}
