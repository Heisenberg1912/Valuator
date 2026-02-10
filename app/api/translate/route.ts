import { NextResponse } from "next/server";
import { z } from "zod";
import { generateVisionContent } from "@/lib/gemini";

const Body = z.object({
  language: z.string().min(2).max(64),
  texts: z.array(z.string().max(1200)).max(40)
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_REQUEST", issues: parsed.error.issues }, { status: 400 });
  }

  const language = parsed.data.language.trim();
  const texts = parsed.data.texts.map((value) => value.replace(/\s+/g, " ").trim());
  if (!texts.length || /^english$/i.test(language)) {
    return NextResponse.json({ items: texts });
  }

  try {
    const prompt = `
Translate each text into ${language}.
Keep meaning and tone concise.
Preserve all numbers, currency symbols, percentages, and proper nouns.
Return strict JSON only:
{"items":["translated text 1","translated text 2"]}
The array length and order must exactly match the input.
`.trim();

    const result = await generateVisionContent([
      {
        text: `${prompt}\n\nINPUT_JSON:\n${JSON.stringify({ items: texts })}`
      }
    ]);

    const text = result.response.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("BAD_TRANSLATION_OUTPUT");
      json = JSON.parse(m[0]);
    }

    const items = Array.isArray((json as any)?.items) ? (json as any).items : [];
    if (items.length !== texts.length) throw new Error("TRANSLATION_LENGTH_MISMATCH");

    const normalized = items.map((value: unknown, index: number) => {
      const translated = typeof value === "string" ? value.trim() : "";
      return translated || texts[index];
    });

    return NextResponse.json({ items: normalized });
  } catch (err: any) {
    return NextResponse.json({
      items: texts,
      warning: "TRANSLATION_FALLBACK_USED",
      message: err?.message ?? "Translation unavailable."
    });
  }
}
