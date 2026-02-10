import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidAccessCode } from "@/lib/access-codes";

const Body = z.object({
  accessCode: z.string().min(1)
});

export async function POST(req: Request) {
  try {
    const body = Body.parse(await req.json());

    const isValid = isValidAccessCode(body.accessCode);

    if (isValid) {
      return NextResponse.json({
        ok: true,
        valid: true,
        message: "Access code is valid. Pro features unlocked."
      });
    } else {
      return NextResponse.json(
        {
          ok: false,
          valid: false,
          error: "Invalid access code. Please check and try again."
        },
        { status: 401 }
      );
    }
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Access code is required" },
        { status: 400 }
      );
    }
    console.error("[Access Code] Error:", error);
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 500 }
    );
  }
}
