import { NextResponse } from "next/server";
import { store } from "../../../lib/store";

export async function GET() {
  const documents = store.list();
  return NextResponse.json({ documents }, { status: 200 });
}
