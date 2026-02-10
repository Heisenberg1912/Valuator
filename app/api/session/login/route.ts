import { NextResponse } from "next/server";
import { dbConnect } from "@/lib/mongo";
import { User } from "@/lib/models";
import { generateToken } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required." },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (!user || !(user as any).isActive) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const isMatch = await (user as any).comparePassword(password);
    if (!isMatch) {
      return NextResponse.json(
        { success: false, error: "Invalid email or password." },
        { status: 401 }
      );
    }

    (user as any).lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    return NextResponse.json({
      success: true,
      data: { user: (user as any).toJSON(), token },
    });
  } catch (error: any) {
    console.error("[Session] Login error:", error);
    return NextResponse.json(
      { success: false, error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
