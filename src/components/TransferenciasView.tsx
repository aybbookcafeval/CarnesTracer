import React, { useState, useEffect } from "react";
import { Camera as CameraIcon, Save, Share2, Plus, Trash2, ArrowRightLeft, FileText, Filter, ArrowRight, ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { Sede, Transferencia, ProductoTransferencia, Usuario } from "../types";
import { supabaseService } from "../services/supabaseService";
import { extractProductsFromImage } from "../services/geminiService";
import { CameraCapture } from "./CameraCapture";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function TransferenciasView({ user }: { user: Usuario | null }) {
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCapturing, setIsCapturing] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  
  // Form state
  const [sedeOrigen, setSedeOrigen] = useState<Sede>(Sede.ALMACEN_PRINCIPAL);
  const [sedeDestino, setSedeDestino] = useState<Sede>(Sede.COCINA);
  const [productos, setProductos] = useState<ProductoTransferencia[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter state
  const [filterSede, setFilterSede] = useState<Sede | "">("");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    loadTransferencias();
    
    const handleOpenNueva = () => setIsCapturing(true);
    document.addEventListener('open-nueva-transferencia', handleOpenNueva);
    return () => document.removeEventListener('open-nueva-transferencia', handleOpenNueva);
  }, []);

  const loadTransferencias = async () => {
    try {
      const data = await supabaseService.getTransferencias();
      setTransferencias(data);
    } catch (error) {
      console.error("Error loading transferencias:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapture = async (imageSrc: string) => {
    setFoto(imageSrc);
    setIsExtracting(true);
    try {
      const extracted = await extractProductsFromImage(imageSrc);
      setProductos(extracted);
    } catch (error) {
      console.error("Error extracting products:", error);
      alert("Error al extraer productos de la imagen.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddProduct = () => {
    setProductos([...productos, { nombre: "", cantidad: 1, unidad: "unid" }]);
  };

  const handleUpdateProduct = (index: number, field: keyof ProductoTransferencia, value: string | number) => {
    const newProductos = [...productos];
    newProductos[index] = { ...newProductos[index], [field]: value };
    setProductos(newProductos);
  };

  const handleRemoveProduct = (index: number) => {
    setProductos(productos.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (productos.length === 0) {
      alert("Agregue al menos un producto.");
      return;
    }
    if (productos.some(p => !p.nombre.trim())) {
      alert("Todos los productos deben tener un nombre.");
      return;
    }

    setIsSubmitting(true);
    try {
      let fotoUrl = undefined;
      if (foto) {
        const fileName = `TRANSF-${Date.now()}`;
        fotoUrl = await supabaseService.uploadImage(foto, fileName);
      }

      const newTransferencia: Transferencia = {
        id: `TR-${Date.now()}`,
        sedeOrigen,
        sedeDestino,
        productos,
        fotoUrl,
        usuario: user?.nombre || "Usuario",
        fecha: new Date().toISOString()
      };

      await supabaseService.createTransferencia(newTransferencia);
      setTransferencias([newTransferencia, ...transferencias]);
      
      // Reset form
      setFoto(null);
      setProductos([]);
      setIsCapturing(false);
      alert("Transferencia guardada exitosamente.");
    } catch (error) {
      console.error("Error saving transferencia:", error);
      alert("Error al guardar la transferencia.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleShare = async (t: Transferencia) => {
    const text = `Transferencia de Almacén\nID: ${t.id}\nDe: ${t.sedeOrigen} -> A: ${t.sedeDestino}\nFecha: ${format(new Date(t.fecha), "dd/MM/yyyy HH:mm")}\nUsuario: ${t.usuario}\n\nProductos:\n${t.productos.map(p => `- ${p.cantidad} ${p.unidad} ${p.nombre}`).join('\n')}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Transferencia ${t.id}`,
          text: text,
        });
      } catch (error) {
        console.error("Error sharing:", error);
      }
    } else {
      navigator.clipboard.writeText(text);
      alert("Texto copiado al portapapeles (Web Share API no soportada).");
    }
  };

  const filteredTransferencias = transferencias.filter(t => {
    const matchesSede = filterSede ? (t.sedeOrigen === filterSede || t.sedeDestino === filterSede) : true;
    const matchesSearch = filterSearch ? t.productos.some(p => p.nombre.toLowerCase().includes(filterSearch.toLowerCase())) : true;
    const matchesDate = (filterStartDate && filterEndDate) 
      ? (new Date(t.fecha) >= new Date(filterStartDate) && new Date(t.fecha) <= new Date(filterEndDate))
      : true;
    return matchesSede && matchesSearch && matchesDate;
  });

  const totalPages = Math.ceil(filteredTransferencias.length / ITEMS_PER_PAGE);
  const paginatedTransferencias = filteredTransferencias.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Statistics
  const stats = {
    total: filteredTransferencias.length,
    itemsTransferidos: filteredTransferencias.reduce((acc, t) => acc + t.productos.length, 0),
    sedesActivas: new Set(filteredTransferencias.flatMap(t => [t.sedeOrigen, t.sedeDestino])).size
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Cargando transferencias...</div>;
  }

  return (
    <div className="space-y-6">
      {isCapturing ? (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex justify-between items-center border-b border-slate-100 pb-4">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-brand" />
              Nueva Transferencia
            </h2>
            <button onClick={() => setIsCapturing(false)} className="text-slate-400 hover:text-slate-600">
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Origen</label>
                  <div className="w-full p-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium text-slate-500">
                    {Sede.ALMACEN_PRINCIPAL}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Destino</label>
                  <select 
                    value={sedeDestino} 
                    onChange={(e) => setSedeDestino(e.target.value as Sede)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                  >
                    {Object.values(Sede).filter(s => s !== Sede.ALMACEN_PRINCIPAL).map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <CameraIcon className="w-4 h-4" /> Captura Inteligente (Opcional)
                </label>
                <p className="text-xs text-slate-500">Tome una foto de los productos para extraer la lista automáticamente con IA.</p>
                {!foto ? (
                  <CameraCapture onCapture={handleCapture} isAdmin={true} />
                ) : (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    <img src={foto} alt="Captura" className="w-full h-48 object-cover" />
                    <button 
                      onClick={() => { setFoto(null); setProductos([]); }}
                      className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExtracting && (
                      <div className="absolute inset-0 bg-white/80 flex items-center justify-center backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs font-bold text-brand">Analizando con Gemini IA...</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-700">Lista de Productos</label>
                <button 
                  onClick={handleAddProduct}
                  className="text-xs font-bold text-brand flex items-center gap-1 hover:text-brand/80"
                >
                  <Plus className="w-3 h-3" /> Añadir Manual
                </button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {productos.length === 0 ? (
                  <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm">
                    No hay productos. Tome una foto o añada manualmente.
                  </div>
                ) : (
                  productos.map((p, i) => (
                    <div key={i} className="flex gap-2 items-start bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div className="flex-1 space-y-2">
                        <input 
                          type="text" 
                          value={p.nombre}
                          onChange={(e) => handleUpdateProduct(i, 'nombre', e.target.value)}
                          placeholder="Nombre del producto"
                          className="w-full p-2 text-sm border border-slate-200 rounded-md bg-white"
                        />
                        <div className="flex gap-2">
                          <input 
                            type="number" 
                            value={p.cantidad}
                            onChange={(e) => handleUpdateProduct(i, 'cantidad', Number(e.target.value))}
                            className="w-20 p-2 text-sm border border-slate-200 rounded-md bg-white"
                            min="0.1"
                            step="0.1"
                          />
                          <input 
                            type="text" 
                            value={p.unidad}
                            onChange={(e) => handleUpdateProduct(i, 'unidad', e.target.value)}
                            placeholder="Unidad"
                            className="w-24 p-2 text-sm border border-slate-200 rounded-md bg-white"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveProduct(i)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              <button 
                onClick={handleSave}
                disabled={isSubmitting || isExtracting || productos.length === 0}
                className="w-full py-4 bg-brand text-white font-bold rounded-xl hover:bg-brand/90 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-5 h-5" /> Guardar Transferencia
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Statistics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase">Total Transferencias</p>
              <p className="text-2xl font-black text-slate-900">{stats.total}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase">Items Movidos</p>
              <p className="text-2xl font-black text-brand">{stats.itemsTransferidos}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <p className="text-xs font-bold text-slate-400 uppercase">Sedes Activas</p>
              <p className="text-2xl font-black text-slate-900">{stats.sedesActivas}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold">
              <Filter className="w-4 h-4" />
              <h2>Filtros Avanzados</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <input 
                type="text"
                placeholder="Buscar producto..."
                value={filterSearch}
                onChange={(e) => { setFilterSearch(e.target.value); setCurrentPage(1); }}
                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
              <select 
                value={filterSede}
                onChange={(e) => { setFilterSede(e.target.value as Sede | ""); setCurrentPage(1); }}
                className="bg-slate-50 border border-slate-200 text-sm rounded-lg px-3 py-2 font-medium outline-none"
              >
                <option value="">Todas las Sedes</option>
                {Object.values(Sede).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input 
                type="date"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setCurrentPage(1); }}
                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
              <input 
                type="date"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setCurrentPage(1); }}
                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                  <tr>
                    <th className="p-4">Fecha</th>
                    <th className="p-4">Ruta</th>
                    <th className="p-4">Productos</th>
                    <th className="p-4">Usuario</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedTransferencias.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No hay transferencias registradas.
                      </td>
                    </tr>
                  ) : (
                    paginatedTransferencias.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 whitespace-nowrap">
                          <div className="font-medium text-slate-900">{format(new Date(t.fecha), "dd MMM yyyy", { locale: es })}</div>
                          <div className="text-xs text-slate-500">{format(new Date(t.fecha), "HH:mm")}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-xs font-bold">
                            <span className="px-2 py-1 bg-slate-100 rounded-md text-slate-600">{t.sedeOrigen}</span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className="px-2 py-1 bg-brand/10 rounded-md text-brand">{t.sedeDestino}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{t.productos.length} items</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1 max-w-[200px] truncate">
                            {t.productos.map(p => p.nombre).join(', ')}
                          </div>
                        </td>
                        <td className="p-4 text-slate-600">
                          {t.usuario}
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => handleShare(t)}
                            className="p-2 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors"
                            title="Compartir"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                <span className="text-xs text-slate-500">
                  Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, filteredTransferencias.length)} de {filteredTransferencias.length}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
