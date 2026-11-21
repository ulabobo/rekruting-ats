import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const fileId = req.nextUrl.searchParams.get("file_id");
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!fileId || !token) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const metaRes = await fetch(
      `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`
    );
    const meta = await metaRes.json();
    const filePath = meta?.result?.file_path;
    if (!filePath) return new NextResponse("File not found", { status: 404 });

    const imgRes = await fetch(
      `https://api.telegram.org/file/bot${token}/${filePath}`
    );
    const buf = await imgRes.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": imgRes.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
