import { NextResponse } from "next/server";

import {
  getIndexNowKey,
  isIndexNowKeyFileRequest,
} from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";

/**
 * Serves IndexNow key verification at `/{INDEXNOW_KEY}.txt` (root).
 * Static marketing routes take precedence; only unmatched `*.txt` paths hit this handler.
 */
export async function GET(
  _req: Request,
  context: { params: { indexnowKeyFile: string } }
): Promise<NextResponse> {
  const fileName = context.params.indexnowKeyFile;
  if (!fileName.endsWith(".txt") || !isIndexNowKeyFileRequest(fileName)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const key = getIndexNowKey();
  if (!key) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(key, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}