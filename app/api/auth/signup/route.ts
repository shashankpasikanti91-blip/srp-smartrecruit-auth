import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, email, password } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }
    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check for existing account
    const { data: existing } = await supabaseAdmin
      .from('auth_users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    // Hash password with bcrypt (cost 12)
    const password_hash = await bcrypt.hash(password, 12)

    // Create user
    const { data: user, error } = await supabaseAdmin
      .from('auth_users')
      .insert({
        name: name?.trim() || null,
        email: normalizedEmail,
        image: null,
        provider: 'credentials',
        provider_id: null,
        password_hash,
        role: 'user',
        product_access: ['recruit'],
        is_active: true,
      })
      .select('id, email, name')
      .single()

    if (error) {
      console.error('[signup] DB error:', error.message)
      return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 })
  } catch (err) {
    console.error('[signup] Unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}
