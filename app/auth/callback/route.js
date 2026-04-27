import { NextResponse } from 'next/server';

export async function GET(request) {
  const { origin, searchParams } = new URL(request.url);
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    console.error('Auth callback error:', error, errorDescription);
    return NextResponse.redirect(`${origin}/confirm/error`);
  }

  // Supabase has already verified the email before redirecting here.
  // No need to exchange anything — just send them to the success page.
  return NextResponse.redirect(`${origin}/confirm/success`);
}