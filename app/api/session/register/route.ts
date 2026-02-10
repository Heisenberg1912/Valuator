import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongo";
import { User } from "@/lib/models";
import { generateToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: "Email, password, and name are required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    await dbConnect();

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { success: false, error: "An account with this email already exists." },
        { status: 400 }
      );
    }

    const user = await User.create({
      email: email.toLowerCase(),
      password,
      name,
      role: "user",
      isVerified: true,
      isActive: true,
    });

    const token = generateToken(user);

    return NextResponse.json(
      { success: true, data: { user: (user as any).toJSON(), token } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[Session] Registration error:", error);
    return NextResponse.json(
      { success: false, error: "Registration failed. Please try again." },
      { status: 500 }
    );
  }
}
