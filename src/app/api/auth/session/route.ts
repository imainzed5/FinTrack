import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { AuthSessionResponse } from '@/lib/auth-contract';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  parseRememberMeCookie,
  REMEMBER_ME_COOKIE_NAME,
} from '@/lib/supabase/auth-state';

export async function GET() {
  const cookieStore = await cookies();
  const rememberMe = parseRememberMeCookie(cookieStore.get(REMEMBER_ME_COOKIE_NAME)?.value);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    const response: AuthSessionResponse = {
      authenticated: false,
      rememberMe,
      user: null,
    };
    return NextResponse.json(response, { status: 200 });
  }

  let fullName = '';
  const metadataName = user.user_metadata?.full_name;
  if (typeof metadataName === 'string' && metadataName.trim().length > 0) {
    fullName = metadataName.trim();
  }

  if (!fullName) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profile && typeof profile.display_name === 'string') {
      fullName = profile.display_name;
    }
  }

  const response: AuthSessionResponse = {
    authenticated: true,
    rememberMe,
    user: {
      id: user.id,
      email: user.email,
      fullName,
    },
  };

  return NextResponse.json(response, { status: 200 });
}
