
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || 
                           (import.meta as any).env.VITE_OPENROUTER_API_KEY ||
                           (import.meta as any).env.OPENROUTER_API_KEY;

const DEFAULT_MODEL = "google/gemini-flash-1.5";

export interface ValidationResult {
  isValid: boolean;
  detectedWeight: number | null;
  confidence: number;
  reason: string;
}

export interface ExtractedProduct {
  nombre: string;
  cantidad: number;
  unidad: string;
}

async function callOpenRouter(prompt: string, imageBase64: string, model: string = DEFAULT_MODEL) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY === "undefined") {
    throw new Error("OPENROUTER_API_KEY no configurada.");
  }

  const base64Data = imageBase64.split(",")[1] || imageBase64;
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://meat-traceability-app.vercel.app',
      'X-OpenRouter-Title': 'Meat Traceability App',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Data}`
              }
            }
          ]
        }
      ],
      // We ask for JSON in the prompt and use json_object if supported
      response_format: { type: 'json_object' }
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Error al llamar a OpenRouter');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export async function validateWeightWithAI(imageBase64: string, expectedWeight: number): Promise<ValidationResult> {
  try {
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

    const content = await callOpenRouter(prompt, imageBase64);
    const data = JSON.parse(content);
    
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
    console.error("OpenRouter AI Error:", error);
    return { 
      isValid: false, 
      detectedWeight: null, 
      confidence: 0, 
      reason: error instanceof Error ? error.message : "Error técnico al procesar la imagen." 
    };
  }
}

export async function extractProductsFromImage(imageBase64: string): Promise<ExtractedProduct[]> {
  try {
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
              - La cantidad debe ser un número (usa punto para decimales si es necesario).
              
              RESPUESTA JSON OBLIGATORIA:
              {
                "productos": [
                  { "nombre": "string", "cantidad": número, "unidad": "string" }
                ]
              }`;

    const content = await callOpenRouter(prompt, imageBase64);
    const data = JSON.parse(content);
    const productos = data.productos || [];
    
    if (Array.isArray(productos)) {
      return productos.map((item: any) => ({
        nombre: item.nombre || "Preparado desconocido",
        cantidad: typeof item.cantidad === 'number' ? item.cantidad : parseFloat(item.cantidad) || 1,
        unidad: item.unidad || "unidades"
      }));
    }
    return [];
  } catch (error) {
    console.error("OpenRouter AI Extraction Error:", error);
    return [];
  }
}
