import { GoogleGenAI } from "@google/genai";

// Accessing the API key. In Vite, we use define in vite.config.ts to inject process.env.GEMINI_API_KEY
// We also check import.meta.env as a fallback
const apiKey = process.env.GEMINI_API_KEY || 
               (import.meta as any).env.VITE_GEMINI_API_KEY || 
               (import.meta as any).env.GEMINI_API_KEY;

export interface ValidationResult {
  isValid: boolean;
  detectedWeight: number | null;
  confidence: number;
  reason: string;
}

export async function validateWeightWithAI(imageBase64: string, expectedWeight: number): Promise<ValidationResult> {
  if (!apiKey || apiKey === "undefined" || apiKey === "" || apiKey === "null") {
    console.warn("GEMINI_API_KEY not found. AI validation is disabled.");
    return { 
      isValid: false, 
      detectedWeight: null, 
      confidence: 0, 
      reason: "ERROR: No se ha detectado la clave de API de Gemini. Por favor, asegúrese de configurarla en los ajustes del proyecto (Settings) como GEMINI_API_KEY o VITE_GEMINI_API_KEY." 
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Remove data:image/jpeg;base64, prefix if present
    const base64Data = imageBase64.split(",")[1] || imageBase64;

    const prompt = `TAREA CRÍTICA: Eres un auditor de calidad en una planta cárnica. 
    Tu trabajo es VALIDAR que el peso físico mostrado en la báscula coincide con el peso registrado por el operador.
    
    REGLAS DE VALIDACIÓN:
    1. DEBE haber una pieza de carne real visible.
    2. DEBE haber una báscula (digital o analógica) visible.
    3. El peso en la báscula DEBE ser legible.
    4. El peso detectado debe estar cerca de ${expectedWeight} kg (margen de error aceptable: 5%).
    
    Si NO ves carne, o NO ves una báscula, o la foto es de otra cosa (como el piso, una pared, una persona), debes marcar isValid como FALSE.
    
    RESPUESTA JSON OBLIGATORIA:
    {
      "detectedWeight": número (el peso que tú ves en la báscula en kg),
      "isMeatPresent": booleano,
      "isScalePresent": booleano,
      "confidence": número (0 a 1),
      "reason": "string breve en español explicando tu decisión"
    }`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const responseText = response.text || "{}";
    const data = JSON.parse(responseText);
    
    // Tolerance of 5% or 0.1kg
    const detectedWeight = data.detectedWeight || 0;
    const diff = Math.abs(detectedWeight - expectedWeight);
    const isWeightMatch = diff <= Math.max(0.1, expectedWeight * 0.05);
    
    const isValid = isWeightMatch && data.isMeatPresent && data.isScalePresent;
    
    return {
      isValid: isValid,
      detectedWeight: detectedWeight,
      confidence: data.confidence || 0,
      reason: data.reason || "Análisis completado."
    };
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return { 
      isValid: false, 
      detectedWeight: null, 
      confidence: 0, 
      reason: "Error técnico al procesar la imagen con la IA. Por favor, intente de nuevo o contacte a soporte." 
    };
  }
}

export interface ExtractedProduct {
  nombre: string;
  cantidad: number;
  unidad: string;
}

export async function extractProductsFromImage(imageBase64: string): Promise<ExtractedProduct[]> {
  if (!apiKey || apiKey === "undefined" || apiKey === "" || apiKey === "null") {
    console.warn("GEMINI_API_KEY not found. AI extraction is disabled.");
    return [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = imageBase64.split(",")[1] || imageBase64;

    const prompt = `Analiza esta imagen de una lista de producción de alimentos.
              Identifica los productos preparados y sus cantidades.
              
              Reglas estrictas:
              1. Devuelve una lista de objetos JSON.
              2. Formato: {"nombre": "PREPARADO", "cantidad": "valor", "unidad": "unidad"}.
              3. Unidades permitidas: kg, g, unidades, lts, potes, paquetes.
              4. Ejemplo de salida: [{"nombre": "Salsa Boloñesa", "cantidad": 2, "unidad": "kg"}].
              5. Solo devuelve el JSON, sin bloques de código markdown ni texto adicional.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const responseText = response.text || "[]";
    console.log("Gemini Raw Response:", responseText);
    const data = JSON.parse(responseText);
    
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        nombre: item.nombre || "Preparado desconocido",
        cantidad: parseFloat(item.cantidad) || 1,
        unidad: item.unidad || "unidades"
      }));
    }
    return [];
  } catch (error) {
    console.error("Gemini AI Extraction Error:", error);
    return [];
  }
}
