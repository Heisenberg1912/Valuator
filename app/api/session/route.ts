import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getAuthUser(req);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Authentication required. Please log in.", code: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { user: (user as any).toJSON() },
    });
  } catch (error: any) {
    console.error("[Session] Get session error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to get session." },
      { status: 500 }
    );
  }
}
