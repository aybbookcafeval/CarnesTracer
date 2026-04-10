import React, { useState, useEffect, useMemo } from "react";
import { 
  Settings,
  Plus, 
  History, 
  AlertTriangle, 
  LayoutDashboard, 
  LogOut, 
  User as UserIcon,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Scale,
  Camera as CameraIcon,
  CheckCircle2,
  X,
  TrendingDown,
  TrendingUp,
  Beef,
  Filter,
  Calendar,
  Save,
  Trash2,
  Share2,
  Printer
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { getSupabase } from "./lib/supabase";
import { supabaseService } from "./services/supabaseService";
import { 
  EstadoPieza, 
  TipoEvento, 
  RolUsuario, 
  Pieza, 
  RegistroPeso, 
  Usuario, 
  ESTADO_COLORS, 
  NEXT_STATE, 
  EVENT_FOR_STATE,
  GLOBAL_THRESHOLDS,
  ConfigCorte,
  Porcion
} from "./types";
import { cn } from "./lib/utils";
import { CameraCapture } from "./components/CameraCapture";
import { validateWeightWithAI } from "./services/geminiService";

// Mock User
const CURRENT_USER: Usuario = {
  id: "u1",
  nombre: "Chef Juan",
  rol: RolUsuario.COCINA,
};

export default function App() {
  const [user, setUser] = useState<Usuario | null>(null);
  const [authSession, setAuthSession] = useState<any>(null);
  const [piezas, setPiezas] = useState<Pieza[]>([]);
  const [registros, setRegistros] = useState<RegistroPeso[]>([]);
  const [configCortes, setConfigCortes] = useState<ConfigCorte[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dashboard" | "audit" | "settings">("dashboard");
  const [isAddingPiece, setIsAddingPiece] = useState(false);
  const [selectedPiece, setSelectedPiece] = useState<Pieza | null>(null);
  const [detailsModal, setDetailsModal] = useState<{ open: boolean; piece: Pieza | null }>({ open: false, piece: null });
  const [registrationModal, setRegistrationModal] = useState<{ open: boolean; piece: Pieza | null }>({ open: false, piece: null });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Filters State
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState<EstadoPieza | "">("");
  const [prodFilterType, setProdFilterType] = useState("");
  const [prodStartDate, setProdStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [prodEndDate, setProdEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Pagination State
  const [piecesPage, setPiecesPage] = useState(1);
  const [alertsPage, setAlertsPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const ITEMS_PER_PAGE = 12;
  const AUDIT_ITEMS_PER_PAGE = 20;

  // Reset pagination when filters change
  useEffect(() => {
    setPiecesPage(1);
    setAlertsPage(1);
    setAuditPage(1);
  }, [filterStartDate, filterEndDate, filterType, filterStatus]);

  // Filtered Data
  const filteredPiezas = useMemo(() => {
    return piezas.filter(p => {
      const pieceDate = p.createdAt.split('T')[0];
      const matchesStartDate = !filterStartDate || pieceDate >= filterStartDate;
      const matchesEndDate = !filterEndDate || pieceDate <= filterEndDate;
      const matchesType = !filterType || p.tipo.toLowerCase().includes(filterType.toLowerCase());
      const matchesStatus = !filterStatus || p.estado === filterStatus;
      return matchesStartDate && matchesEndDate && matchesType && matchesStatus;
    });
  }, [piezas, filterStartDate, filterEndDate, filterType, filterStatus]);

  // Auth Listener
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: authSession } }) => {
      setAuthSession(authSession);
      if (authSession) {
        loadUserProfile(authSession.user.id);
      } else {
        setIsAuthLoading(false);
      }
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setAuthSession(authSession);
      if (authSession) {
        loadUserProfile(authSession.user.id);
      } else {
        setUser(null);
        setIsAuthLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const profile = await supabaseService.fetchProfile(userId);
      setUser(profile);
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabase();
    if (supabase) await supabase.auth.signOut();
  };

  const generateReport = () => {
    setIsGeneratingReport(true);
    
    // Create a temporary iframe for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Por favor permite las ventanas emergentes para generar el reporte.");
      setIsGeneratingReport(false);
      return;
    }

    const reportDate = format(new Date(), "d 'de' MMMM, yyyy", { locale: es });
    const filterDesc = [
      filterStartDate && `Desde: ${filterStartDate}`,
      filterEndDate && `Hasta: ${filterEndDate}`,
      filterStatus && `Estado: ${filterStatus}`,
      filterType && `Tipo: ${filterType}`
    ].filter(Boolean).join(' | ') || 'Todos los registros';

    const html = `
      <html>
        <head>
          <title>Reporte de Trazabilidad - ${reportDate}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #334155; }
            header { border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; }
            h1 { margin: 0; color: #0f172a; font-size: 20px; }
            .meta { color: #64748b; font-size: 12px; margin-top: 5px; }
            .filters { background: #f8fafc; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-size: 12px; border: 1px solid #e2e8f0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; background: #f1f5f9; padding: 8px; border: 1px solid #e2e8f0; font-size: 10px; text-transform: uppercase; }
            td { padding: 8px; border: 1px solid #e2e8f0; font-size: 11px; }
            .status { font-weight: bold; font-size: 11px; padding: 4px 8px; border-radius: 4px; text-transform: uppercase; }
            .alert { color: #ef4444; font-weight: bold; }
            @media print {
              button { display: none; }
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <header>
            <h1>Reporte de Trazabilidad de Cárnicos</h1>
            <div class="meta">Generado el ${reportDate}</div>
          </header>
          
          <div class="filters">
            <strong>Filtros aplicados:</strong> ${filterDesc}
          </div>

          <table>
            <thead>
              <tr>
                <th>ID Pieza</th>
                <th>Tipo de Corte</th>
                <th>Estado Actual</th>
                <th>Fecha Creación</th>
                <th>P. Cong.</th>
                <th>P. Desc.</th>
                <th>P. Prod.</th>
                <th>Merma Total</th>
                <th>Rendimiento</th>
              </tr>
            </thead>
            <tbody>
              ${filteredPiezas.map(p => `
                <tr>
                  <td>${p.id}</td>
                  <td>${p.tipo}</td>
                  <td><span class="status">${p.estado}</span></td>
                  <td>${format(new Date(p.createdAt), "dd/MM/yyyy")}</td>
                  <td>${p.pesoCongelado > 0 ? p.pesoCongelado.toFixed(2) + ' kg' : '-'}</td>
                  <td>${p.pesoDescongelado > 0 ? p.pesoDescongelado.toFixed(2) + ' kg' : '-'}</td>
                  <td>${p.pesoProducido > 0 ? p.pesoProducido.toFixed(2) + ' kg' : '-'}</td>
                  <td class="${p.mermaTotal > 22 ? 'alert' : ''}">${p.mermaTotal.toFixed(1)}%</td>
                  <td>${p.rendimiento > 0 ? p.rendimiento.toFixed(1) + '%' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 40px; font-size: 12px; color: #94a3b8; text-align: center;">
            Fin del reporte - ${filteredPiezas.length} piezas encontradas
          </div>

          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setIsGeneratingReport(false);
  };

  // Fetch Data from Supabase
  useEffect(() => {
    if (!getSupabase() || !authSession) {
      setIsLoading(false);
      return;
    }
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [p, r, c] = await Promise.all([
          supabaseService.fetchPiezas(),
          supabaseService.fetchRegistros(),
          supabaseService.fetchConfigCortes()
        ]);
        setPiezas(p);
        setRegistros(r);
        setConfigCortes(c);
      } catch (error) {
        console.error("Error loading data from Supabase:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [authSession]);

  // Business Logic: Calculations
  const calculateMetrics = (pieza: Pieza, newPeso: number, type: TipoEvento) => {
    let { pesoCongelado, pesoDescongelado, pesoProducido } = pieza;
    
    if (type === TipoEvento.CONGELADO) pesoCongelado = newPeso;
    if (type === TipoEvento.DESCONGELADO) pesoDescongelado = newPeso;
    if (type === TipoEvento.PRODUCIDO) pesoProducido = newPeso;

    // Merma Descongelado: (Congelado - Descongelado) / Congelado
    let mermaDescongelado = 0;
    if (pesoCongelado > 0 && pesoDescongelado > 0) {
      mermaDescongelado = ((pesoCongelado - pesoDescongelado) / pesoCongelado) * 100;
    }

    // Merma Total: (Congelado - Producido) / Congelado
    let mermaTotal = 0;
    if (pesoCongelado > 0 && pesoProducido > 0) {
      const diff = pesoCongelado - pesoProducido;
      // Allow 5% tolerance for packaging weight increase
      if (diff < 0 && Math.abs(diff) <= pesoCongelado * 0.05) {
        mermaTotal = 0;
      } else {
        mermaTotal = (diff / pesoCongelado) * 100;
      }
    }

    // Legacy/General Merma (Current snapshot)
    let merma = 0;
    if (pesoCongelado > 0) {
      const pesoActual = pesoProducido > 0 ? pesoProducido : (pesoDescongelado > 0 ? pesoDescongelado : pesoCongelado);
      const diff = pesoCongelado - pesoActual;
      // Allow 5% tolerance for packaging weight increase
      if (diff < 0 && Math.abs(diff) <= pesoCongelado * 0.05) {
        merma = 0;
      } else {
        merma = (diff / pesoCongelado) * 100;
      }
    }
      
    const rendimiento = pesoDescongelado > 0 && pesoProducido > 0 
      ? (pesoProducido / pesoDescongelado) * 100 
      : 0;

    return { pesoCongelado, pesoDescongelado, pesoProducido, mermaDescongelado, mermaTotal, merma, rendimiento };
  };

  // Actions
  const addPiece = async (tipo: string) => {
    const newPiece: Pieza = {
      id: `P-${Date.now()}`,
      tipo,
      estado: EstadoPieza.CREADA,
      pesoCongelado: 0,
      pesoDescongelado: 0,
      pesoProducido: 0,
      mermaDescongelado: 0,
      mermaTotal: 0,
      merma: 0,
      rendimiento: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    try {
      await supabaseService.createPieza(newPiece);
      setPiezas([newPiece, ...piezas]);
      setIsAddingPiece(false);
    } catch (error) {
      console.error("Error creating piece in Supabase:", error);
    }
  };

  const registerWeight = async (pieceId: string, peso: number, foto: string, porciones?: Porcion[], fotoMerma?: string) => {
    const piece = piezas.find(p => p.id === pieceId);
    if (!piece) return;

    const nextEstado = NEXT_STATE[piece.estado];
    if (!nextEstado) return;

    const eventType = EVENT_FOR_STATE[nextEstado];
    if (!eventType) return;

    // AI Validation
    let isValid = true;
    let iaDetectedWeight = null;
    let iaReason = "";
    try {
      const aiResult = await validateWeightWithAI(foto, peso);
      isValid = aiResult.isValid;
      iaDetectedWeight = aiResult.detectedWeight;
      iaReason = aiResult.reason;

      if (!isValid) {
        alert(`ERROR DE VALIDACIÓN IA:\n${iaReason}\n\nNo se puede completar el registro. Asegúrese de que la foto muestre claramente la carne sobre la báscula y que el peso coincida.`);
        return;
      }
    } catch (e) {
      console.error("AI Validation failed", e);
      // For technical errors, we'll allow it but log it, or we could block.
      // Let's be safe and allow technical errors but with a warning in the record.
      iaReason = "Error técnico en validación IA. Se permitió el registro manual.";
    }

    const metrics = calculateMetrics(piece, peso, eventType);
    
    try {
      // 1. Upload photos to Supabase Storage
      const fileName = `${piece.id}-${eventType}-${Date.now()}`;
      const publicUrl = await supabaseService.uploadImage(foto, fileName);
      
      let publicUrlMerma = undefined;
      if (fotoMerma) {
        const fileNameMerma = `${piece.id}-MERMA-${Date.now()}`;
        publicUrlMerma = await supabaseService.uploadImage(fotoMerma, fileNameMerma);
      }

      const newRegistro: RegistroPeso = {
        id: `R-${Date.now()}`,
        piezaId: piece.id,
        tipoEvento: eventType,
        peso,
        foto: publicUrl, // Use the public URL from Supabase Storage
        fotoMerma: publicUrlMerma,
        usuario: user?.nombre || "Usuario",
        validadoIA: isValid,
        iaDetectedWeight,
        iaReason,
        fecha: new Date().toISOString(),
      };

      const updatedPiece: Pieza = { 
        ...piece, 
        ...metrics, 
        estado: nextEstado,
        fotoMerma: publicUrlMerma || piece.fotoMerma,
        porciones: porciones || piece.porciones 
      };
      await Promise.all([
        supabaseService.createRegistro(newRegistro),
        supabaseService.updatePieza(updatedPiece)
      ]);
      
      setRegistros([newRegistro, ...registros]);
      setPiezas(piezas.map(p => p.id === pieceId ? updatedPiece : p));
      setRegistrationModal({ open: false, piece: null });
    } catch (error) {
      console.error("Error registering weight in Supabase:", error);
    }
  };

  // Alerts
  const alerts = useMemo(() => {
    return piezas.filter(p => {
      const config = configCortes.find(c => c.nombre === p.tipo);
      const mDescongMax = config?.mermaDescongeladoMax ?? 8;
      const mTotalMax = config?.mermaTotalMax ?? 22;
      return (p.mermaDescongelado > mDescongMax) || 
             (p.mermaTotal > mTotalMax) || 
             (p.rendimiento > 0 && p.rendimiento < GLOBAL_THRESHOLDS.RENDIMIENTO_MIN);
    });
  }, [piezas, configCortes]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(p => filteredPiezas.some(fp => fp.id === p.id));
  }, [alerts, filteredPiezas]);

  const paginatedPiezas = useMemo(() => {
    const start = (piecesPage - 1) * ITEMS_PER_PAGE;
    return filteredPiezas.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPiezas, piecesPage]);

  const paginatedAlerts = useMemo(() => {
    const start = (alertsPage - 1) * ITEMS_PER_PAGE;
    return filteredAlerts.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAlerts, alertsPage]);

  // Grouped Audit Records
  const groupedAudit = useMemo(() => {
    const groups: Record<string, RegistroPeso[]> = {};
    registros.forEach(r => {
      if (!groups[r.piezaId]) groups[r.piezaId] = [];
      groups[r.piezaId].push(r);
    });
    
    return Object.entries(groups)
      .map(([piezaId, regs]) => {
        const piece = piezas.find(p => p.id === piezaId);
        return {
          piezaId,
          tipo: piece?.tipo || "Pieza Desconocida",
          regs: regs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
          lastUpdate: Math.max(...regs.map(r => new Date(r.fecha).getTime()))
        };
      })
      .sort((a, b) => b.lastUpdate - a.lastUpdate);
  }, [registros, piezas]);

  const paginatedAudit = useMemo(() => {
    const start = (auditPage - 1) * AUDIT_ITEMS_PER_PAGE;
    return groupedAudit.slice(start, start + AUDIT_ITEMS_PER_PAGE);
  }, [groupedAudit, auditPage]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar / Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-around items-center z-40 md:top-0 md:bottom-auto md:flex-col md:w-20 md:h-full md:border-t-0 md:border-r">
        <div className="hidden md:flex mb-8">
          <Beef className="w-8 h-8 text-brand" />
        </div>
        <NavButton 
          active={activeTab === "dashboard"} 
          onClick={() => setActiveTab("dashboard")} 
          icon={<LayoutDashboard />} 
          label="Dashboard" 
        />
        {user?.rol !== RolUsuario.COCINA && (
          <NavButton 
            active={activeTab === "audit"} 
            onClick={() => setActiveTab("audit")} 
            icon={<History />} 
            label="Auditoría" 
          />
        )}
        {user?.rol === RolUsuario.ADMIN && (
          <NavButton 
            active={activeTab === "settings"} 
            onClick={() => setActiveTab("settings")} 
            icon={<Settings />} 
            label="Ajustes" 
          />
        )}
        <div className="mt-auto hidden md:block">
          <div className="flex flex-col items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200" title={user?.nombre}>
              <UserIcon className="w-5 h-5" />
            </div>
            <NavButton active={false} onClick={handleLogout} icon={<LogOut />} label="Salir" />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pb-24 md:pl-24 md:pt-8 max-w-5xl mx-auto px-4">
        {!getSupabase() ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm px-6 text-center">
            <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-6">
              <Settings className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Configuración Requerida</h2>
            <p className="text-slate-500 max-w-md mb-8">
              Para comenzar a usar la aplicación con persistencia real, debes configurar las variables de entorno de Supabase en el menú de <strong>Settings</strong>.
            </p>
            <div className="bg-slate-50 p-6 rounded-2xl text-left w-full max-w-sm border border-slate-100 font-mono text-xs space-y-2">
              <p className="text-slate-400 font-bold uppercase mb-2 text-[10px]">Variables necesarias:</p>
              <div className="flex justify-between">
                <span className="text-slate-600">VITE_SUPABASE_URL</span>
                <span className="text-brand font-bold">Faltante</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">VITE_SUPABASE_ANON_KEY</span>
                <span className="text-brand font-bold">Faltante</span>
              </div>
            </div>
          </div>
        ) : isAuthLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Cargando sesión...</p>
          </div>
        ) : !authSession ? (
          <LoginView />
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-medium">Sincronizando con Supabase...</p>
          </div>
        ) : (
          <>
            <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {activeTab === "dashboard" && "Panel de Control"}
              {activeTab === "audit" && "Historial de Pesos"}
              {activeTab === "settings" && "Configuración de Cortes"}
            </h1>
            <p className="text-slate-500 text-sm">
              {format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {activeTab === "dashboard" && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={generateReport}
                  disabled={isGeneratingReport || filteredPiezas.length === 0}
                  className="bg-white text-slate-900 border border-slate-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Printer className="w-5 h-5" />
                  <span className="hidden sm:inline">Reporte</span>
                </button>
                <button 
                  onClick={() => setIsAddingPiece(true)}
                  className="bg-black text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
                >
                  <Plus className="w-5 h-5" />
                  <span className="hidden sm:inline">Nueva Pieza</span>
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">{user?.nombre}</p>
                <p className="text-xs text-slate-500">{user?.rol}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                <UserIcon className="w-6 h-6" />
              </div>
            </div>
          </div>
        </header>

        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {/* Filters Section */}
            <section className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold">
                <Filter className="w-5 h-5" />
                <h2>Filtros</h2>
                {(filterStartDate || filterEndDate || filterType || filterStatus) && (
                  <button 
                    onClick={() => { setFilterStartDate(""); setFilterEndDate(""); setFilterType(""); setFilterStatus(""); }}
                    className="ml-auto text-xs text-brand hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Limpiar
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Inicio</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="date" 
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha Fin</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="date" 
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Pieza</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Picaña, Rib Eye..."
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Estado</label>
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as EstadoPieza)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand outline-none transition-all appearance-none"
                  >
                    <option value="">Todos los estados</option>
                    {Object.values(EstadoPieza).map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Stats Overview */}
            {user?.rol !== RolUsuario.COCINA && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard 
                  title="Piezas Filtradas" 
                  value={filteredPiezas.length} 
                  icon={<Beef className="text-blue-600" />}
                  color="blue"
                />
                <StatCard 
                  title="Alertas Críticas" 
                  value={filteredAlerts.length} 
                  icon={<AlertTriangle className="text-brand" />}
                  color="brand"
                />
                <StatCard 
                  title="Rendimiento Promedio" 
                  value={`${(filteredPiezas.reduce((acc, p) => acc + p.rendimiento, 0) / (filteredPiezas.filter(p => p.rendimiento > 0).length || 1)).toFixed(1)}%`} 
                  icon={<TrendingUp className="text-green-600" />}
                  color="green"
                />
              </div>
            )}

            {/* Weekly Production Summary */}
            {user?.rol !== RolUsuario.COCINA && (
              <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-4 mb-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-green-600" /> Producción
                    </h2>
                    <select 
                      value={prodFilterType}
                      onChange={(e) => setProdFilterType(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand"
                    >
                      <option value="">Todos los cortes</option>
                      {configCortes.map(c => (
                        <option key={c.id} value={c.nombre}>{c.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="date" 
                      value={prodStartDate}
                      onChange={(e) => setProdStartDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand"
                    />
                    <span className="text-slate-400">a</span>
                    <input 
                      type="date" 
                      value={prodEndDate}
                      onChange={(e) => setProdEndDate(e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {Object.entries(
                    registros
                      .filter(r => {
                        const fecha = r.fecha.split('T')[0];
                        return r.tipoEvento === TipoEvento.PRODUCIDO && fecha >= prodStartDate && fecha <= prodEndDate;
                      })
                      .reduce((acc: Record<string, number>, r) => {
                        const pieza = piezas.find(p => p.id === r.piezaId);
                        if (pieza && (prodFilterType === "" || pieza.tipo === prodFilterType)) {
                          acc[pieza.tipo] = (acc[pieza.tipo] || 0) + r.peso;
                        }
                        return acc;
                      }, {})
                  ).map(([tipo, kg]) => (
                    <div key={tipo} className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase">{tipo}</p>
                      <p className="text-xl font-bold text-slate-900">{kg.toFixed(1)} kg</p>
                    </div>
                  ))}
                  {Object.keys(
                    registros
                      .filter(r => {
                        const fecha = r.fecha.split('T')[0];
                        return r.tipoEvento === TipoEvento.PRODUCIDO && fecha >= prodStartDate && fecha <= prodEndDate;
                      })
                      .reduce((acc: Record<string, number>, r) => {
                        const pieza = piezas.find(p => p.id === r.piezaId);
                        if (pieza && (prodFilterType === "" || pieza.tipo === prodFilterType)) {
                          acc[pieza.tipo] = (acc[pieza.tipo] || 0) + r.peso;
                        }
                        return acc;
                      }, {})
                  ).length === 0 && (
                    <p className="text-slate-500 italic text-sm col-span-full">No hay producción registrada en el rango seleccionado.</p>
                  )}
                </div>
              </section>
            )}

            {/* Alerts Panel */}
            {user?.rol !== RolUsuario.COCINA && filteredAlerts.length > 0 && (
              <section className="bg-brand/10 border border-brand/20 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4 text-brand font-bold">
                  <AlertTriangle className="w-5 h-5" />
                  <h2>Alertas (Filtradas)</h2>
                </div>
                <div className="space-y-3">
                  {paginatedAlerts.map(p => (
                    <div key={p.id} className="bg-white p-4 rounded-xl border border-brand/20 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900">{p.tipo} <span className="text-xs font-normal text-slate-500 ml-2">{p.id}</span></p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                          {(() => {
                            const config = configCortes.find(c => c.nombre === p.tipo);
                            return (
                              <>
                                {p.mermaDescongelado > (config?.mermaDescongeladoMax ?? 8) && (
                                  <span className="text-xs font-medium text-brand flex items-center gap-1">
                                    <TrendingDown className="w-3 h-3" /> Merma Descong: {p.mermaDescongelado.toFixed(1)}%
                                  </span>
                                )}
                                {p.mermaTotal > (config?.mermaTotalMax ?? 22) && (
                                  <span className="text-xs font-medium text-brand flex items-center gap-1">
                                    <TrendingDown className="w-3 h-3" /> Merma Total: {p.mermaTotal.toFixed(1)}%
                                  </span>
                                )}
                                {p.rendimiento > 0 && p.rendimiento < GLOBAL_THRESHOLDS.RENDIMIENTO_MIN && (
                                  <span className="text-xs font-medium text-brand flex items-center gap-1">
                                    <TrendingDown className="w-3 h-3" /> Rendimiento Bajo: {p.rendimiento.toFixed(1)}%
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <button 
                        onClick={() => setDetailsModal({ open: true, piece: p })}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>
                <Pagination 
                  currentPage={alertsPage} 
                  totalItems={filteredAlerts.length} 
                  itemsPerPage={ITEMS_PER_PAGE} 
                  onPageChange={setAlertsPage} 
                />
              </section>
            )}

            {/* Active Pieces List */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-lg">Piezas en Proceso (Filtradas)</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {paginatedPiezas.map(p => (
                  <PieceCard 
                    key={p.id} 
                    pieza={p} 
                    configCortes={configCortes}
                    onAction={() => setRegistrationModal({ open: true, piece: p })}
                    onDetails={() => setDetailsModal({ open: true, piece: p })}
                  />
                ))}
                {filteredPiezas.length === 0 && (
                  <div className="col-span-full py-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                    <p className="text-slate-400 italic">No se encontraron piezas con los filtros aplicados.</p>
                  </div>
                )}
              </div>
              <Pagination 
                currentPage={piecesPage} 
                totalItems={filteredPiezas.length} 
                itemsPerPage={ITEMS_PER_PAGE} 
                onPageChange={setPiecesPage} 
              />
            </section>
          </div>
        )}

        {activeTab === "audit" && user?.rol !== RolUsuario.COCINA && (
          <div className="space-y-8">
            {groupedAudit.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
                <History className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">No hay registros de peso todavía.</p>
              </div>
            ) : (
              <>
                {paginatedAudit.map(group => (
                  <div key={group.piezaId} className="space-y-3">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center">
                          <Beef className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 leading-none">{group.tipo}</h3>
                          <p className="text-[10px] text-slate-400 font-mono mt-1">{group.piezaId}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setDetailsModal({ open: true, piece: piezas.find(p => p.id === group.piezaId) || null })}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        Ver Trazabilidad
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {group.regs.map(r => (
                        <div key={r.id} className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center gap-4 hover:border-slate-300 transition-colors">
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0 border border-slate-100">
                            <img src={r.foto} alt="Peso" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-900 text-sm truncate">{r.tipoEvento}</h4>
                              <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                {format(new Date(r.fecha), "HH:mm, d MMM", { locale: es })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-base font-bold text-slate-900">{r.peso} kg</span>
                              {r.validadoIA ? (
                                <span className="text-[9px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                  <CheckCircle2 className="w-2.5 h-2.5" /> IA OK
                                </span>
                              ) : (
                                <span className="text-[9px] bg-brand/10 text-brand px-1.5 py-0.5 rounded-full font-bold flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> IA ERROR
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Operador</p>
                            <p className="text-[11px] font-bold text-slate-700">{r.usuario}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <Pagination 
                  currentPage={auditPage} 
                  totalItems={groupedAudit.length} 
                  itemsPerPage={AUDIT_ITEMS_PER_PAGE} 
                  onPageChange={setAuditPage} 
                />
              </>
            )}
          </div>
        )}
        {activeTab === "settings" && user?.rol === RolUsuario.ADMIN && (
          <SettingsView configCortes={configCortes} setConfigCortes={setConfigCortes} authSession={authSession} />
        )}
          </>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isAddingPiece && (
          <Modal title="Nueva Pieza" onClose={() => setIsAddingPiece(false)}>
            <AddPieceForm configCortes={configCortes} onSubmit={addPiece} onCancel={() => setIsAddingPiece(false)} />
          </Modal>
        )}

        {registrationModal.open && registrationModal.piece && (
          <Modal 
            title={`Registrar ${NEXT_STATE[registrationModal.piece.estado]}`} 
            onClose={() => setRegistrationModal({ open: false, piece: null })}
          >
            <RegistrationForm 
              pieza={registrationModal.piece} 
              isAdmin={user?.rol === RolUsuario.ADMIN}
              onSubmit={registerWeight} 
              onCancel={() => setRegistrationModal({ open: false, piece: null })} 
            />
          </Modal>
        )}

        {detailsModal.open && detailsModal.piece && (
          <Modal 
            title={`Detalles de Trazabilidad: ${detailsModal.piece.tipo}`} 
            onClose={() => setDetailsModal({ open: false, piece: null })}
          >
            <PieceDetails 
              pieza={detailsModal.piece} 
              registros={registros.filter(r => r.piezaId === detailsModal.piece?.id)} 
              configCortes={configCortes}
            />
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sub-components
function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    const supabase = getSupabase();
    if (!supabase) return;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message === "Invalid login credentials" ? "Credenciales incorrectas" : error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-2xl shadow-slate-200/50"
      >
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-black rounded-3xl flex items-center justify-center shadow-lg shadow-slate-200">
            <Beef className="text-white w-8 h-8" />
          </div>
        </div>
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-slate-900">Iniciar Sesión</h2>
          <p className="text-slate-500 font-medium">Accede al sistema de control de mermas</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Correo Electrónico</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="chef@restaurante.com"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand transition-all"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Contraseña</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-brand transition-all"
            />
          </div>

          {error && (
            <div className="p-4 bg-brand/10 border border-brand/20 rounded-2xl flex items-center gap-3 text-brand text-sm font-bold">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-slate-200"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Entrar al Sistema
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-300",
        active ? "text-brand bg-brand/10 md:bg-brand/10" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
      )}
    >
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: "w-6 h-6" }) : icon}
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function ShareButton({ title, text, imageUrl }: { title: string; text: string; imageUrl?: string }) {
  const handleShare = async () => {
    try {
      let files: File[] = [];
      if (imageUrl) {
        try {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          files = [new File([blob], "evidencia.jpg", { type: "image/jpeg" })];
        } catch (e) {
          console.error("Error fetching image for share:", e);
        }
      }

      if (navigator.share) {
        await navigator.share({
          title,
          text,
          files: files.length > 0 ? files : undefined,
        });
      } else {
        await navigator.clipboard.writeText(`${title}\n\n${text}`);
        alert("Datos copiados al portapapeles");
      }
    } catch (error) {
      console.error("Error sharing:", error);
    }
  };

  return (
    <button 
      onClick={handleShare}
      className="p-2 text-slate-400 hover:text-brand hover:bg-brand/10 rounded-xl transition-colors"
      title="Compartir"
    >
      <Share2 className="w-5 h-5" />
    </button>
  );
}

  function StorageUsage({ authSession }: { authSession: any }) {
    const [usage, setUsage] = useState<{ usedGB: number; totalGB: number; bucketName: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      const fetchUsage = async () => {
        if (!authSession) return;
        try {
          setLoading(true);
          const supabase = getSupabase();
          if (!supabase) throw new Error('Supabase no configurado');

          // Intentamos usar el SDK oficial
          const { data, error: funcError } = await supabase.functions.invoke('get-storage-usage', {
            body: { bucketName: 'evidencias' },
            headers: {
              'Authorization': `Bearer ${authSession.access_token}`
            }
          });
          
          if (funcError) {
            // Si falla el SDK, intentamos un fetch manual como fallback o lanzamos el error detallado
            console.error('Error en Edge Function:', funcError);
            throw new Error(funcError.message || 'Error al obtener uso de almacenamiento');
          }
          
          if (!data) throw new Error('No se recibieron datos de la función');

          setUsage({ 
            usedGB: parseFloat(data.usedGB || 0), 
            totalGB: 50, // Límite estimado
            bucketName: data.bucketName || 'evidencias'
          });
        } catch (err: any) {
          console.error('Error detallado:', err);
          
          // Mensaje más descriptivo para el usuario
          let friendlyMessage = 'No se pudo cargar el uso de almacenamiento';
          if (err.message?.includes('Failed to send a request')) {
            friendlyMessage = 'Error de conexión con la Edge Function. Verifique la configuración de CORS y JWT en el Dashboard de Supabase.';
          } else if (err.message) {
            friendlyMessage = err.message;
          }
          
          setError(friendlyMessage);
        } finally {
          setLoading(false);
        }
      };

      fetchUsage();
    }, [authSession]);

    if (loading) return <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center text-slate-400">Cargando...</div>;
    if (error) return <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center text-red-500">{error}</div>;
    if (!usage) return null;

    const percentage = (usage.usedGB / usage.totalGB) * 100;

    return (
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-slate-400" /> Almacenamiento (Storage)
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Bucket: <span className="font-bold text-slate-900">{usage.bucketName}</span></span>
            <span className="font-bold text-brand">{usage.usedGB.toFixed(2)} GB / {usage.totalGB} GB</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-brand h-full rounded-full transition-all duration-500" 
              style={{ width: `${Math.min(percentage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }: { currentPage: number; totalItems: number; itemsPerPage: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;

  return (
    <div className="flex justify-center items-center gap-4 mt-6">
      <button
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-all active:scale-90"
      >
        <ChevronLeft className="w-5 h-5 text-slate-600" />
      </button>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-slate-900">{currentPage}</span>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">de {totalPages}</span>
      </div>
      <button
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="p-2 rounded-xl border border-slate-200 disabled:opacity-30 hover:bg-slate-50 transition-all active:scale-90"
      >
        <ChevronRight className="w-5 h-5 text-slate-600" />
      </button>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string | number; icon: React.ReactNode; color: "blue" | "brand" | "green" }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    brand: "bg-brand/10 text-brand",
    green: "bg-green-50 text-green-600",
  };
  
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4", colors[color])}>
        {icon}
      </div>
      <p className="text-slate-500 text-sm font-medium">{title}</p>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}

function PieceCard({ pieza, configCortes, onAction, onDetails }: { pieza: Pieza; configCortes: ConfigCorte[]; onAction: () => void; onDetails?: () => void }) {
  const nextEstado = NEXT_STATE[pieza.estado];
  const config = configCortes.find(c => c.nombre === pieza.tipo);
  const mDescongMax = config?.mermaDescongeladoMax ?? 8;
  const mTotalMax = config?.mermaTotalMax ?? 22;
  
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onDetails}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-slate-900 text-lg group-hover:text-brand transition-colors">{pieza.tipo}</h3>
          <p className="text-xs text-slate-400 font-mono">{pieza.id}</p>
        </div>
        <span className={cn("px-3 py-1 rounded-full text-[10px] font-bold uppercase border", ESTADO_COLORS[pieza.estado])}>
          {pieza.estado}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Merma Descong.</p>
          <p className={cn("text-sm font-bold", pieza.mermaDescongelado > mDescongMax ? "text-brand" : "text-slate-700")}>
            {pieza.mermaDescongelado > 0 ? `${pieza.mermaDescongelado.toFixed(1)}%` : "--"}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] text-slate-400 font-bold uppercase">Merma Total</p>
          <p className={cn("text-sm font-bold", pieza.mermaTotal > mTotalMax ? "text-brand" : "text-slate-700")}>
            {pieza.mermaTotal > 0 ? `${pieza.mermaTotal.toFixed(1)}%` : "--"}
          </p>
        </div>
      </div>

      {nextEstado && (
        <button 
          onClick={(e) => { e.stopPropagation(); onAction(); }}
          className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
        >
          Registrar {nextEstado}
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
      {!nextEstado && (
        <div className="w-full py-3 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 text-xs font-bold text-center flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          PROCESO COMPLETADO
        </div>
      )}
    </motion.div>
  );
}

function PieceDetails({ pieza, registros, configCortes }: { pieza: Pieza; registros: RegistroPeso[]; configCortes: ConfigCorte[] }) {
  const sortedRegistros = [...registros].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  const config = configCortes.find(c => c.nombre === pieza.tipo);
  const mDescongMax = config?.mermaDescongeladoMax ?? 8;
  const mTotalMax = config?.mermaTotalMax ?? 22;

  return (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
      {/* Summary Metrics */}
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-900">Resumen</h3>
        <ShareButton 
          title={`Trazabilidad ${pieza.tipo}`}
          text={`Trazabilidad de Pieza: ${pieza.tipo}\nID: ${pieza.id}\nEstado: ${pieza.estado}\n\nResumen de Pesos:\n- Congelado: ${pieza.pesoCongelado}kg\n- Descongelado: ${pieza.pesoDescongelado}kg\n- Producido: ${pieza.pesoProducido}kg\n\nDetalles de Porciones:\n${pieza.porciones?.map(p => `- ${p.pesoGramos}g: ${p.cantidad} unid`).join('\n') || 'Sin porciones'}`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Merma Descong.</p>
          <p className={cn("text-sm font-bold", pieza.mermaDescongelado > mDescongMax ? "text-brand" : "text-slate-900")}>
            {pieza.mermaDescongelado > 0 ? `${pieza.mermaDescongelado.toFixed(1)}%` : "--"}
            {pieza.pesoCongelado > 0 && pieza.pesoDescongelado > 0 && (
              <span className="block text-[9px] text-slate-400">({(pieza.pesoCongelado - pieza.pesoDescongelado).toFixed(2)} kg)</span>
            )}
          </p>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Merma Total</p>
          <p className={cn("text-sm font-bold", pieza.mermaTotal > mTotalMax ? "text-brand" : "text-slate-900")}>
            {pieza.mermaTotal > 0 ? `${pieza.mermaTotal.toFixed(1)}%` : "--"}
            {pieza.pesoCongelado > 0 && pieza.pesoProducido > 0 && (
              <span className="block text-[9px] text-slate-400">({(pieza.pesoCongelado - pieza.pesoProducido).toFixed(2)} kg)</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Congelado</p>
          <p className="text-sm font-bold">{pieza.pesoCongelado > 0 ? `${pieza.pesoCongelado} kg` : "--"}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Descong.</p>
          <p className="text-sm font-bold">{pieza.pesoDescongelado > 0 ? `${pieza.pesoDescongelado} kg` : "--"}</p>
        </div>
        <div className="bg-slate-50 p-3 rounded-xl text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Producido</p>
          <p className="text-sm font-bold">{pieza.pesoProducido > 0 ? `${pieza.pesoProducido} kg` : "--"}</p>
        </div>
      </div>

      {/* Portions Detail */}
      {pieza.porciones && pieza.porciones.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Beef className="w-3 h-3" /> Detalle de Porciones Producción
          </p>
          <div className="grid grid-cols-1 gap-2">
            {pieza.porciones.map((p, i) => (
              <div key={i} className="flex justify-between items-center bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-sm font-bold text-slate-700">{pieza.tipo} {p.pesoGramos}g</span>
                <span className="text-sm font-black text-brand">{p.cantidad} unid</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-4 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
        {sortedRegistros.length === 0 && (
          <p className="text-center text-slate-400 py-8 text-sm italic">No hay registros de peso aún.</p>
        )}
        {sortedRegistros.map((reg, idx) => (
          <div key={reg.id} className="relative pl-10">
            <div className={cn(
              "absolute left-2 top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10",
              reg.tipoEvento === TipoEvento.CONGELADO ? "bg-blue-500" : 
              reg.tipoEvento === TipoEvento.DESCONGELADO ? "bg-yellow-500" : "bg-green-500"
            )} />
            <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{reg.tipoEvento}</p>
                  <p className="text-lg font-bold text-slate-900">{reg.peso} kg</p>
                </div>
                <div className="flex items-center gap-2">
                  <ShareButton 
                    title={`Registro ${reg.tipoEvento}`}
                    text={`Registro de Trazabilidad\nPieza: ${pieza.tipo}\nEstado: ${pieza.estado}\nEvento: ${reg.tipoEvento}\nPeso: ${reg.peso}kg\nFecha y Hora: ${format(new Date(reg.fecha), "dd/MM/yyyy HH:mm")}\nUsuario: ${reg.usuario}`}
                    imageUrl={reg.foto}
                  />
                  <p className="text-[10px] text-slate-400 text-right">
                    {format(new Date(reg.fecha), "d MMM, HH:mm", { locale: es })}<br/>
                    <span className="font-medium text-slate-500">Por: {reg.usuario}</span>
                  </p>
                </div>
              </div>
              {reg.foto && (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden bg-slate-100 aspect-[9/16] max-h-[400px] mx-auto">
                    <img 
                      src={reg.foto} 
                      alt={reg.tipoEvento} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    {reg.validadoIA ? (
                      <div className="absolute bottom-2 right-2 bg-green-500/90 text-white text-[8px] font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                        <CheckCircle2 className="w-2 h-2" /> IA VALIDADO
                      </div>
                    ) : (
                      <div className="absolute bottom-2 right-2 bg-brand/90 text-white text-[8px] font-bold px-2 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                        <AlertTriangle className="w-2 h-2" /> IA DISCREPANCIA
                      </div>
                    )}
                  </div>

                  {reg.fotoMerma && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-brand uppercase flex items-center gap-1">
                        <Scale className="w-3 h-3" /> Evidencia de Merma:
                      </p>
                      <div className="relative rounded-lg overflow-hidden bg-slate-100 aspect-[9/16] max-h-[300px] mx-auto border-2 border-brand/20">
                        <img 
                          src={reg.fotoMerma} 
                          alt="Merma" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              {reg.iaReason && (
                <div className={cn(
                  "mt-2 p-2 rounded-lg text-[10px] border",
                  reg.validadoIA ? "bg-green-50 border-green-100 text-green-700" : "bg-brand/10 border-brand/20 text-brand"
                )}>
                  <p className="font-bold uppercase mb-0.5">Análisis de IA:</p>
                  <p>{reg.iaReason}</p>
                  {reg.iaDetectedWeight !== null && (
                    <p className="mt-1 font-bold">Peso detectado: {reg.iaDetectedWeight} kg</p>
                  )}
                </div>
              )}

              {reg.tipoEvento === TipoEvento.PRODUCIDO && pieza.porciones && pieza.porciones.length > 0 && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1">
                    <Beef className="w-3 h-3" /> Porciones Registradas:
                  </p>
                  <div className="space-y-1">
                    {pieza.porciones.map((p, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-slate-600">{pieza.tipo} {p.pesoGramos}g</span>
                        <span className="font-bold text-brand">{p.cantidad} unid</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, y: 100, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.95 }}
        className="relative bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function AddPieceForm({ configCortes, onSubmit, onCancel }: { configCortes: ConfigCorte[]; onSubmit: (tipo: string) => void; onCancel: () => void }) {
  const [tipo, setTipo] = useState("");

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); onSubmit(tipo); }}>
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700">Tipo de Corte</label>
        <select 
          required
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand outline-none transition-all"
        >
          <option value="">Seleccionar...</option>
          {configCortes.map(c => (
            <option key={c.id} value={c.nombre}>{c.nombre}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-4">
        <button 
          type="button" 
          onClick={onCancel}
          className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
        >
          Cancelar
        </button>
        <button 
          type="submit"
          className="flex-1 py-4 bg-black text-white font-bold rounded-2xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200"
        >
          Crear Pieza
        </button>
      </div>
    </form>
  );
}

function RegistrationForm({ pieza, isAdmin, onSubmit, onCancel }: { pieza: Pieza; isAdmin: boolean; onSubmit: (id: string, peso: number, foto: string, porciones?: Porcion[], fotoMerma?: string) => Promise<void>; onCancel: () => void }) {
  const [peso, setPeso] = useState("");
  const [foto, setFoto] = useState<string | null>(null);
  const [fotoMerma, setFotoMerma] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [porciones, setPorciones] = useState<Porcion[]>([]);
  const [newPorcion, setNewPorcion] = useState({ pesoGramos: "", cantidad: "" });

  const isProducido = pieza.estado === EstadoPieza.DESCONGELADA;

  const handleAddPorcion = () => {
    if (!newPorcion.pesoGramos || !newPorcion.cantidad) return;
    setPorciones([...porciones, { pesoGramos: Number(newPorcion.pesoGramos), cantidad: Number(newPorcion.cantidad) }]);
    setNewPorcion({ pesoGramos: "", cantidad: "" });
  };

  const handleRemovePorcion = (index: number) => {
    setPorciones(porciones.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!peso || !foto) return;
    const pesoNum = Number(peso);

    if (pesoNum <= 0) {
      alert("Error: El peso debe ser mayor a 0.");
      return;
    }

    // Validation: Logical weight progression (Loss-based process)
    if (pieza.estado === EstadoPieza.CONGELADA) {
      // Current state is CONGELADA, we are registering DESCONGELADO
      if (pesoNum > pieza.pesoCongelado) {
        alert(`Error: El peso DESCONGELADO (${pesoNum}kg) no puede ser mayor al peso inicial CONGELADO (${pieza.pesoCongelado}kg).`);
        return;
      }
    } else if (pieza.estado === EstadoPieza.DESCONGELADA) {
      // Current state is DESCONGELADA, we are registering PRODUCIDO
      if (pesoNum > pieza.pesoDescongelado) {
        alert(`Error: El peso PRODUCIDO (${pesoNum}kg) no puede ser mayor al peso DESCONGELADO (${pieza.pesoDescongelado}kg).`);
        return;
      }
      if (pesoNum > pieza.pesoCongelado) {
        alert(`Error: El peso PRODUCIDO (${pesoNum}kg) no puede ser mayor al peso inicial CONGELADO (${pieza.pesoCongelado}kg).`);
        return;
      }

      // Validation: Sum of portions vs Produced weight (6% margin)
      const totalPorcionesGramos = porciones.reduce((sum, p) => sum + (p.pesoGramos * p.cantidad), 0);
      const totalPorcionesKg = totalPorcionesGramos / 1000;
      const margenError = pesoNum * 0.1;
      
      if (Math.abs(totalPorcionesKg - pesoNum) > margenError) {
        alert(`Error: La suma de las porciones (${totalPorcionesKg.toFixed(2)}kg) no coincide con el peso producido (${pesoNum}kg) dentro del margen del 6%.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await onSubmit(
        pieza.id, 
        pesoNum, 
        foto, 
        isProducido ? porciones : undefined,
        isProducido ? fotoMerma || undefined : undefined
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-slate-200">
          <Beef className="w-5 h-5 text-slate-400" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pieza Seleccionada</p>
          <p className="font-bold text-slate-900">{pieza.tipo} ({pieza.id})</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <Scale className="w-4 h-4" /> Peso Actual (kg)
        </label>
        <input 
          type="number" 
          step="0.01"
          required
          disabled={isSubmitting}
          placeholder="0.00"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          className="w-full p-6 text-3xl font-bold bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-brand outline-none transition-all text-center disabled:opacity-50"
        />
      </div>

      {isProducido && (
        <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Detalle de Porciones
          </label>
          
          <div className="flex gap-2">
            <input 
              type="number" 
              placeholder="Peso (g)"
              value={newPorcion.pesoGramos}
              onChange={(e) => setNewPorcion({ ...newPorcion, pesoGramos: e.target.value })}
              className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
            />
            <input 
              type="number" 
              placeholder="Cant."
              value={newPorcion.cantidad}
              onChange={(e) => setNewPorcion({ ...newPorcion, cantidad: e.target.value })}
              className="w-20 p-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand"
            />
            <button 
              type="button"
              onClick={handleAddPorcion}
              className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            {porciones.map((p, i) => (
              <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-sm font-medium">{pieza.tipo} {p.pesoGramos}g - {p.cantidad} unid</span>
                <button 
                  type="button"
                  onClick={() => handleRemovePorcion(i)}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <CameraIcon className="w-4 h-4" /> Evidencia Fotográfica (Producto)
        </label>
        <CameraCapture onCapture={setFoto} isAdmin={isAdmin} />
      </div>

      {isProducido && (
        <div className="space-y-4 p-4 bg-brand/5 rounded-2xl border border-brand/20">
          <div className="flex items-center gap-2 text-brand">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold">Evidencia de Merma (Opcional)</h3>
          </div>
          
          <p className="text-xs text-slate-500">
            Capture una foto de los desperdicios o recortes en la báscula para respaldar el rendimiento registrado.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <CameraIcon className="w-4 h-4" /> Foto de Merma
            </label>
            <CameraCapture onCapture={setFotoMerma} isAdmin={isAdmin} />
          </div>
        </div>
      )}

      <div className="flex gap-4 pt-4">
        <button 
          type="button" 
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors disabled:opacity-50"
        >
          Cancelar
        </button>
        <button 
          disabled={!peso || !foto || isSubmitting}
          onClick={handleSubmit}
          className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Validando con IA...
            </>
          ) : (
            "Confirmar Registro"
          )}
        </button>
      </div>
    </div>
  );
}

function SettingsView({ configCortes, setConfigCortes, authSession }: { configCortes: ConfigCorte[]; setConfigCortes: React.Dispatch<React.SetStateAction<ConfigCorte[]>>; authSession: any }) {
  const [newCorte, setNewCorte] = useState({ nombre: "", mermaDescongeladoMax: 8, mermaTotalMax: 22 });
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<ConfigCorte | null>(null);

  const handleAdd = async () => {
    if (!newCorte.nombre) return;
    setIsSaving(true);
    const corte: ConfigCorte = {
      id: `C-${Date.now()}`,
      ...newCorte
    };
    try {
      await supabaseService.saveConfigCorte(corte);
      // Reload from DB to get real IDs
      const updated = await supabaseService.fetchConfigCortes();
      setConfigCortes(updated);
      setNewCorte({ nombre: "", mermaDescongeladoMax: 8, mermaTotalMax: 22 });
    } catch (error) {
      console.error("Error adding config corte:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await supabaseService.deleteConfigCorte(id);
      setConfigCortes(configCortes.filter(c => c.id !== id));
    } catch (error) {
      console.error("Error deleting config corte:", error);
    }
  };

  const startEditing = (corte: ConfigCorte) => {
    setEditingId(corte.id);
    setEditValues({ ...corte });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues(null);
  };

  const saveEdit = async () => {
    if (!editValues || !editingId) return;
    
    // Optimistic update
    const previousCortes = [...configCortes];
    setConfigCortes(configCortes.map(c => c.id === editingId ? editValues : c));
    setEditingId(null);
    
    try {
      await supabaseService.saveConfigCorte(editValues);
      setEditValues(null);
    } catch (error) {
      console.error("Error updating config corte:", error);
      setConfigCortes(previousCortes);
    }
  };

  return (
    <div className="space-y-8">
      <section className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Plus className="w-5 h-5 text-brand" /> Añadir Nuevo Tipo de Corte
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Nombre del Corte</label>
            <input 
              type="text" 
              value={newCorte.nombre}
              onChange={(e) => setNewCorte({ ...newCorte, nombre: e.target.value })}
              placeholder="Ej: Picaña"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Merma Descong. Máx (%)</label>
            <input 
              type="number" 
              value={newCorte.mermaDescongeladoMax}
              onChange={(e) => setNewCorte({ ...newCorte, mermaDescongeladoMax: Number(e.target.value) })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase">Merma Total Máx (%)</label>
            <input 
              type="number" 
              value={newCorte.mermaTotalMax}
              onChange={(e) => setNewCorte({ ...newCorte, mermaTotalMax: Number(e.target.value) })}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </div>
        <button 
          onClick={handleAdd}
          disabled={isSaving || !newCorte.nombre}
          className="mt-6 w-full md:w-auto px-8 py-3 bg-black text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando...
            </>
          ) : (
            "Añadir Corte"
          )}
        </button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" /> Configuración Actual
        </h2>
        <StorageUsage authSession={authSession} />
        <div className="grid grid-cols-1 gap-4">
          {configCortes.map(c => {
            const isEditing = editingId === c.id;
            const displayValues = isEditing ? editValues! : c;

            return (
              <div key={c.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-1">
                  <input 
                    type="text" 
                    value={displayValues.nombre}
                    disabled={!isEditing}
                    onChange={(e) => setEditValues({ ...displayValues, nombre: e.target.value })}
                    className={cn(
                      "text-lg font-bold text-slate-900 bg-transparent border-b outline-none w-full transition-all",
                      isEditing ? "border-brand" : "border-transparent"
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Merma Descong. (%)</label>
                    <input 
                      type="number" 
                      value={displayValues.mermaDescongeladoMax}
                      disabled={!isEditing}
                      onChange={(e) => setEditValues({ ...displayValues, mermaDescongeladoMax: Number(e.target.value) })}
                      className={cn(
                        "w-full p-2 rounded-lg text-sm outline-none transition-all",
                        isEditing ? "bg-white border border-brand/20 ring-2 ring-brand/10" : "bg-slate-50 border border-transparent"
                      )}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Merma Total (%)</label>
                    <input 
                      type="number" 
                      value={displayValues.mermaTotalMax}
                      disabled={!isEditing}
                      onChange={(e) => setEditValues({ ...displayValues, mermaTotalMax: Number(e.target.value) })}
                      className={cn(
                        "w-full p-2 rounded-lg text-sm outline-none transition-all",
                        isEditing ? "bg-white border border-brand/20 ring-2 ring-brand/10" : "bg-slate-50 border border-transparent"
                      )}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <>
                      <button 
                        onClick={saveEdit}
                        className="px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-all flex items-center gap-1"
                      >
                        <Save className="w-3 h-3" /> Aceptar
                      </button>
                      <button 
                        onClick={cancelEditing}
                        className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-all"
                      >
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        onClick={() => startEditing(c)}
                        className="px-4 py-2 bg-black text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all flex items-center gap-1"
                      >
                        <Settings className="w-3 h-3" /> Editar
                      </button>
                      <button 
                        onClick={() => handleRemove(c.id)}
                        className="p-2 text-slate-400 hover:text-brand hover:bg-brand/10 rounded-lg transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
