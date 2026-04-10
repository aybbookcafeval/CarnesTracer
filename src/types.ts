export enum EstadoPieza {
  CREADA = "CREADA",
  CONGELADA = "CONGELADA",
  DESCONGELADA = "DESCONGELADA",
  PRODUCIDA = "PRODUCIDA",
}

export enum TipoEvento {
  CONGELADO = "CONGELADO",
  DESCONGELADO = "DESCONGELADO",
  PRODUCIDO = "PRODUCIDO",
}

export enum RolUsuario {
  COCINA = "COCINA",
  ANALISTA = "ANALISTA",
  ADMIN = "ADMIN",
}

export interface Porcion {
  pesoGramos: number;
  cantidad: number;
}

export interface Pieza {
  id: string;
  tipo: string;
  estado: EstadoPieza;
  pesoCongelado: number;
  pesoDescongelado: number;
  pesoProducido: number;
  mermaDescongelado: number; // %
  mermaTotal: number; // %
  merma: number; // % (Legacy/General)
  rendimiento: number; // %
  porciones?: Porcion[];
  createdAt: string;
  updatedAt: string;
}

export interface ConfigCorte {
  id: string;
  nombre: string;
  mermaDescongeladoMax: number;
  mermaTotalMax: number;
}

export const DEFAULT_CONFIG_CORTES: ConfigCorte[] = [
  { id: "1", nombre: "Solomo", mermaDescongeladoMax: 8, mermaTotalMax: 22 },
  { id: "2", nombre: "Ribeye", mermaDescongeladoMax: 7, mermaTotalMax: 20 },
  { id: "3", nombre: "Punta de Anca", mermaDescongeladoMax: 9, mermaTotalMax: 25 },
  { id: "4", nombre: "Lomo Fino", mermaDescongeladoMax: 5, mermaTotalMax: 18 },
  { id: "5", nombre: "Pollo", mermaDescongeladoMax: 10, mermaTotalMax: 15 },
];

export const GLOBAL_THRESHOLDS = {
  RENDIMIENTO_MIN: 70,
};

export interface RegistroPeso {
  id: string;
  piezaId: string;
  tipoEvento: TipoEvento;
  peso: number;
  foto: string; // Base64 or URL
  usuario: string;
  validadoIA: boolean;
  iaDetectedWeight?: number | null;
  iaReason?: string;
  fecha: string;
}

export interface Usuario {
  id: string;
  nombre: string;
  rol: RolUsuario;
}

export const ESTADO_COLORS: Record<EstadoPieza, string> = {
  [EstadoPieza.CREADA]: "bg-gray-100 text-gray-800 border-gray-200",
  [EstadoPieza.CONGELADA]: "bg-blue-100 text-blue-800 border-blue-200",
  [EstadoPieza.DESCONGELADA]: "bg-yellow-100 text-yellow-800 border-yellow-200",
  [EstadoPieza.PRODUCIDA]: "bg-green-100 text-green-800 border-green-200",
};

export const NEXT_STATE: Partial<Record<EstadoPieza, EstadoPieza>> = {
  [EstadoPieza.CREADA]: EstadoPieza.CONGELADA,
  [EstadoPieza.CONGELADA]: EstadoPieza.DESCONGELADA,
  [EstadoPieza.DESCONGELADA]: EstadoPieza.PRODUCIDA,
};

export const EVENT_FOR_STATE: Partial<Record<EstadoPieza, TipoEvento>> = {
  [EstadoPieza.CONGELADA]: TipoEvento.CONGELADO,
  [EstadoPieza.DESCONGELADA]: TipoEvento.DESCONGELADO,
  [EstadoPieza.PRODUCIDA]: TipoEvento.PRODUCIDO,
};
