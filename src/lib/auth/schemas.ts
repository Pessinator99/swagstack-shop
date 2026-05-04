import { z } from "zod";

const passwordRegex = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const vatRegex = /^DE[0-9]{9}$/i;

export const loginSchema = z.object({
  email: z.string().email("Bitte gib eine gültige E-Mail-Adresse ein."),
  password: z.string().min(1, "Bitte gib dein Passwort ein."),
});

export const registerSchema = z
  .object({
    companyName: z.string().min(2, "Bitte gib den Firmennamen ein."),
    firstName: z.string().min(2, "Bitte gib deinen Vornamen ein."),
    lastName: z.string().min(2, "Bitte gib deinen Nachnamen ein."),
    email: z.string().email("Bitte gib eine gültige E-Mail-Adresse ein."),
    password: z
      .string()
      .regex(
        passwordRegex,
        "Mindestens 8 Zeichen, 1 Zahl und 1 Sonderzeichen erforderlich.",
      ),
    confirmPassword: z.string().min(1, "Bitte wiederhole dein Passwort."),
    vatId: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => v === "" || vatRegex.test(v), "USt-ID muss DE123456789 sein."),
    phone: z.string().optional(),
    industry: z.enum([
      "tech",
      "gastro",
      "sport",
      "beauty",
      "bau",
      "bildung",
      "events",
      "gesundheit",
      "sonstige",
    ]),
    newsletter: z.boolean(),
    termsAccepted: z.boolean().refine((v) => v, "Bitte akzeptiere die AGB."),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Die Passwörter stimmen nicht überein.",
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Bitte gib eine gültige E-Mail-Adresse ein."),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .regex(
        passwordRegex,
        "Mindestens 8 Zeichen, 1 Zahl und 1 Sonderzeichen erforderlich.",
      ),
    confirmPassword: z.string().min(1, "Bitte wiederhole dein Passwort."),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Die Passwörter stimmen nicht überein.",
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
