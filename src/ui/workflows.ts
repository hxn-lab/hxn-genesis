export type WorkspaceLayoutMode =
  | 'CREATION'
  | 'EXPLORATION'
  | 'SCIENCE_ANALYSIS'
  | 'BIOSIGNATURE_EVOLUTION'
  | 'CINEMATIC_PRESENTATION';

export type ColorVisionPaletteMode = 'STANDARD' | 'DEUTERANOPIA_SAFE' | 'PROTANOPIA_SAFE' | 'TRITANOPIA_SAFE';

export interface CommandPaletteAction {
  id: string;
  titleEn: string;
  titleVi: string;
  category: 'NAVIGATION' | 'SIMULATION' | 'VISUALIZATION' | 'SCIENCE' | 'ACCESSIBILITY';
  keywords: string[];
  run: () => void;
}

export interface GuidedTourStop {
  id: string;
  titleEn: string;
  titleVi: string;
  captionEn: string;
  captionVi: string;
  latDeg: number;
  lonDeg: number;
  zoomDistance: number;
  layer: string;
}

export interface PresentationAnnotation {
  id: string;
  title: string;
  note: string;
  latDeg: number;
  lonDeg: number;
}

export interface UserWorkflowState {
  layoutMode: WorkspaceLayoutMode;
  highContrast: boolean;
  reducedMotion: boolean;
  colorVisionMode: ColorVisionPaletteMode;
  presentationModeActive: boolean;
  currentTourIndex: number;
  annotations: PresentationAnnotation[];
}

export const DEFAULT_GUIDED_TOUR_STOPS: GuidedTourStop[] = [
  {
    id: 'tour-equator-basin',
    titleEn: 'Equatorial Ocean & Hydrosphere Basin',
    titleVi: 'Lưu vực Đại dương & Thủy quyển Xích đạo',
    captionEn: 'Inspect sea-level equilibrium, evaporation-precipitation transport, and coastal shelves.',
    captionVi: 'Quan sát cân bằng mực nước biển, vận chuyển bốc hơi - mưa và thềm lục địa.',
    latDeg: 5,
    lonDeg: 25,
    zoomDistance: 21,
    layer: 'HYDROLOGY',
  },
  {
    id: 'tour-tectonic-ridge',
    titleEn: 'Active Tectonic & Mineral Belt',
    titleVi: 'Đai Kiến tạo & Khoáng sản Hoạt động',
    captionEn: 'Examine convergent plate boundaries, volcanic outgassing, and crustal ore deposits.',
    captionVi: 'Kiểm tra ranh giới mảng hội tụ, thoát khí núi lửa và mỏ quặng vỏ hành tinh.',
    latDeg: 28,
    lonDeg: 110,
    zoomDistance: 19,
    layer: 'MINERALS',
  },
  {
    id: 'tour-polar-magnetosphere',
    titleEn: 'Polar Cusp & Magnetospheric Shielding',
    titleVi: 'Chóp Cực & Lá chắn Từ quyển',
    captionEn: 'Observe polar auroral cusps, dipole field lines, and cosmic radiation attenuation.',
    captionVi: 'Quan sát chóp cực quang, đường sức từ lưỡng cực và suy giảm bức xạ vũ trụ.',
    latDeg: 68,
    lonDeg: -45,
    zoomDistance: 24,
    layer: 'RADIATION',
  },
  {
    id: 'tour-biosphere-refugia',
    titleEn: 'Biosphere & Civilization Refugia',
    titleVi: 'Vùng Trú ẩn Sinh quyển & Văn minh',
    captionEn: 'Survey high-habitability corridors supporting complex ecosystems and emergent settlements.',
    captionVi: 'Khảo sát hành lang khả cư cao hỗ trợ hệ sinh thái phức tạp và khu định cư văn minh.',
    latDeg: -18,
    lonDeg: -60,
    zoomDistance: 20,
    layer: 'BIOMES',
  },
];

export function createInitialWorkflowState(): UserWorkflowState {
  return {
    layoutMode: 'CREATION',
    highContrast: false,
    reducedMotion: false,
    colorVisionMode: 'STANDARD',
    presentationModeActive: false,
    currentTourIndex: 0,
    annotations: [],
  };
}

export function filterCommandPaletteActions(
  actions: CommandPaletteAction[],
  query: string,
  lang: 'en' | 'vi'
): CommandPaletteAction[] {
  const q = query.trim().toLowerCase();
  if (!q) return actions;
  return actions.filter((a) => {
    const title = (lang === 'vi' ? a.titleVi : a.titleEn).toLowerCase();
    if (title.includes(q) || a.id.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)) {
      return true;
    }
    return a.keywords.some((k) => k.toLowerCase().includes(q));
  });
}
