/**
 * First-Run Interactive Tutorial, UI Mode Preferences, and Searchable Help Catalog
 * for HXN GENESIS 3.0.
 */

export type UIMode = 'CREATOR' | 'ADVANCED';

export const STORAGE_KEY_TUTORIAL_DONE = 'hxn_genesis_tutorial_done_v3';
export const STORAGE_KEY_UI_MODE = 'hxn_genesis_ui_mode_v3';
export const STORAGE_KEY_REDUCED_MOTION = 'hxn_genesis_reduced_motion_v3';

export interface TutorialStepDefinition {
  index: number;
  id: string;
  titleKey: string;
  descKey: string;
  targetSelector: string;
  tabToActivate?: string;
}

export const TUTORIAL_STEPS: TutorialStepDefinition[] = [
  {
    index: 0,
    id: 'camera',
    titleKey: 'tut.step1.title',
    descKey: 'tut.step1.desc',
    targetSelector: '#viewport-container'
  },
  {
    index: 1,
    id: 'overview',
    titleKey: 'tut.step2.title',
    descKey: 'tut.step2.desc',
    targetSelector: '#right-panel'
  },
  {
    index: 2,
    id: 'physical',
    titleKey: 'tut.step3.title',
    descKey: 'tut.step3.desc',
    targetSelector: '#left-panel',
    tabToActivate: 'tab-world'
  },
  {
    index: 3,
    id: 'terrain',
    titleKey: 'tut.step4.title',
    descKey: 'tut.step4.desc',
    targetSelector: '#left-panel',
    tabToActivate: 'tab-world'
  },
  {
    index: 4,
    id: 'atmosphere',
    titleKey: 'tut.step5.title',
    descKey: 'tut.step5.desc',
    targetSelector: '#left-panel',
    tabToActivate: 'tab-climate'
  },
  {
    index: 5,
    id: 'time',
    titleKey: 'tut.step6.title',
    descKey: 'tut.step6.desc',
    targetSelector: '#top-bar'
  },
  {
    index: 6,
    id: 'life',
    titleKey: 'tut.step7.title',
    descKey: 'tut.step7.desc',
    targetSelector: '#left-panel',
    tabToActivate: 'tab-sculpt'
  },
  {
    index: 7,
    id: 'hazards',
    titleKey: 'tut.step8.title',
    descKey: 'tut.step8.desc',
    targetSelector: '#left-panel',
    tabToActivate: 'tab-sculpt'
  },
  {
    index: 8,
    id: 'evolution',
    titleKey: 'tut.step9.title',
    descKey: 'tut.step9.desc',
    targetSelector: '#left-panel',
    tabToActivate: 'tab-evolab'
  },
  {
    index: 9,
    id: 'save',
    titleKey: 'tut.step10.title',
    descKey: 'tut.step10.desc',
    targetSelector: '#left-panel',
    tabToActivate: 'tab-history'
  }
];

export interface HelpTopic {
  id: string;
  category: 'CAMERA' | 'PLANET' | 'CLIMATE' | 'BIOSPHERE' | 'HAZARDS' | 'SHORTCUTS';
  titleEn: string;
  titleVi: string;
  bodyEn: string;
  bodyVi: string;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'orbit-camera',
    category: 'CAMERA',
    titleEn: '3D Camera Orbit, Zoom & Focus',
    titleVi: 'Xoay, Thu Phóng & Hội Tụ Camera 3D',
    bodyEn: 'Drag with Left Mouse to orbit, scroll wheel to zoom, Right Mouse to pan, or click "Focus Camera Here" to smoothly fly to the selected coordinate.',
    bodyVi: 'Giữ chuột trái để xoay quanh hành tinh, lăn chuột để thu phóng, chuột phải để dịch chuyển, hoặc nhấn "Xoay Camera Tới Đây" để bay tới tọa độ đang chọn.'
  },
  {
    id: 'creator-vs-advanced',
    category: 'PLANET',
    titleEn: 'Creator Mode vs. Advanced Mode',
    titleVi: 'Chế Độ Sáng Tạo (Creator) & Chuyên Sâu (Advanced)',
    bodyEn: 'Creator Mode streamlines the interface with essential planet builders and visual presets. Advanced Mode unlocks all physical equations, atmospheric gases, interior geology, and diagnostic overlays.',
    bodyVi: 'Chế độ Sáng Tạo hiển thị các thanh trượt trực quan dễ dùng. Chế độ Chuyên Sâu mở khóa toàn bộ thông số vật lý, thành phần khí quyển, địa chất lõi và biểu đồ chẩn đoán.'
  },
  {
    id: 'gravity-derivation',
    category: 'PLANET',
    titleEn: 'Radius, Mass & Derived Surface Gravity',
    titleVi: 'Bán Kính, Khối Lượng & Trọng Lực Bề Mặt',
    bodyEn: 'Surface gravity is physically derived as g = G·M/R² from planet mass and radius, scaling the atmospheric lapse rate (Γ = g/c_p). You may also set an artistic override if desired.',
    bodyVi: 'Trọng lực bề mặt được suy ra vật lý theo công thức g = G·M/R² từ khối lượng và bán kính, đồng thời điều chỉnh độ giảm nhiệt theo độ cao (lapse rate).'
  },
  {
    id: 'ocean-coverage',
    category: 'PLANET',
    titleEn: 'Ocean Coverage & Hypsometric Sea Level',
    titleVi: 'Độ Phủ Đại Dương & Mực Nước Biển',
    bodyEn: 'Setting a target Ocean Coverage (%) solves the spherical area-weighted elevation percentile to place the sea level so the exact fraction of the globe is submerged.',
    bodyVi: 'Thanh trượt Độ Phủ Đại Dương (%) tự động giải phân vị diện tích cầu để đặt mực nước biển sao cho đúng tỷ lệ bề mặt hành tinh được bao phủ bởi nước.'
  },
  {
    id: 'atmosphere-gases',
    category: 'CLIMATE',
    titleEn: 'Atmospheric Gases & Greenhouse Forcing',
    titleVi: 'Thành Phần Khí Quyển & Hiệu Ứng Nhà Kính',
    bodyEn: 'CO₂ (ppm), O₂ (%), and Argon (%) are tracked explicitly with Nitrogen (N₂) acting as the inert balance gas. Surface pressure (bar) broadens radiative greenhouse trapping.',
    bodyVi: 'CO₂ (ppm), O₂ (%) và Argon (%) được theo dõi độc lập với Nitơ (N₂) làm khí nền cân bằng. Áp suất bề mặt (bar) làm tăng hiệu ứng giữ nhiệt nhà kính.'
  },
  {
    id: 'abiogenesis-evolution',
    category: 'BIOSPHERE',
    titleEn: 'Abiogenesis, Traits & Natural Selection',
    titleVi: 'Khởi Nguyên Sự Sống, Đột Biến & Chọn Lọc Tự Nhiên',
    bodyEn: 'Life begins at zero unless seeded or sparked by deep-time Abiogenesis in warm oceans. Lineages inherit and mutate thermal, moisture, and oxygen traits under environmental selection.',
    bodyVi: 'Thế giới bắt đầu vô sinh cho đến khi bạn gieo mầm hoặc bật Abiogenesis ở biển ấm. Các nhánh loài di truyền, đột biến và thích nghi theo nhiệt độ, độ ẩm và nồng độ O₂.'
  },
  {
    id: 'god-mode-hazards',
    category: 'HAZARDS',
    titleEn: 'God Mode Hazards & Global Experiments',
    titleVi: 'Tai Biến God Mode & Thí Nghiệm Toàn Cầu',
    bodyEn: 'Trigger localized meteors, volcanoes, floods, droughts, or global experiments (Snowball cooling, runaway greenhouse, atmosphere/ocean loss). All actions support full Undo/Redo.',
    bodyVi: 'Kích hoạt thiên thạch, núi lửa, lũ lụt, hạn hán cục bộ hoặc thí nghiệm toàn cầu (Băng hà, siêu nhà kính, mất khí quyển/đại dương). Mọi thao tác đều hỗ trợ Hoàn tác (Undo).'
  },
  {
    id: 'keyboard-shortcuts',
    category: 'SHORTCUTS',
    titleEn: 'Keyboard Shortcuts',
    titleVi: 'Phím Tắt Bàn Phím',
    bodyEn: 'Space: Pause/Resume | . (Period): Single Step | [ / ]: Toggle Left/Right Panels | Z / Y: Undo / Redo | H or ?: Open Help | M: Toggle Creator/Advanced Mode | G: Toggle Lat/Lon Grid',
    bodyVi: 'Space: Tạm dừng/Chạy | . (Dấu chấm): Bước đơn | [ / ]: Ẩn/Hiện bảng Trái/Phải | Z / Y: Hoàn tác / Làm lại | H hoặc ?: Mở Trợ giúp | M: Đổi chế độ UI | G: Bật/Tắt lưới tọa độ'
  }
];

export class TutorialController {
  public showWelcomeModal: boolean;
  public activeTutorial: boolean = false;
  public currentStepIndex: number = 0;
  public uiMode: UIMode = 'ADVANCED';
  public reducedMotion: boolean = false;

  constructor() {
    const completed = this.readBool(STORAGE_KEY_TUTORIAL_DONE, false);
    this.showWelcomeModal = !completed;
    this.uiMode = this.readUIMode();
    this.reducedMotion = this.readBool(STORAGE_KEY_REDUCED_MOTION, false);
  }

  public isCompleted(): boolean {
    return this.readBool(STORAGE_KEY_TUTORIAL_DONE, false);
  }

  public startGuidedTour(): TutorialStepDefinition {
    this.showWelcomeModal = false;
    this.activeTutorial = true;
    this.currentStepIndex = 0;
    return TUTORIAL_STEPS[0];
  }

  public nextStep(): TutorialStepDefinition | null {
    if (!this.activeTutorial) return null;
    if (this.currentStepIndex + 1 < TUTORIAL_STEPS.length) {
      this.currentStepIndex++;
      return TUTORIAL_STEPS[this.currentStepIndex];
    }
    this.completeTutorial();
    return null;
  }

  public prevStep(): TutorialStepDefinition | null {
    if (!this.activeTutorial) return null;
    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
    }
    return TUTORIAL_STEPS[this.currentStepIndex];
  }

  public skipTutorial(): void {
    this.showWelcomeModal = false;
    this.activeTutorial = false;
    this.writeBool(STORAGE_KEY_TUTORIAL_DONE, true);
  }

  public completeTutorial(): void {
    this.showWelcomeModal = false;
    this.activeTutorial = false;
    this.writeBool(STORAGE_KEY_TUTORIAL_DONE, true);
  }

  public resetTutorial(): void {
    this.writeBool(STORAGE_KEY_TUTORIAL_DONE, false);
    this.showWelcomeModal = true;
    this.activeTutorial = false;
    this.currentStepIndex = 0;
  }

  public getCurrentStep(): TutorialStepDefinition {
    return TUTORIAL_STEPS[this.currentStepIndex] ?? TUTORIAL_STEPS[0];
  }

  public setUIMode(mode: UIMode): void {
    this.uiMode = mode;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_UI_MODE, mode);
      }
    } catch {
      // Ignore storage errors
    }
  }

  public toggleUIMode(): UIMode {
    const next: UIMode = this.uiMode === 'CREATOR' ? 'ADVANCED' : 'CREATOR';
    this.setUIMode(next);
    return next;
  }

  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    this.writeBool(STORAGE_KEY_REDUCED_MOTION, enabled);
  }

  public searchHelpTopics(query: string, lang: 'en' | 'vi' = 'en'): HelpTopic[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...HELP_TOPICS];
    return HELP_TOPICS.filter((t) => {
      const title = (lang === 'vi' ? t.titleVi : t.titleEn).toLowerCase();
      const body = (lang === 'vi' ? t.bodyVi : t.bodyEn).toLowerCase();
      return title.includes(q) || body.includes(q) || t.category.toLowerCase().includes(q);
    });
  }

  private readUIMode(): UIMode {
    try {
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem(STORAGE_KEY_UI_MODE);
        if (v === 'CREATOR' || v === 'ADVANCED') return v;
      }
    } catch {
      // Ignore
    }
    return 'ADVANCED';
  }

  private readBool(key: string, fallback: boolean): boolean {
    try {
      if (typeof localStorage !== 'undefined') {
        const v = localStorage.getItem(key);
        if (v === 'true') return true;
        if (v === 'false') return false;
      }
    } catch {
      // Ignore
    }
    return fallback;
  }

  private writeBool(key: string, val: boolean): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val ? 'true' : 'false');
      }
    } catch {
      // Ignore
    }
  }
}
