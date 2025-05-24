// app/api/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { parsePdf, parseDocx, parseTxt } from "@/lib/parsers"; // You’ll make this next

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, file.name);
  await writeFile(filePath, buffer);

  const ext = path.extname(file.name).toLowerCase();
  let content = "";

  if (ext === ".pdf") {
    content = await parsePdf(filePath);
  } else if (ext === ".docx") {
    content = await parseDocx(filePath);
  } else if (ext === ".txt") {
    content = await parseTxt(filePath);
  } else {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 415 });
  }

  return NextResponse.json({
    message: "File uploaded and parsed successfully",
    filename: file.name,
    content,
  });
}
