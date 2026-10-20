import { buildLlmsTxt } from "@/lib/docs/discovery";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildLlmsTxt(process.env.HELLO_PUBLIC_URL || "http://localhost:3000"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
