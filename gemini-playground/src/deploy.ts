import { serve } from "https://deno.land/std/http/server.ts";
import { join } from "https://deno.land/std/path/mod.ts";

// 獲取當前文件的目錄路徑
const __dirname = new URL(".", import.meta.url).pathname;

// 靜態文件目錄
const STATIC_DIR = join(__dirname, "static");

// 處理靜態文件請求
async function serveStaticFile(path: string): Promise<Response> {
  try {
    const filePath = join(STATIC_DIR, path);
    const file = await Deno.readFile(filePath);
    const contentType = getContentType(path);
    return new Response(file, {
      headers: { "content-type": `${contentType};charset=UTF-8` },
    });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

// MIME類型映射
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// 獲取文件的MIME類型
function getContentType(path: string): string {
  const ext = "." + path.split(".").pop()?.toLowerCase() || "";
  return MIME_TYPES[ext] || "text/plain";
}

// 主要請求處理函數
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  let path = url.pathname;

  // 處理根路徑
  if (path === "/" || path === "/index.html") {
    path = "/index.html";
  }

  // 提供靜態文件服務
  return await serveStaticFile(path);
}

// 啟動服務器
serve(handleRequest, { port: 8000 });