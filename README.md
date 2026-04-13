# Meat Traceability & AI Audit System 🥩

Sistema profesional de trazabilidad y auditoría de pesos para la industria cárnica, potenciado por Inteligencia Artificial (Gemini 3 Flash).

## 🚀 Características Principales

### 1. Auditoría con Inteligencia Artificial
*   **Validación de Báscula**: El sistema utiliza **Gemini 3 Flash** para analizar las fotos de las básculas en tiempo real.
*   **Detección de Fraude/Error**: Compara el peso ingresado manualmente con lo que la IA "lee" en la imagen.
*   **Sello de Garantía**: Los registros validados por la IA reciben un distintivo de confianza en el historial.

### 2. Control de Mermas y Rendimiento
*   **Métricas Específicas**:
    *   **Merma de Descongelado**: Controla la pérdida de líquido (Max 8%).
    *   **Merma Total**: Pérdida acumulada desde congelado hasta producción (Max 22%).
    *   **Rendimiento**: Aprovechamiento neto de la pieza (Min 70%).
*   **Alertas Automáticas**: El sistema resalta en rojo cualquier valor que se salga de los rangos permitidos.

### 3. Trazabilidad de Pieza a Pieza
*   **Agrupación Inteligente**: En la pestaña de Auditoría, los registros se agrupan por ID de pieza, permitiendo ver toda la "vida" de un corte de carne en un solo lugar.
*   **Línea de Tiempo**: Visualización cronológica de cada pesaje con evidencia fotográfica.

### 4. Dashboard con Filtros Avanzados
*   **Filtros Dinámicos**: Busca por fecha, tipo de corte (Picaña, Ribeye, etc.) o estado del proceso.
*   **Métricas en Tiempo Real**: Los promedios de rendimiento y alertas se recalculan instantáneamente según los filtros aplicados.

## 🛠️ Tecnologías

*   **Frontend**: React + TypeScript + Tailwind CSS.
*   **Animaciones**: Motion (Framer Motion).
*   **Iconografía**: Lucide React.
*   **IA**: Google Gemini SDK (@google/genai).
*   **Almacenamiento**: LocalStorage (Persistencia local).

## ⚙️ Configuración

Para habilitar la validación con IA, asegúrate de tener configurada la variable de entorno:
```env
GEMINI_API_KEY=tu_api_key_aqui
```

## 📋 Flujo de Trabajo

1.  **Creación**: Se registra una nueva pieza (ej. Ribeye).
2.  **Congelado**: Primer pesaje de entrada.
3.  **Descongelado**: Segundo pesaje para medir pérdida de líquido.
4.  **Producido**: Pesaje final del corte limpio y listo para cocina.
5.  **Auditoría**: Revisión de mermas y validaciones de IA para control de costos.

---
*Desarrollado para optimizar la eficiencia y reducir el desperdicio en cocinas profesionales.*
