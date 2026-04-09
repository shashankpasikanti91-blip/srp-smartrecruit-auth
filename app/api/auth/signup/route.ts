import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { pool } from '@/lib/db'

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
    const { rows: existing } = await pool.query(
      'SELECT id FROM auth_users WHERE email = $1', [normalizedEmail]
    )
    if (existing.length > 0) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    // Hash password with bcrypt (cost 12)
    const password_hash = await bcrypt.hash(password, 12)

    // Create user
    const { rows, rowCount } = await pool.query(
      `INSERT INTO auth_users (name, email, image, provider, provider_id, password_hash, role, product_access, is_active)
       VALUES ($1,$2,NULL,'credentials',NULL,$3,'user',ARRAY['recruit'],true)
       RETURNING id, email, name`,
      [name?.trim() || null, normalizedEmail, password_hash]
    )
    if (!rowCount) {
      return NextResponse.json({ error: 'Failed to create account.' }, { status: 500 })
    }
    const user = rows[0]

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 })
  } catch (err) {
    console.error('[signup] Unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}
