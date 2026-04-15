import { GoogleGenAI, Type } from "@google/genai";

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

    const prompt = `Eres un experto en digitalización de inventarios para restaurantes. 
              Analiza esta imagen que contiene una lista de producción de alimentos escrita a mano o impresa.
              
              INSTRUCCIONES:
              1. Identifica cada producto o preparado en la lista.
              2. Extrae el nombre exacto del preparado.
              3. Extrae la cantidad numérica.
              4. Identifica la unidad de medida (kg, g, unidades, lts, potes, paquetes). Si no se especifica, usa "unidades".
              
              REGLAS:
              - Si la letra es difícil de leer, haz tu mejor esfuerzo por interpretar el nombre del producto basándote en el contexto de una cocina profesional.
              - Devuelve una lista de objetos con los campos: nombre, cantidad, unidad.
              - La cantidad debe ser un número (usa punto para decimales si es necesario).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nombre: { type: Type.STRING },
              cantidad: { type: Type.NUMBER },
              unidad: { type: Type.STRING }
            },
            required: ["nombre", "cantidad", "unidad"]
          }
        }
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
