import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";

export const maxDuration = 90;

/** Siehe https://ai.google.dev/gemini-api/docs/models (ältere Preview-IDs liefern 404). */
const MODEL_GEMINI_IMAGE = "gemini-2.5-flash-image";
/** Fallback nach Gemini; siehe https://ai.google.dev/gemini-api/docs/imagen */
const MODEL_IMAGEN = "imagen-4.0-generate-001";

const bodySchema = z.object({
  mockupDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/i, "mockupDataUrl muss eine gültige Data-URL sein."),
  logoDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg|webp);base64,/i, "logoDataUrl muss eine gültige Data-URL sein."),
  industry: z.string().trim().min(1).max(100),
  productName: z.string().min(1).max(200),
  variantName: z.string().min(1).max(200),
});

type GeminiPart = {
  text?: string;
  inlineData?: { mimeType?: string; data?: string };
};

function dataUrlToBase64Png(dataUrl: string): string {
  const i = dataUrl.indexOf("base64,");
  if (i === -1) throw new Error("Ungültige Data-URL.");
  return dataUrl.slice(i + "base64,".length);
}

function buildGeminiMultimodalPrompt(productName: string, variantName: string, industry: string): string {
  return `Du bist ein professioneller Produktfotograf für Firmenwerbung.

AUFGABE: Erstelle ein realistisches Marketingfoto des abgebildeten
Produkts in einer echten Umgebung.

PRODUKT: ${productName} in ${variantName}
SZENE: ${industry}

STRIKTE ANFORDERUNGEN:
1. LOGO-TREUE (wichtigste Regel):
   - Das Logo auf dem Produkt MUSS exakt so aussehen wie im
     Eingabebild - gleiche Schrift, gleiche Farben, gleiche Form
   - Logo darf nicht verzerrt, verwackelt oder unleserlich sein
   - Logo soll klar und scharf erkennbar sein
   - Keine Interpretation oder Variation des Logos erlaubt

2. PRODUKTTREUE:
   - Das Produkt muss exakt dieselbe Form, Farbe und Details haben
     wie im Eingabebild gezeigt
   - Gleiche Nähte, Reißverschlüsse, Materialstruktur
   - Keine Änderungen am Produkt selbst

3. FOTOREALISMUS:
   - Echte Fotografie, kein CGI oder 3D-Render-Look
   - Natürliches, weiches Licht (bevorzugt Tageslicht oder
     professionelles Studio-Licht)
   - Leichte Tiefenunschärfe im Hintergrund (Bokeh)
   - Echte Materialstrukturen und Schatten
   - Keine übertriebene Nachbearbeitung oder Filter

4. SZENE:
   - Passend zur Umgebung: ${industry}
   - Menschen im Hintergrund optional aber natürlich platziert
   - Professionelles, modernes Setting
   - Produkt steht prominent im Vordergrund, leicht versetzt

5. BILDKOMPOSITION:
   - Produkt nimmt 40-60% des Bildrahmens ein
   - Leicht erhöhter Winkel (15-20° von oben) für beste
     Sichtbarkeit des Logos
   - Ausgewogene Komposition, nicht zu voll oder zu leer

FORMAT: Quadratisch oder leicht querformat (4:3)
STIL: Professionelles Firmenkatalog-Foto, hochwertig, scharf

WICHTIG: Das Bild soll so realistisch sein, dass ein Betrachter
denkt, es sei ein echtes Produktfoto und kein KI-generiertes Bild.`;
}

function buildImagenPrompt(productName: string, variantName: string, industry: string): string {
  return `Professionelles Marketingfoto für Firmenwerbung.
Produkt: ${productName} in ${variantName}.
Das Produkt steht prominent im Vordergrund.
Szene: ${industry} Umgebung, professionell und modern.
Stil: Businessfotografie, natürliches Licht, hochwertig.
Das Produkt sieht aus wie: ${productName}.
Kein Text im Bild außer dem auf dem Produkt.
Hochauflösend, professionell, realistisch.`;
}

function parseGeneratedImage(parts: GeminiPart[]): { base64: string; mime: string } | null {
  for (const part of parts) {
    if (part.inlineData?.data) {
      const mime =
        typeof part.inlineData.mimeType === "string" && part.inlineData.mimeType.startsWith("image/")
          ? part.inlineData.mimeType
          : "image/png";
      return { base64: part.inlineData.data, mime };
    }
  }
  return null;
}

/** Antwort von `models/imagen-4.0-generate-001:predict` (Struktur kann variieren). */
function parseImagenPredictResponse(json: unknown): { base64: string; mime: string } | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;
  const preds = root.predictions;
  if (!Array.isArray(preds) || preds.length === 0) return null;
  const p0 = preds[0];

  const extractB64 = (node: unknown): string | null => {
    if (typeof node === "string" && /^[A-Za-z0-9+/=_-]{200,}$/.test(node.replace(/\s/g, ""))) {
      return node.replace(/\s/g, "");
    }
    if (!node || typeof node !== "object") return null;
    const o = node as Record<string, unknown>;
    for (const k of ["bytesBase64Encoded", "bytesBase64", "b64"]) {
      const v = o[k];
      if (typeof v === "string" && v.length > 80) return v;
    }
    const nested = o.image ?? o.generatedImage ?? o.value;
    if (nested) return extractB64(nested);
    for (const v of Object.values(o)) {
      const x = extractB64(v);
      if (x) return x;
    }
    return null;
  };

  const b64 = extractB64(p0);
  if (!b64) return null;
  return { base64: b64, mime: "image/png" };
}

async function callImagenPredict(
  apiKey: string,
  prompt: string,
): Promise<{ base64: string; mime: string } | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_IMAGEN}:predict?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        personGeneration: "allow_adult",
        safetyFilterLevel: "block_few",
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.warn("[Imagen predict]", res.status, text.slice(0, 400));
    return null;
  }
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  return parseImagenPredictResponse(json);
}

function isRateLimitError(err: unknown): boolean {
  if (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { status?: unknown }).status === "number" &&
    (err as { status: number }).status === 429
  ) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  // Kein nacktes "rate" — matched sonst z. B. "geneRATE", "sepaRATE", "corpoRATE".
  return (
    /\b429\b/.test(msg) ||
    /resource_exhausted|RESOURCE_EXHAUSTED/i.test(msg) ||
    /\btoo[_\s-]?many[_\s-]?requests\b/i.test(msg) ||
    /\brate[_\s-]?limit(ed)?\b/i.test(msg) ||
    /\bquota\s+exceeded\b/i.test(msg)
  );
}

function isBlockedOrSafety(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /blocked|safety|SAFETY|HARM/i.test(msg);
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierung fehlgeschlagen.", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const apiKey =
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "GEMINI_API_KEY (oder GOOGLE_GENERATIVE_AI_API_KEY) ist nicht gesetzt. Bitte in .env.local hinterlegen.",
      },
      { status: 500 },
    );
  }

  const d = parsed.data;
  const mockupDataUrl = d.mockupDataUrl;
  const mockupBase64 = dataUrlToBase64Png(mockupDataUrl);
  const geminiPrompt = buildGeminiMultimodalPrompt(d.productName, d.variantName, d.industry);
  const imagenPrompt = buildImagenPrompt(d.productName, d.variantName, d.industry);

  const mockupFallback = (message: string) =>
    NextResponse.json({
      imageDataUrl: mockupDataUrl,
      source: "mockup_fallback" as const,
      message,
    });

  const generationConfig = {
    responseModalities: ["IMAGE", "TEXT"],
    temperature: 0.4,
  } as Record<string, unknown>;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_GEMINI_IMAGE });

    const generatePromise = model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: mockupBase64,
              },
            },
            { text: geminiPrompt },
          ],
        },
      ],
      generationConfig,
    });

    const result = await Promise.race([
      generatePromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("TIMEOUT")), 45_000),
      ),
    ]);

    const finish = result.response.candidates?.[0]?.finishReason;
    if (finish === "SAFETY" || finish === "BLOCKLIST") {
      throw new Error("GEMINI_SAFETY");
    }

    const parts = (result.response.candidates?.[0]?.content?.parts ?? []) as GeminiPart[];
    const generated = parseGeneratedImage(parts);
    if (generated) {
      return NextResponse.json({
        imageDataUrl: `data:${generated.mime};base64,${generated.base64}`,
        source: "gemini" as const,
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message === "TIMEOUT") {
      /* Imagen versuchen */
    } else if (err instanceof Error && err.message === "GEMINI_SAFETY") {
      /* Imagen versuchen */
    } else if (isRateLimitError(err)) {
      return mockupFallback("Rate-Limit erreicht – Mockup-Vorschau wird angezeigt.");
    } else if (isBlockedOrSafety(err)) {
      /* Imagen versuchen */
    } else {
      console.warn("[POST /api/moodboard/generate] gemini", err);
    }
  }

  try {
    const imagen = await callImagenPredict(apiKey, imagenPrompt);
    if (imagen) {
      return NextResponse.json({
        imageDataUrl: `data:${imagen.mime};base64,${imagen.base64}`,
        source: "imagen" as const,
      });
    }
  } catch (e) {
    console.error("[POST /api/moodboard/generate] imagen", e);
  }

  return mockupFallback("KI-Generierung nicht verfügbar – Mockup-Vorschau wird angezeigt.");
}
