/**
 * Minimaler Gemini / Imagen Smoke-Test (liest .env.local wie andere Scripts).
 *
 * Aufruf: pnpm test:gemini
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const apiKey = process.env.GEMINI_API_KEY?.trim() ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();

if (!apiKey) {
  console.error("❌ Kein API Key gefunden (GEMINI_API_KEY oder GOOGLE_GENERATIVE_AI_API_KEY)");
  process.exit(1);
}

/** Nach exit(1) für Closures trotzdem `string` (TS narrowed nicht in async Helpers). */
const GEMINI_KEY: string = apiKey;

console.log("✓ API Key gefunden:", `${GEMINI_KEY.slice(0, 8)}...`);

const genAI = new GoogleGenerativeAI(GEMINI_KEY);

// Test 1: Gemini Flash Image Generation
async function testGeminiImageGen() {
  console.log("\n--- Test 1: gemini-2.5-flash-image ---");
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash-image",
    });

    const generationConfig = {
      responseModalities: ["IMAGE", "TEXT"],
    } as Record<string, unknown>;

    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: "Ein roter Apfel auf einem Tisch. Einfaches Foto." }],
        },
      ],
      generationConfig,
    });

    const parts = response.response.candidates?.[0]?.content?.parts ?? [];
    const hasImage = parts.some((p) => Boolean(p.inlineData?.data));
    console.log("Response parts:", parts.length);
    console.log("Has image:", hasImage);
    if (hasImage) console.log("✅ Gemini Image Generation funktioniert!");
    else
      console.log(
        "⚠️ Kein Bild in Response. Parts:",
        JSON.stringify(
          parts.map((p) => ({
            type: p.text ? "text" : "image",
            len: p.inlineData?.data?.length,
          })),
        ),
      );
  } catch (e: unknown) {
    const err = e as { message?: string; status?: number; statusText?: string };
    console.error("❌ Fehler:", err.message ?? e);
    console.error("Status:", err.status);
    console.error("Details:", JSON.stringify(e, Object.getOwnPropertyNames(e as object), 2));
  }
}

// Test 2: Imagen 3
async function testImagen() {
  console.log("\n--- Test 2: imagen-4.0-generate-001 (REST) ---");
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${encodeURIComponent(GEMINI_KEY)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: "Ein roter Apfel auf einem Tisch" }],
        parameters: { sampleCount: 1 },
      }),
    });
    const data = (await res.json()) as unknown;
    console.log("HTTP Status:", res.status);
    if (res.ok) {
      const root = data as { predictions?: { bytesBase64Encoded?: string }[] };
      const hasImage = Boolean(root.predictions?.[0]?.bytesBase64Encoded);
      console.log("Has image:", hasImage);
      if (hasImage) console.log("✅ Imagen 4 (predict) funktioniert!");
    } else {
      console.error("❌ Fehler Response:", JSON.stringify(data, null, 2));
    }
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("❌ Netzwerk / Parse:", err.message ?? e);
  }
}

void (async () => {
  await testGeminiImageGen();
  await testImagen();
  console.log("\n--- Fertig ---");
})();
