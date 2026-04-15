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
      reason: "ERROR: No se ha detectado la clave de API de Gemini." 
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const base64Data = imageBase64.split(",")[1] || imageBase64;

    const prompt = `TAREA CRÍTICA: Eres un auditor de calidad en una planta cárnica. 
    Tu trabajo es VALIDAR que el peso físico mostrado en la báscula coincide con el peso registrado por el operador.
    
    REGLAS DE VALIDACIÓN:
    1. DEBE haber una pieza de carne real visible.
    2. DEBE haber una báscula (digital o analógica) visible.
    3. El peso en la báscula DEBE ser legible.
    4. El peso detectado debe estar cerca de ${expectedWeight} kg (margen de error aceptable: 5%).
    
    Si NO ves carne, o NO ves una báscula, o la foto es de otra cosa, debes marcar isValid como FALSE.
    
    RESPUESTA JSON OBLIGATORIA:
    {
      "detectedWeight": número,
      "isMeatPresent": booleano,
      "isScalePresent": booleano,
      "confidence": número,
      "reason": "string breve"
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
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);
    
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
      reason: "Error técnico al procesar la imagen." 
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
              2. Formato: {"nombre": "PREPARADO", "cantidad": valor_numerico, "unidad": "unidad"}.
              3. Unidades permitidas: kg, g, unidades, lts, potes, paquetes.
              4. Ejemplo de salida: [{"nombre": "Salsa Boloñesa", "cantidad": 2, "unidad": "kg"}].
              5. Solo devuelve el JSON, sin bloques de código markdown ni texto adicional.`;

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

    const responseText = response.text || "[]";
    console.log("Gemini Raw Response:", responseText);
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    const data = JSON.parse(cleanJson);
    
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        nombre: item.nombre || "Preparado desconocido",
        cantidad: typeof item.cantidad === 'number' ? item.cantidad : parseFloat(item.cantidad) || 1,
        unidad: item.unidad || "unidades"
      }));
    }
    return [];
  } catch (error) {
    console.error("Gemini AI Extraction Error:", error);
    return [];
  }
}
