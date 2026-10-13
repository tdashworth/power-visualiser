import JSZip from "jszip";

export async function readZipEntry(zip: JSZip, path: string): Promise<string> {
  let entry = zip.file(path);
  if (!entry) {
    const lowerPath = path.toLowerCase();
    zip.forEach((relativePath, file) => {
      if (relativePath.toLowerCase() === lowerPath) entry = file;
    });
  }
  if (!entry) throw new Error(`Entry "${path}" not found in zip`);
  return entry.async("string");
}
