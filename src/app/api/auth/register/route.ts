// app/api/auth/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import * as userService from '@/lib/userService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, role } = body;
    
    const user = await userService.createUser(name, email, password);

    return NextResponse.json(
      { user },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "Erro ao registrar" },
      { status: 400 }
    );
  }
}

