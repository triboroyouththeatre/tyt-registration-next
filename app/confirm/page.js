'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ConfirmPage() {
  const router = useRouter();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      router.replace(`/auth/callback?code=${code}`);
    } else {
      router.replace('/confirm/error');
    }
  }, [router]);
  return null;
}