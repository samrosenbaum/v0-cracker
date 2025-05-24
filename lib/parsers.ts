import fs from "fs/promises";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export async function parsePdf(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const result = await pdfParse(buffer);
  return result.text.trim();
}

export async function parseDocx(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export async function parseTxt(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, "utf-8");
  return content.trim();
}
