import { describe, expect, it, vi } from "vitest";
import { establishSessionAfterSignUp } from "./establish-session-after-signup";
import type { Session } from "@supabase/supabase-js";

const fakeSession = { user: { id: "u1" } } as Session;

describe("establishSessionAfterSignUp", () => {
  it("returns session when signUp already returned a session", async () => {
    const signIn = vi.fn();
    const out = await establishSessionAfterSignUp({
      email: "a@b.c",
      password: "pw",
      signUpResult: { data: { session: fakeSession, user: { id: "u1" } }, error: null },
      signInWithPassword: signIn,
    });
    expect(out).toEqual({ kind: "session", session: fakeSession });
    expect(signIn).not.toHaveBeenCalled();
  });

  it("falls back to signIn when signUp has no session", async () => {
    const signIn = vi.fn().mockResolvedValue({
      data: { session: fakeSession },
      error: null,
    });
    const out = await establishSessionAfterSignUp({
      email: "a@b.c",
      password: "pw",
      signUpResult: { data: { session: null, user: { id: "u1" } }, error: null },
      signInWithPassword: signIn,
    });
    expect(out).toEqual({ kind: "session", session: fakeSession });
    expect(signIn).toHaveBeenCalledWith("a@b.c", "pw");
  });

  it("returns verify when neither signUp nor signIn yields a session", async () => {
    const signIn = vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    });
    const out = await establishSessionAfterSignUp({
      email: "a@b.c",
      password: "pw",
      signUpResult: { data: { session: null, user: { id: "u1" } }, error: null },
      signInWithPassword: signIn,
    });
    expect(out).toEqual({ kind: "verify" });
  });
});
