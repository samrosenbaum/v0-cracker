import { NextRequest, NextResponse } from "next/server";
import path from "path";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  try {
    // Dynamic imports to avoid build-time execution
    const { writeFile, mkdir } = await import("fs/promises");
    const { parsePdf, parseDocx, parseTxt } = await import("@/lib/parsers");

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

  } catch (error) {
    console.error("Parsing error:", error);
    return NextResponse.json({ error: "Failed to parse file." }, { status: 500 });
  }
}