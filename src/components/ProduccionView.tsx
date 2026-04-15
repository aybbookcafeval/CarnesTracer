import React, { useState, useEffect } from "react";
import { Plus, Trash2, ChefHat, Camera as CameraIcon } from "lucide-react";
import { Produccion, Usuario } from "../types";
import { supabaseService } from "../services/supabaseService";
import { extractProductsFromImage } from "../services/geminiService";
import { CameraCapture } from "./CameraCapture";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  user: Usuario | null;
}

export const ProduccionView: React.FC<Props> = ({ user }) => {
  const [produccion, setProduccion] = useState<Produccion[]>([]);
  const [productos, setProductos] = useState<{nombre: string, cantidad: number, unidad: string}[]>([]);
  const [encargado, setEncargado] = useState(user?.nombre || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);

  useEffect(() => {
    supabaseService.fetchProduccion().then(setProduccion);
  }, []);

  const handleCapture = async (imageSrc: string) => {
    setIsCapturing(false);
    setIsExtracting(true);
    try {
      const extracted = await extractProductsFromImage(imageSrc);
      if (extracted.length > 0) {
        setProductos(extracted.map(p => ({
          nombre: p.nombre,
          cantidad: p.cantidad,
          unidad: p.unidad
        })));
      } else {
        alert("No se detectaron productos en la imagen. Por favor, intente con una foto más clara o agréguelos manualmente.");
      }
    } catch (error) {
      console.error("Error extracting:", error);
      alert("Error al procesar la imagen.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddProduct = () => {
    setProductos([...productos, { nombre: "", cantidad: 0, unidad: "unidades" }]);
  };

  const handleUpdateProduct = (index: number, field: string, value: any) => {
    const newProductos = [...productos];
    newProductos[index] = { ...newProductos[index], [field]: value };
    setProductos(newProductos);
  };

  const handleRemoveProduct = (index: number) => {
    setProductos(productos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (productos.length === 0 || !encargado) return;

    setIsSubmitting(true);
    try {
      const newProds = productos.map(p => ({
        id: `PROD-${Date.now()}-${Math.random()}`,
        nombrePreparado: p.nombre,
        cantidad: p.cantidad,
        unidad: p.unidad as any,
        fecha: new Date().toISOString(),
        encargado
      }));
      
      for (const p of newProds) {
        await supabaseService.createProduccion(p);
      }
      
      setProduccion([...newProds, ...produccion]);
      setProductos([]);
    } catch (error) {
      console.error("Error saving production:", error);
      alert("Error al guardar la producción.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {isCapturing ? (
        <CameraCapture onCapture={handleCapture} />
      ) : (
        <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ChefHat className="text-brand" /> Registrar Producción
            </h2>
            <button 
              onClick={() => setIsCapturing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              <CameraIcon className="w-5 h-5" /> Escanear Hoja
            </button>
          </div>
          
          {isExtracting && (
            <div className="mb-4 p-4 bg-brand/10 text-brand rounded-xl font-bold text-center">
              Analizando imagen con IA...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {productos.map((prod, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center bg-slate-50 p-2 rounded-xl">
                <input 
                  type="text" 
                  placeholder="Preparado" 
                  value={prod.nombre} 
                  onChange={e => handleUpdateProduct(index, 'nombre', e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg"
                  required
                />
                <input 
                  type="number" 
                  placeholder="Cantidad" 
                  value={prod.cantidad} 
                  onChange={e => handleUpdateProduct(index, 'cantidad', parseFloat(e.target.value))}
                  className="p-2 border border-slate-200 rounded-lg"
                  required
                />
                <select 
                  value={prod.unidad} 
                  onChange={e => handleUpdateProduct(index, 'unidad', e.target.value)}
                  className="p-2 border border-slate-200 rounded-lg"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="unidades">unidades</option>
                  <option value="lts">lts</option>
                  <option value="potes">potes</option>
                  <option value="paquetes">paquetes</option>
                </select>
                <button type="button" onClick={() => handleRemoveProduct(index)} className="text-red-500 p-2">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
            
            <button type="button" onClick={handleAddProduct} className="flex items-center gap-2 text-brand font-bold text-sm">
              <Plus className="w-4 h-4" /> Agregar preparado
            </button>

            <input 
              type="text" 
              placeholder="Encargado" 
              value={encargado} 
              onChange={e => setEncargado(e.target.value)}
              className="p-3 w-full bg-slate-50 border border-slate-200 rounded-xl"
              required
            />
            <button 
              type="submit" 
              disabled={isSubmitting || productos.length === 0}
              className="p-3 w-full bg-brand text-white font-bold rounded-xl hover:bg-brand/90 transition-colors"
            >
              {isSubmitting ? "Guardando..." : "Registrar Producción"}
            </button>
          </form>
        </section>
      )}

      <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <h2 className="text-lg font-bold p-6 border-b border-slate-100">Historial de Producción</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 font-medium">
              <tr>
                <th className="p-4">Fecha</th>
                <th className="p-4">Preparado</th>
                <th className="p-4">Cantidad</th>
                <th className="p-4">Encargado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {produccion.map(p => (
                <tr key={p.id}>
                  <td className="p-4">{format(new Date(p.fecha), "dd MMM, HH:mm", { locale: es })}</td>
                  <td className="p-4 font-medium">{p.nombrePreparado}</td>
                  <td className="p-4">{p.cantidad} {p.unidad}</td>
                  <td className="p-4">{p.encargado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
