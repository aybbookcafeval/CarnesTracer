# Manual de Operaciones: Control de Trazabilidad y Mermas Cárnicas

Este manual describe el procedimiento obligatorio para el manejo, pesaje y registro de piezas de carne en el restaurante utilizando la plataforma de trazabilidad.

---

## 1. Flujo de Trabajo Obligatorio

El ciclo de vida de cada pieza de carne consta de 4 etapas críticas. Ninguna etapa puede ser saltada.

### Paso 1: Creación de la Pieza (Recepción)
Al recibir una pieza de carne del proveedor:
1.  Ingresar a la aplicación.
2.  Hacer clic en **"Nueva Pieza"**.
3.  Seleccionar el **Tipo de Corte** (ej. Solomo, Ribeye, Lomo Fino).
4.  El sistema generará un ID único para esa pieza.

### Paso 2: Registro de Peso CONGELADO (Entrada a Cava)
Antes de guardar la pieza en el congelador:
1.  Seleccionar la pieza en el Dashboard.
2.  Hacer clic en **"Registrar Peso"**.
3.  Colocar la pieza en la báscula.
4.  Ingresar el peso exacto en la app.
5.  **Capturar Foto**: La foto debe mostrar claramente la **carne sobre la báscula** y el **número del peso** en el visor.
6.  Esperar la validación de la IA.

### Paso 3: Registro de Peso DESCONGELADO (Salida a Producción)
Cuando la pieza se retira para su uso:
1.  Repetir el proceso de pesaje y fotografía.
2.  **Regla Crítica**: El peso descongelado **NUNCA** puede ser mayor al peso congelado registrado inicialmente.
3.  El sistema calculará automáticamente la **Merma por Descongelación**.

### Paso 4: Registro de Peso PRODUCIDO (Porcionado/Final)
Una vez la pieza ha sido limpiada y porcionada para el servicio:
1.  Pesar el producto final aprovechable.
2.  Registrar el peso y capturar la evidencia fotográfica.
3.  **Regla Crítica**: El peso producido **NUNCA** puede ser mayor al peso descongelado.
4.  El sistema calculará el **Rendimiento Final** y la **Merma Total**.

---

## 2. Reglas de Validación con Inteligencia Artificial (IA)

Para que un registro sea válido, la IA auditará la foto en tiempo real:
*   **Presencia de Báscula**: La báscula debe ser visible en el encuadre.
*   **Presencia de Carne**: La pieza de carne debe estar sobre la báscula.
*   **Coincidencia de Peso**: El peso que escribas en la app debe coincidir con el que la IA detecta en la foto (tolerancia del 5%).

**Si la IA detecta una discrepancia:** El registro quedará marcado con una alerta roja para revisión de auditoría.

---

## 3. Manejo de Alertas y Mermas

El sistema genera alertas automáticas en los siguientes casos:
1.  **Exceso de Merma**: Si la pérdida de peso supera los límites configurados por la administración (ej. >8% en descongelación).
2.  **Bajo Rendimiento**: Si el producto final es menor al 70% del peso inicial.
3.  **Error de IA**: Si la foto no es clara o el peso no coincide.

**Acción ante Alerta:** El personal de cocina debe informar inmediatamente al administrador si una pieza presenta una merma inusual antes de proceder al porcionado.

---

## 4. Buenas Prácticas en la Vida Real

1.  **Limpieza de la Báscula**: Asegúrese de que la superficie de la báscula esté limpia y en ceros (TARE) antes de cada pesaje.
2.  **Iluminación**: Tome las fotos en un lugar bien iluminado para evitar que la IA rechace el registro por falta de claridad.
3.  **Etiquetado**: Si es posible, marque físicamente la pieza con su ID generado por la app para evitar confusiones entre cortes similares.
4.  **Sincronización**: Realice el registro en el momento exacto del pesaje. No deje los registros para el final del turno.

---
*Este documento es propiedad del restaurante y su cumplimiento es obligatorio para todo el personal de cocina y almacén.*
