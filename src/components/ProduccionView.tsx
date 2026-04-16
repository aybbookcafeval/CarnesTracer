import React, { useState, useEffect } from "react";
import { Plus, Trash2, ChefHat, Camera as CameraIcon, Search, Filter, Calendar } from "lucide-react";
import { Produccion, Usuario } from "../types";
import { supabaseService } from "../services/supabaseService";
import { extractProductsFromImage } from "../services/aiService";
import { CameraCapture } from "./CameraCapture";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

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

  // Filter state
  const [filterSearch, setFilterSearch] = useState("");
  const [filterEncargado, setFilterEncargado] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  useEffect(() => {
    supabaseService.fetchProduccion().then(setProduccion);
  }, []);

  const filteredProduccion = React.useMemo(() => {
    return produccion.filter(p => {
      const matchesSearch = p.nombrePreparado.toLowerCase().includes(filterSearch.toLowerCase());
      const matchesEncargado = p.encargado.toLowerCase().includes(filterEncargado.toLowerCase());
      
      let matchesDate = true;
      if (filterStartDate || filterEndDate) {
        const prodDate = new Date(p.fecha);
        const start = filterStartDate ? startOfDay(new Date(filterStartDate)) : new Date(0);
        const end = filterEndDate ? endOfDay(new Date(filterEndDate)) : new Date();
        matchesDate = isWithinInterval(prodDate, { start, end });
      }

      return matchesSearch && matchesEncargado && matchesDate;
    });
  }, [produccion, filterSearch, filterEncargado, filterStartDate, filterEndDate]);

  const handleCapture = async (imageSrc: string) => {
    setIsCapturing(false);
    setIsExtracting(true);
    toast.info("Analizando lista de producción...");
    try {
      const extracted = await extractProductsFromImage(imageSrc);
      if (extracted.length > 0) {
        setProductos(extracted.map(p => ({
          nombre: p.nombre,
          cantidad: p.cantidad,
          unidad: p.unidad
        })));
        toast.success(`${extracted.length} preparados detectados.`);
      } else {
        toast.warning("No se detectaron productos en la imagen. Intente con una foto más clara.");
      }
    } catch (error) {
      console.error("Error extracting:", error);
      toast.error("Error al procesar la imagen.");
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
    const toastId = toast.loading("Guardando producción...");
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
      toast.success("Producción registrada exitosamente.", { id: toastId });
    } catch (error) {
      console.error("Error saving production:", error);
      toast.error("Error al guardar la producción.", { id: toastId });
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
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold">Historial de Producción</h2>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Filter className="w-4 h-4" />
              <span>{filteredProduccion.length} registros</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar preparado..." 
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 outline-none"
              />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Encargado..." 
                value={filterEncargado}
                onChange={e => setFilterEncargado(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 outline-none"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={filterStartDate}
                onChange={e => setFilterStartDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 outline-none"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="date" 
                value={filterEndDate}
                onChange={e => setFilterEndDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand/20 outline-none"
              />
            </div>
          </div>
        </div>

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
              {filteredProduccion.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400">
                    No se encontraron registros con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredProduccion.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-600">{format(new Date(p.fecha), "dd MMM, HH:mm", { locale: es })}</td>
                    <td className="p-4 font-medium text-slate-900">{p.nombrePreparado}</td>
                    <td className="p-4 text-slate-700 font-semibold">{p.cantidad} {p.unidad}</td>
                    <td className="p-4 text-slate-600">{p.encargado}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
