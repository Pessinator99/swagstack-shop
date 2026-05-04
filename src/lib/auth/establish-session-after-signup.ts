import type { Session } from "@supabase/supabase-js";

type SignInResult = { data: { session: Session | null }; error: { message: string } | null };

type SignUpResult = {
  data: { session: Session | null; user: { id: string } | null };
  error: { message: string } | null;
};

/**
 * After `auth.signUp`, Supabase returns `data.session` when email confirmation
 * is OFF. When confirmation is ON, `session` is null until the user verifies.
 *
 * Some setups return `session: null` even with confirmation off; then we
 * try `signInWithPassword` once as a fallback.
 */
export async function establishSessionAfterSignUp(args: {
  email: string;
  password: string;
  signUpResult: SignUpResult;
  signInWithPassword: (email: string, password: string) => Promise<SignInResult>;
}): Promise<{ kind: "session"; session: Session } | { kind: "verify" }> {
  if (args.signUpResult.error) {
    throw new Error(args.signUpResult.error.message);
  }

  if (args.signUpResult.data.session) {
    return { kind: "session", session: args.signUpResult.data.session };
  }

  const signIn = await args.signInWithPassword(args.email, args.password);
  if (!signIn.error && signIn.data.session) {
    return { kind: "session", session: signIn.data.session };
  }

  return { kind: "verify" };
}
