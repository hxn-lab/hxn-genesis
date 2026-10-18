import { i18n, TranslationKey } from './i18n';
import { parseAndValidateWorldJson, WorldLibraryManager } from './persistence/worldStore';
import { CameraPresetMode, OverlayLayerMode, PlanetRenderer } from './render/planetRenderer';
import { nitrogenPercent } from './sim/atmosphere';
import { eventRequiresConfirmation, GlobalExperimentEventType } from './sim/events';
import { derivePlanetQuantities, EARTH_GRAVITY_MS2, EARTH_RADIUS_KM, StarType } from './sim/planetPhysics';
import { BrushFalloff, BrushShape, BrushSymmetry, SculptBrushTool } from './sim/sculpt';
import { TerrainStyle } from './sim/terrainGen';
import { formatSciNumber, formatTimeBreakdown, parseSciSpeed } from './sim/time';
import { PresetName, VisualQualityPreset } from './sim/types';
import { WorldSimulation } from './sim/world';
import { resolveShortcutAction } from './ui/shortcuts';
import { TUTORIAL_STEPS, TutorialController } from './ui/tutorial';

type ClickToolMode =
  | 'INSPECT'
  | 'SEED_MICROBES'
  | 'SEED_FLORA'
  | 'SEED_FAUNA'
  | 'SCULPT_RAISE'
  | 'SCULPT_LOWER'
  | 'SCULPT_SMOOTH'
  | 'SCULPT_FLATTEN'
  | 'SCULPT_MOUNTAIN'
  | 'SCULPT_BASIN'
  | 'SCULPT_CRATER'
  | 'PAINT_OCEAN'
  | 'PAINT_LAND'
  | 'ADD_ICE'
  | 'REMOVE_ICE'
  | 'RESTORE_TERRAIN'
  | 'VOLCANO'
  | 'EARTHQUAKE'
  | 'TSUNAMI'
  | 'STORM'
  | 'DROUGHT'
  | 'FLOOD'
  | 'METEOR';

const SCULPT_TOOL_MAP: Partial<Record<ClickToolMode, SculptBrushTool>> = {
  SCULPT_RAISE: 'RAISE',
  SCULPT_LOWER: 'LOWER',
  SCULPT_SMOOTH: 'SMOOTH',
  SCULPT_FLATTEN: 'FLATTEN',
  SCULPT_MOUNTAIN: 'MOUNTAIN_RANGE',
  SCULPT_BASIN: 'CARVE_BASIN',
  SCULPT_CRATER: 'CRATER',
  PAINT_OCEAN: 'PAINT_OCEAN',
  PAINT_LAND: 'PAINT_LAND',
  ADD_ICE: 'ADD_ICE',
  REMOVE_ICE: 'REMOVE_ICE',
  RESTORE_TERRAIN: 'RESTORE'
};

class HxnGenesisApp {
  public world: WorldSimulation;
  public renderer: PlanetRenderer;
  public tutorial: TutorialController;
  public worldLibrary: WorldLibraryManager;

  private selectedLat = 12.5;
  private selectedLon = 24.0;
  private activeTool: ClickToolMode = 'INSPECT';
  private brushRadiusDeg = 12;
  private brushStrength = 0.85;
  private brushFalloff: BrushFalloff = 'SMOOTH';
  private brushShape: BrushShape = 'CIRCLE';
  private brushSymmetry: BrushSymmetry = 'NONE';
  private speciesSearchQuery = '';
  private helpSearchQuery = '';
  private chartMetricMode: 'bio_fauna' | 'biodiv' | 'temp_hab' | 'atmo' = 'bio_fauna';

  private lastFrameTime = performance.now();
  private fpsFrameCount = 0;
  private fpsAccumMs = 0;
  private measuredFps = 60;
  private lastSimStepMs = 0.8;
  private autosaveAccumMs = 0;

  private pointerDownPos = { x: 0, y: 0 };

  constructor() {
    const viewport = document.getElementById('viewport-container')!;
    this.world = new WorldSimulation(144, 72, 'Earth-like');
    this.renderer = new PlanetRenderer(viewport, this.world);
    this.tutorial = new TutorialController();
    this.worldLibrary = new WorldLibraryManager();

    if (this.worldLibrary.listWorlds().length === 0) {
      this.worldLibrary.saveWorld(
        'Initial Genesis Epoch',
        this.world.serializeSnapshot('Initial Genesis Epoch')
      );
    }

    i18n.setLanguage(i18n.getLanguage());
    i18n.onChange(() => {
      this.syncPauseButtonLabel();
      this.syncUIModeDom();
      this.renderTutorialState();
      this.renderHelpTopicsList();
      this.renderCheckpointsList();
      this.updateUIReadouts();
    });

    this.renderer.setSelectionMarker(this.selectedLat, this.selectedLon);
    this.bindUIEvents(viewport);
    this.syncUIModeDom();
    this.syncSlidersFromParams();
    this.renderTutorialState();
    this.renderHelpTopicsList();
    this.renderCheckpointsList();
    this.updateUIReadouts();

    window.addEventListener('resize', () => {
      this.renderer.resize(viewport.clientWidth, viewport.clientHeight);
    });

    requestAnimationFrame((t) => this.loop(t));
  }

  private syncPauseButtonLabel(): void {
    const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
    if (!btnPause) return;
    btnPause.textContent = this.world.paused ? i18n.t('btn.resume') : i18n.t('btn.pause');
    btnPause.classList.toggle('btn-warn', this.world.paused);
  }

  private syncUIModeDom(): void {
    document.body.dataset.uiMode = this.tutorial.uiMode;
    const btnMode = document.getElementById('btn-ui-mode') as HTMLButtonElement | null;
    if (btnMode) {
      const key: TranslationKey =
        this.tutorial.uiMode === 'CREATOR' ? 'btn.mode_creator' : 'btn.mode_advanced';
      btnMode.dataset.i18n = key;
      btnMode.textContent = i18n.t(key);
    }
  }

  private activateTab(tabId: string): void {
    const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
    tabBtns.forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach((c) => {
      c.classList.toggle('active', c.id === tabId);
    });
  }

  private renderTutorialState(): void {
    const welcomeModal = document.getElementById('welcome-modal');
    const tutorialBanner = document.getElementById('tutorial-banner');

    // Clear previous focus highlight
    document.querySelectorAll('[data-tutorial-focus="true"]').forEach((el) => {
      el.removeAttribute('data-tutorial-focus');
    });

    if (welcomeModal) {
      welcomeModal.style.display = this.tutorial.showWelcomeModal ? 'flex' : 'none';
    }

    if (!tutorialBanner) return;
    if (!this.tutorial.activeTutorial) {
      tutorialBanner.style.display = 'none';
      return;
    }

    tutorialBanner.style.display = 'block';
    const step = this.tutorial.getCurrentStep();
    if (step.tabToActivate) {
      this.activateTab(step.tabToActivate);
    }

    const focusEl = document.querySelector(step.targetSelector);
    if (focusEl) {
      focusEl.setAttribute('data-tutorial-focus', 'true');
    }

    const badgeEl = document.getElementById('tutorial-step-badge');
    if (badgeEl) {
      badgeEl.textContent = `STEP ${step.index + 1} / ${TUTORIAL_STEPS.length}`;
    }

    const titleEl = document.getElementById('tutorial-step-title');
    if (titleEl) {
      titleEl.textContent = i18n.t(step.titleKey as TranslationKey);
    }

    const bodyEl = document.getElementById('tutorial-step-body');
    if (bodyEl) {
      bodyEl.textContent = i18n.t(step.descKey as TranslationKey);
    }

    const btnPrev = document.getElementById('btn-tutorial-prev') as HTMLButtonElement | null;
    const btnNext = document.getElementById('btn-tutorial-next') as HTMLButtonElement | null;
    const btnFinish = document.getElementById('btn-tutorial-finish') as HTMLButtonElement | null;
    const isLast = step.index === TUTORIAL_STEPS.length - 1;

    if (btnPrev) btnPrev.disabled = step.index === 0;
    if (btnNext) btnNext.style.display = isLast ? 'none' : 'inline-flex';
    if (btnFinish) btnFinish.style.display = isLast ? 'inline-flex' : 'none';

    const dotsContainer = document.getElementById('tutorial-dots');
    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      TUTORIAL_STEPS.forEach((s) => {
        const dot = document.createElement('span');
        dot.className = `tutorial-dot${s.index === step.index ? ' active' : ''}`;
        dot.addEventListener('click', () => {
          this.tutorial.currentStepIndex = s.index;
          this.renderTutorialState();
        });
        dotsContainer.appendChild(dot);
      });
    }
  }

  private renderHelpTopicsList(): void {
    const container = document.getElementById('help-topics-list');
    if (!container) return;
    const lang = i18n.getLanguage();
    const topics = this.tutorial.searchHelpTopics(this.helpSearchQuery, lang);
    container.innerHTML = '';
    for (const topic of topics) {
      const card = document.createElement('div');
      card.className = 'help-topic-card';
      const title = lang === 'vi' ? topic.titleVi : topic.titleEn;
      const body = lang === 'vi' ? topic.bodyVi : topic.bodyEn;
      card.innerHTML = `
        <div class="help-topic-title">${title}</div>
        <div class="help-topic-summary">${body}</div>
      `;
      container.appendChild(card);
    }
  }

  private toggleHelpModal(forceOpen?: boolean): void {
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    const isOpen = modal.style.display !== 'none';
    const nextState = forceOpen !== undefined ? forceOpen : !isOpen;
    modal.style.display = nextState ? 'flex' : 'none';
    if (nextState) {
      this.renderHelpTopicsList();
    }
  }

  private bindUIEvents(viewport: HTMLElement): void {
    // Language Switcher Button (Top Bar)
    const btnLang = document.getElementById('btn-lang-toggle') as HTMLButtonElement;
    btnLang.addEventListener('click', () => {
      i18n.toggleLanguage();
    });

    // Creator / Advanced UI Mode Toggle
    document.getElementById('btn-ui-mode')?.addEventListener('click', () => {
      this.tutorial.toggleUIMode();
      this.syncUIModeDom();
    });

    // 3D Graticule & Axial Tilt Indicator Toggle
    const btnGraticule = document.getElementById('btn-graticule') as HTMLButtonElement | null;
    btnGraticule?.addEventListener('click', () => {
      const vis = this.renderer.toggleGraticule();
      btnGraticule.classList.toggle('active', vis);
    });

    // Help & Tutorial Modal Controls
    document.getElementById('btn-open-help')?.addEventListener('click', () => {
      this.toggleHelpModal(true);
    });
    document.getElementById('btn-help-close')?.addEventListener('click', () => {
      this.toggleHelpModal(false);
    });
    document.getElementById('btn-help-restart-tour')?.addEventListener('click', () => {
      this.toggleHelpModal(false);
      this.tutorial.startGuidedTour();
      this.renderTutorialState();
    });
    const inputHelpSearch = document.getElementById('input-help-search') as HTMLInputElement | null;
    inputHelpSearch?.addEventListener('input', () => {
      this.helpSearchQuery = inputHelpSearch.value;
      this.renderHelpTopicsList();
    });

    // Welcome Screen Modal Actions
    document.getElementById('btn-welcome-create')?.addEventListener('click', () => {
      this.tutorial.startGuidedTour();
      this.renderTutorialState();
    });
    document.getElementById('btn-welcome-preset')?.addEventListener('click', () => {
      this.tutorial.skipTutorial();
      this.activateTab('tab-world');
      this.renderTutorialState();
      (document.getElementById('select-preset') as HTMLSelectElement | null)?.focus();
    });
    document.getElementById('btn-welcome-skip')?.addEventListener('click', () => {
      this.tutorial.skipTutorial();
      this.renderTutorialState();
    });

    // 10-Step Guided Tutorial Banner Controls
    document.getElementById('btn-tutorial-prev')?.addEventListener('click', () => {
      this.tutorial.prevStep();
      this.renderTutorialState();
    });
    document.getElementById('btn-tutorial-next')?.addEventListener('click', () => {
      this.tutorial.nextStep();
      this.renderTutorialState();
    });
    document.getElementById('btn-tutorial-skip')?.addEventListener('click', () => {
      this.tutorial.skipTutorial();
      this.renderTutorialState();
    });
    document.getElementById('btn-tutorial-finish')?.addEventListener('click', () => {
      this.tutorial.completeTutorial();
      this.renderTutorialState();
    });

    // Collapsible Side Panels
    const leftPanel = document.getElementById('left-panel')!;
    const rightPanel = document.getElementById('right-panel')!;
    document.getElementById('btn-toggle-left')?.addEventListener('click', () => {
      leftPanel.classList.toggle('collapsed');
    });
    document.getElementById('btn-toggle-right')?.addEventListener('click', () => {
      rightPanel.classList.toggle('collapsed');
    });

    // Keyboard Shortcuts (when not typing in inputs)
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const action = resolveShortcutAction(e.key, e.code);
      if (!action) return;
      if (action === 'TOGGLE_PAUSE') {
        e.preventDefault();
        this.world.paused = !this.world.paused;
        this.syncPauseButtonLabel();
      } else if (action === 'SINGLE_STEP') {
        const t0 = performance.now();
        this.world.singleStep(600);
        this.lastSimStepMs = performance.now() - t0;
        this.renderer.syncWithSimulation(this.world);
        this.updateUIReadouts();
      } else if (action === 'TOGGLE_LEFT_PANEL') {
        leftPanel.classList.toggle('collapsed');
      } else if (action === 'TOGGLE_RIGHT_PANEL') {
        rightPanel.classList.toggle('collapsed');
      } else if (action === 'UNDO') {
        if (this.world.undo()) {
          this.syncSlidersFromParams();
          this.renderer.syncWithSimulation(this.world);
          this.updateUIReadouts();
        }
      } else if (action === 'REDO') {
        if (this.world.redo()) {
          this.syncSlidersFromParams();
          this.renderer.syncWithSimulation(this.world);
          this.updateUIReadouts();
        }
      } else if (action === 'TOGGLE_HELP') {
        this.toggleHelpModal();
      } else if (action === 'TOGGLE_UI_MODE') {
        this.tutorial.toggleUIMode();
        this.syncUIModeDom();
      } else if (action === 'TOGGLE_GRID') {
        const vis = this.renderer.toggleGraticule();
        btnGraticule?.classList.toggle('active', vis);
      }
    });

    // Tabs
    const tabBtns = document.querySelectorAll<HTMLButtonElement>('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.tab!;
        this.activateTab(targetId);
        this.updateUIReadouts();
      });
    });

    // Pause / Resume & Single Step
    const btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
    btnPause.addEventListener('click', () => {
      this.world.paused = !this.world.paused;
      this.syncPauseButtonLabel();
    });

    document.getElementById('btn-step')!.addEventListener('click', () => {
      const t0 = performance.now();
      this.world.singleStep(600);
      this.lastSimStepMs = performance.now() - t0;
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    // Speed preset buttons
    const speedBtns = document.querySelectorAll<HTMLButtonElement>('.speed-btn');
    speedBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const raw = btn.dataset.speed || '1';
        this.world.speedSci = parseSciSpeed(raw);
        speedBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        (document.getElementById('input-custom-speed') as HTMLInputElement).value = raw;
        this.world.updateTelemetry(this.world.telemetry.lastStepStabilityNote);
        this.updateUIReadouts();
      });
    });

    // Custom scientific speed input (supports 1e100, etc.)
    const inputCustomSpeed = document.getElementById('input-custom-speed') as HTMLInputElement;
    document.getElementById('btn-apply-speed')!.addEventListener('click', () => {
      try {
        const parsed = parseSciSpeed(inputCustomSpeed.value);
        this.world.speedSci = parsed;
        speedBtns.forEach((b) => b.classList.remove('active'));
        this.world.logEvent('TIME', `Set custom simulation speed to ${formatSciNumber(parsed, 2)}x`);
        this.world.updateTelemetry(this.world.telemetry.lastStepStabilityNote);
        this.updateUIReadouts();
      } catch {
        alert(`${i18n.t('err.invalid_speed')}: "${inputCustomSpeed.value}"`);
      }
    });

    // Preset & Seed controls
    const selectPreset = document.getElementById('select-preset') as HTMLSelectElement;
    const inputSeed = document.getElementById('input-seed') as HTMLInputElement;

    selectPreset.addEventListener('change', () => {
      const preset = selectPreset.value as PresetName;
      this.world.fullReset(preset);
      inputSeed.value = this.world.params.seed;
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    document.getElementById('btn-regen-seed')!.addEventListener('click', () => {
      const seed = inputSeed.value.trim() || 'HXN-GENESIS';
      this.world.pushUndoState('Regenerate Seed');
      this.world.generateWorldFromSeed(seed);
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    // 3.0 Planet Identity & Physical Properties
    const inputPlanetName = document.getElementById('input-planet-name') as HTMLInputElement | null;
    inputPlanetName?.addEventListener('change', () => {
      this.world.applyPlanetProperties({ name: inputPlanetName.value.trim() || 'Genesis Prime' });
      this.updateUIReadouts();
    });

    const selectTerrainStyle = document.getElementById('select-terrain-style') as HTMLSelectElement | null;
    selectTerrainStyle?.addEventListener('change', () => {
      const style = selectTerrainStyle.value as TerrainStyle;
      this.world.regenerateTerrainWithSettings({ style });
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    this.bindParamSlider('slider-planet-radius', 'val-planet-radius', (v) => {
      this.world.applyPlanetProperties({ radiusKm: v });
      return `${Math.round(v)} km (${(v / EARTH_RADIUS_KM).toFixed(2)} R⊕)`;
    });

    this.bindParamSlider('slider-planet-mass', 'val-planet-mass', (v) => {
      this.world.applyPlanetProperties({ massEarth: v });
      return `${v.toFixed(2)} M⊕`;
    });

    this.bindParamSlider('slider-rotation-period', 'val-rotation-period', (v) => {
      this.world.applyPlanetProperties({ rotationHours: v });
      return `${v.toFixed(1)} hr`;
    });

    const selectStarType = document.getElementById('select-star-type') as HTMLSelectElement | null;
    selectStarType?.addEventListener('change', () => {
      const starType = selectStarType.value as StarType;
      this.world.pushUndoState('Change Host Star Type');
      this.world.applyPlanetProperties({ starType });
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    this.bindParamSlider('slider-orbital-distance', 'val-orbital-distance', (v) => {
      this.world.applyPlanetProperties({ orbitalDistanceAU: v });
      return `${v.toFixed(2)} AU`;
    });

    this.bindParamSlider('slider-eccentricity', 'val-eccentricity', (v) => {
      this.world.applyPlanetProperties({ eccentricity: v });
      return v.toFixed(3);
    });

    this.bindParamSlider('slider-gravity-override', 'val-gravity-override', (v) => {
      if (v <= 0.05) {
        this.world.applyPlanetProperties({ gravityOverrideMs2: null });
        return 'Auto (GM/R²)';
      }
      this.world.applyPlanetProperties({ gravityOverrideMs2: v });
      return `${v.toFixed(2)} m/s²`;
    });

    // Advanced Terrain Generator sliders
    this.bindParamSlider('slider-roughness', 'val-roughness', (v) => {
      if (this.world.params.terrain) this.world.params.terrain.roughness = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-mountain-height', 'val-mountain-height', (v) => {
      if (this.world.params.terrain) this.world.params.terrain.mountainHeight = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-continent-scale', 'val-continent-scale', (v) => {
      if (this.world.params.terrain) this.world.params.terrain.continentScale = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-crater-density', 'val-crater-density', (v) => {
      if (this.world.params.terrain) this.world.params.terrain.craterDensity = v;
      return `${Math.round(v * 100)}%`;
    });
    this.bindParamSlider('slider-plateaus', 'val-plateaus', (v) => {
      if (this.world.params.terrain) this.world.params.terrain.plateaus = v;
      return `${Math.round(v * 100)}%`;
    });

    document.getElementById('btn-regen-terrain')?.addEventListener('click', () => {
      this.world.regenerateTerrainWithSettings(this.world.params.terrain ?? {});
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    // Geology & Plate Tectonics controls
    this.bindParamSlider('slider-internal-heat', 'val-internal-heat', (v) => {
      if (this.world.params.geology) this.world.params.geology.internalHeat = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-crust-thickness', 'val-crust-thickness', (v) => {
      if (this.world.params.geology) this.world.params.geology.crustThicknessKm = v;
      return `${Math.round(v)} km`;
    });
    this.bindParamSlider('slider-mantle-activity', 'val-mantle-activity', (v) => {
      if (this.world.params.geology) this.world.params.geology.mantleActivity = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-tectonic-activity', 'val-tectonic-activity', (v) => {
      if (this.world.params.geology) this.world.params.geology.tectonicActivity = v;
      return `${v.toFixed(2)}x`;
    });

    document.getElementById('btn-tectonic-pulse')?.addEventListener('click', () => {
      this.world.triggerTectonicPulse(1.0);
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    // Visual Quality Selector
    const selectQuality = document.getElementById('select-quality') as HTMLSelectElement;
    selectQuality.addEventListener('change', () => {
      const q = selectQuality.value as VisualQualityPreset;
      this.renderer.setVisualQuality(q);
      this.renderer.syncWithSimulation(this.world);
    });

    // Target Ocean Coverage (%)
    const sliderOceanTarget = document.getElementById('slider-ocean-target') as HTMLInputElement | null;
    sliderOceanTarget?.addEventListener('change', () => this.world.pushUndoState('Adjust Ocean Coverage'));
    sliderOceanTarget?.addEventListener('input', () => {
      const pct = parseFloat(sliderOceanTarget.value);
      document.getElementById('val-ocean-target')!.textContent = `${Math.round(pct)}%`;
      this.world.setOceanCoverageFraction(pct / 100);
      (document.getElementById('slider-sealevel') as HTMLInputElement).value = String(this.world.params.seaLevelMeters);
      document.getElementById('val-sealevel')!.textContent = `${this.world.params.seaLevelMeters} m`;
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    // Sea Level & Terrain Scale
    const sliderSea = document.getElementById('slider-sealevel') as HTMLInputElement;
    sliderSea.addEventListener('change', () => this.world.pushUndoState('Change Sea Level'));
    sliderSea.addEventListener('input', () => {
      this.world.params.seaLevelMeters = parseFloat(sliderSea.value);
      document.getElementById('val-sealevel')!.textContent = `${this.world.params.seaLevelMeters} m`;
      this.world.updateTelemetry('Sea level datum adjusted');
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    const sliderTerrain = document.getElementById('slider-terrain-scale') as HTMLInputElement;
    sliderTerrain.addEventListener('change', () => this.world.pushUndoState('Change Crust Scale'));
    sliderTerrain.addEventListener('input', () => {
      const scale = parseFloat(sliderTerrain.value);
      document.getElementById('val-terrain-scale')!.textContent = `${scale.toFixed(2)}x`;
      this.world.setTerrainScale(scale);
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    // Global Ice Impulse
    const sliderIce = document.getElementById('slider-ice-impulse') as HTMLInputElement;
    sliderIce.addEventListener('input', () => {
      document.getElementById('val-ice-impulse')!.textContent = `${sliderIce.value}%`;
    });
    document.getElementById('btn-apply-ice')!.addEventListener('click', () => {
      const frac = parseFloat(sliderIce.value) / 100.0;
      this.world.applyGlobalIceImpulse(frac);
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    // Visualization Layer buttons
    const layerBtns = document.querySelectorAll<HTMLButtonElement>('.layer-btn');
    layerBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        layerBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderer.overlayMode = btn.dataset.layer as OverlayLayerMode;
        this.renderer.syncWithSimulation(this.world);
      });
    });

    // Camera Preset buttons
    document.querySelectorAll<HTMLButtonElement>('.cam-preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = (btn.dataset.camPreset || 'DEFAULT') as CameraPresetMode;
        this.renderer.setCameraPreset(preset);
      });
    });

    // Undo / Redo / Resets
    document.getElementById('btn-undo')!.addEventListener('click', () => {
      if (this.world.undo()) {
        this.syncSlidersFromParams();
        this.renderer.syncWithSimulation(this.world);
        this.updateUIReadouts();
      }
    });
    document.getElementById('btn-redo')!.addEventListener('click', () => {
      if (this.world.redo()) {
        this.syncSlidersFromParams();
        this.renderer.syncWithSimulation(this.world);
        this.updateUIReadouts();
      }
    });
    document.getElementById('btn-reset-partial')!.addEventListener('click', () => {
      this.world.resetClimateOnly();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });
    document.getElementById('btn-reset-full')!.addEventListener('click', () => {
      this.world.fullReset(this.world.params.preset, this.world.params.seed);
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    // Atmosphere & Climate Sliders
    this.bindParamSlider('slider-pressure-bar', 'val-pressure-bar', (v) => {
      this.world.setSurfacePressure(v);
      return `${v.toFixed(2)} bar`;
    });
    this.bindParamSlider('slider-co2', 'val-co2', (v) => {
      this.world.setAtmosphereGas('CO2', v);
      return `${Math.round(this.world.params.co2Ppm)} ppm`;
    });
    this.bindParamSlider('slider-o2', 'val-o2', (v) => {
      this.world.setAtmosphereGas('O2', v);
      return `${(this.world.params.o2Percent ?? v).toFixed(1)}%`;
    });
    this.bindParamSlider('slider-argon', 'val-argon', (v) => {
      this.world.setAtmosphereGas('AR', v);
      return `${(this.world.params.argonPercent ?? v).toFixed(2)}%`;
    });
    this.bindParamSlider('slider-o2-eff', 'val-o2-eff', (v) => {
      this.world.params.oxygenProductionEfficiency = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-solar', 'val-solar', (v) => {
      this.world.params.solarLuminosity = v;
      return `${v.toFixed(2)} S₀ (${Math.round(v * 1361)} W/m²)`;
    });
    this.bindParamSlider('slider-tilt', 'val-tilt', (v) => {
      this.world.params.axialTiltDeg = v;
      return `${v.toFixed(1)}°`;
    });
    this.bindParamSlider('slider-temp-offset', 'val-temp-offset', (v) => {
      this.world.params.temperatureOffsetK = v;
      return `${v >= 0 ? '+' : ''}${v.toFixed(1)} K`;
    });
    this.bindParamSlider('slider-humidity', 'val-humidity', (v) => {
      this.world.params.humidityMultiplier = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-wind', 'val-wind', (v) => {
      this.world.params.windIntensity = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-precip', 'val-precip', (v) => {
      this.world.params.precipitationMultiplier = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-volcanism', 'val-volcanism', (v) => {
      this.world.params.volcanicActivity = v;
      return `${v.toFixed(2)}x`;
    });

    // Evolutionary Sliders
    this.bindParamSlider('slider-mutation-rate', 'val-mutation-rate', (v) => {
      this.world.params.mutationRate = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-selection-pressure', 'val-selection-pressure', (v) => {
      this.world.params.selectionPressure = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-reproduction-mult', 'val-reproduction-mult', (v) => {
      this.world.params.reproductionMultiplier = v;
      return `${v.toFixed(2)}x`;
    });
    this.bindParamSlider('slider-extinction-susc', 'val-extinction-susc', (v) => {
      this.world.params.extinctionSusceptibility = v;
      return `${v.toFixed(2)}x`;
    });

    const chkAbiogenesis = document.getElementById('chk-abiogenesis') as HTMLInputElement;
    chkAbiogenesis.addEventListener('change', () => {
      this.world.params.abiogenesisEnabled = chkAbiogenesis.checked;
    });

    const chkDayNight = document.getElementById('chk-daynight') as HTMLInputElement;
    chkDayNight.addEventListener('change', () => {
      this.world.params.dayNightCycleEnabled = chkDayNight.checked;
    });

    const sliderSunLon = document.getElementById('slider-sun-lon') as HTMLInputElement;
    sliderSunLon.addEventListener('input', () => {
      const deg = parseFloat(sliderSunLon.value);
      this.world.params.dayNightCycleEnabled = false;
      chkDayNight.checked = false;
      this.world.params.sunLongitudeRad = (deg * Math.PI) / 180;
      document.getElementById('val-sun-lon')!.textContent = `${deg}°`;
      this.renderer.syncWithSimulation(this.world);
    });

    // Global Biosphere Actions
    document.getElementById('btn-seed-global')!.addEventListener('click', () => {
      this.world.seedGlobalBiosphere(true);
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    document.getElementById('btn-sterilize-planet')!.addEventListener('click', () => {
      if (this.world.telemetry.globalBiomassFraction > 0.001 && !window.confirm(i18n.t('confirm.sterilize'))) {
        return;
      }
      this.world.sterilizeBiosphere();
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    // Sculpt, Life Seeding & Hazard Tools
    const toolBtns = document.querySelectorAll<HTMLButtonElement>('.tool-btn');
    toolBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        toolBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeTool = btn.dataset.tool as ClickToolMode;
        if (this.activeTool === 'INSPECT') {
          this.renderer.setHoverPreview(0, 0, 12, false);
        }
      });
    });

    const sliderRadius = document.getElementById('slider-brush-radius') as HTMLInputElement;
    sliderRadius.addEventListener('input', () => {
      this.brushRadiusDeg = parseFloat(sliderRadius.value);
      document.getElementById('val-brush-radius')!.textContent = `${this.brushRadiusDeg}°`;
    });

    const sliderStrength = document.getElementById('slider-brush-strength') as HTMLInputElement;
    sliderStrength.addEventListener('input', () => {
      this.brushStrength = parseFloat(sliderStrength.value) / 100.0;
      document.getElementById('val-brush-strength')!.textContent = `${sliderStrength.value}%`;
    });

    const selectFalloff = document.getElementById('select-brush-falloff') as HTMLSelectElement | null;
    selectFalloff?.addEventListener('change', () => {
      this.brushFalloff = selectFalloff.value as BrushFalloff;
    });

    const selectShape = document.getElementById('select-brush-shape') as HTMLSelectElement | null;
    selectShape?.addEventListener('change', () => {
      this.brushShape = selectShape.value as BrushShape;
    });

    const selectSymmetry = document.getElementById('select-brush-symmetry') as HTMLSelectElement | null;
    selectSymmetry?.addEventListener('change', () => {
      this.brushSymmetry = selectSymmetry.value as BrushSymmetry;
    });

    // Global Planetary Experiments
    document.querySelectorAll<HTMLButtonElement>('.global-exp-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const expType = btn.dataset.globalExp as GlobalExperimentEventType;
        if (
          eventRequiresConfirmation(expType) &&
          !window.confirm(i18n.t('confirm.sterilize'))
        ) {
          return;
        }
        this.world.triggerGlobalExperiment(expType);
        this.syncSlidersFromParams();
        this.renderer.syncWithSimulation(this.world);
        this.updateUIReadouts();
      });
    });

    document.getElementById('btn-trigger-flora')!.addEventListener('click', () => {
      const radiusRad = (this.brushRadiusDeg * Math.PI) / 180;
      this.world.seedLifeAtLatLon('FAUNA', this.selectedLat, this.selectedLon, this.brushStrength, radiusRad);
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });
    document.getElementById('btn-trigger-meteor')!.addEventListener('click', () => {
      this.world.triggerHazard('METEOR', this.selectedLat, this.selectedLon, this.brushStrength);
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });
    document.getElementById('btn-trigger-volcano')!.addEventListener('click', () => {
      this.world.triggerHazard('VOLCANO', this.selectedLat, this.selectedLon, this.brushStrength);
      this.syncSlidersFromParams();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });
    document.getElementById('btn-trigger-quake')!.addEventListener('click', () => {
      this.world.triggerHazard('EARTHQUAKE', this.selectedLat, this.selectedLon, this.brushStrength);
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });
    document.getElementById('btn-trigger-tsunami')!.addEventListener('click', () => {
      this.world.triggerHazard('TSUNAMI', this.selectedLat, this.selectedLon, this.brushStrength);
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });
    document.getElementById('btn-trigger-storm')!.addEventListener('click', () => {
      this.world.triggerHazard('STORM', this.selectedLat, this.selectedLon, this.brushStrength);
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });
    document.getElementById('btn-trigger-flood')!.addEventListener('click', () => {
      this.world.triggerHazard('FLOOD', this.selectedLat, this.selectedLon, this.brushStrength);
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });
    document.getElementById('btn-focus-coord')!.addEventListener('click', () => {
      this.renderer.focusOnLatLon(this.selectedLat, this.selectedLon);
    });

    // Evolution Lab controls
    const selectChartMetric = document.getElementById('select-chart-metric') as HTMLSelectElement;
    selectChartMetric.addEventListener('change', () => {
      this.chartMetricMode = selectChartMetric.value as typeof this.chartMetricMode;
      this.renderEvoChart();
    });

    const inputSpeciesSearch = document.getElementById('input-species-search') as HTMLInputElement;
    inputSpeciesSearch.addEventListener('input', () => {
      this.speciesSearchQuery = inputSpeciesSearch.value.trim().toLowerCase();
      this.renderSpeciesExplorer();
    });

    // Checkpoints, World Library & Save/Load JSON
    document.getElementById('btn-save-checkpoint')!.addEventListener('click', () => {
      const labelInput = document.getElementById('input-checkpoint-name') as HTMLInputElement;
      const entries = this.worldLibrary.listWorlds();
      const label = labelInput.value.trim() || `Epoch ${entries.length + 1}`;
      const snap = this.world.serializeSnapshot(label);
      this.worldLibrary.saveWorld(label, snap);
      this.world.logEvent('SYSTEM', `Saved checkpoint "${label}"`);
      this.renderCheckpointsList();
      this.updateUIReadouts();
    });

    document.getElementById('btn-load-autosave')?.addEventListener('click', () => {
      const autoSnap = this.worldLibrary.loadAutosave();
      if (!autoSnap) return;
      this.world.loadSnapshot(autoSnap);
      this.syncSlidersFromParams();
      this.syncPauseButtonLabel();
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });

    document.getElementById('btn-export-json')!.addEventListener('click', () => {
      const snap = this.world.serializeSnapshot(`Export-${this.world.params.seed}`);
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hxn-genesis-${this.world.params.seed}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    const inputImport = document.getElementById('input-import-json') as HTMLInputElement;
    inputImport.addEventListener('change', () => {
      const file = inputImport.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const snap = parseAndValidateWorldJson(String(reader.result));
          this.world.loadSnapshot(snap);
          this.syncSlidersFromParams();
          this.renderer.syncWithSimulation(this.world);
          this.updateUIReadouts();
        } catch (err) {
          alert(`${i18n.t('err.import_failed')}: ${(err as Error).message}`);
        }
      };
      reader.readAsText(file);
    });

    // 3D Globe Pointer Raycast Interaction + Brush Preview Ring
    viewport.addEventListener('pointermove', (e) => {
      if (this.activeTool === 'INSPECT') {
        this.renderer.setHoverPreview(0, 0, 12, false);
        return;
      }
      const hit = this.renderer.raycastCoordinate(e.clientX, e.clientY);
      if (!hit) {
        this.renderer.setHoverPreview(0, 0, 12, false);
        return;
      }
      const isSculpt = Boolean(SCULPT_TOOL_MAP[this.activeTool]);
      const color =
        this.activeTool.startsWith('SEED_') ? 0x10b981 :
        isSculpt ? 0x38bdf8 : 0xef4444;
      this.renderer.setHoverPreview(hit.latDeg, hit.lonDeg, this.brushRadiusDeg, true, color);
    });

    viewport.addEventListener('pointerdown', (e) => {
      this.pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    viewport.addEventListener('pointerup', (e) => {
      const moveDist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
      if (moveDist > 6) return;

      const hit = this.renderer.raycastCoordinate(e.clientX, e.clientY);
      if (!hit) return;

      this.selectedLat = hit.latDeg;
      this.selectedLon = hit.lonDeg;
      this.renderer.setSelectionMarker(this.selectedLat, this.selectedLon);

      const radiusRad = (this.brushRadiusDeg * Math.PI) / 180;
      const sculptBrush = SCULPT_TOOL_MAP[this.activeTool];

      if (this.activeTool === 'SEED_MICROBES') {
        this.world.seedLifeAtLatLon('MICROBES', this.selectedLat, this.selectedLon, this.brushStrength, radiusRad);
        this.syncSlidersFromParams();
        this.renderer.syncWithSimulation(this.world);
      } else if (this.activeTool === 'SEED_FLORA') {
        this.world.seedLifeAtLatLon('FLORA', this.selectedLat, this.selectedLon, this.brushStrength, radiusRad);
        this.syncSlidersFromParams();
        this.renderer.syncWithSimulation(this.world);
      } else if (this.activeTool === 'SEED_FAUNA') {
        this.world.seedLifeAtLatLon('FAUNA', this.selectedLat, this.selectedLon, this.brushStrength, radiusRad);
        this.syncSlidersFromParams();
        this.renderer.syncWithSimulation(this.world);
      } else if (sculptBrush) {
        this.world.applyBrushStroke(
          {
            tool: sculptBrush,
            latDeg: this.selectedLat,
            lonDeg: this.selectedLon,
            radiusRad,
            strength: this.brushStrength,
            falloff: this.brushFalloff,
            shape: this.brushShape,
            symmetry: this.brushSymmetry
          },
          true
        );
        this.renderer.syncWithSimulation(this.world);
      } else if (
        this.activeTool === 'VOLCANO' ||
        this.activeTool === 'EARTHQUAKE' ||
        this.activeTool === 'TSUNAMI' ||
        this.activeTool === 'STORM' ||
        this.activeTool === 'DROUGHT' ||
        this.activeTool === 'FLOOD' ||
        this.activeTool === 'METEOR'
      ) {
        this.world.triggerHazard(this.activeTool, this.selectedLat, this.selectedLon, this.brushStrength);
        this.syncSlidersFromParams();
        this.renderer.syncWithSimulation(this.world);
      }

      this.updateUIReadouts();
    });
  }

  private bindParamSlider(
    sliderId: string,
    valId: string,
    applyFn: (val: number) => string
  ): void {
    const slider = document.getElementById(sliderId) as HTMLInputElement | null;
    const valEl = document.getElementById(valId);
    if (!slider || !valEl) return;
    slider.addEventListener('change', () => {
      this.world.pushUndoState(`Adjust ${sliderId}`);
      this.updateUIReadouts();
    });
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      valEl.textContent = applyFn(v);
      this.world.updateTelemetry('Updated parameter');
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    });
  }

  private syncSlidersFromParams(): void {
    const p = this.world.params;
    (document.getElementById('select-preset') as HTMLSelectElement).value = p.preset;
    (document.getElementById('input-seed') as HTMLInputElement).value = p.seed;

    if (p.planet) {
      const nameInput = document.getElementById('input-planet-name') as HTMLInputElement | null;
      if (nameInput) nameInput.value = p.planet.name;

      const radSlider = document.getElementById('slider-planet-radius') as HTMLInputElement | null;
      if (radSlider) {
        radSlider.value = String(p.planet.radiusKm);
        document.getElementById('val-planet-radius')!.textContent =
          `${Math.round(p.planet.radiusKm)} km (${(p.planet.radiusKm / EARTH_RADIUS_KM).toFixed(2)} R⊕)`;
      }

      const massSlider = document.getElementById('slider-planet-mass') as HTMLInputElement | null;
      if (massSlider) {
        massSlider.value = String(p.planet.massEarth);
        document.getElementById('val-planet-mass')!.textContent = `${p.planet.massEarth.toFixed(2)} M⊕`;
      }

      const rotSlider = document.getElementById('slider-rotation-period') as HTMLInputElement | null;
      if (rotSlider) {
        rotSlider.value = String(p.planet.rotationHours);
        document.getElementById('val-rotation-period')!.textContent = `${p.planet.rotationHours.toFixed(1)} hr`;
      }

      const starSelect = document.getElementById('select-star-type') as HTMLSelectElement | null;
      if (starSelect) starSelect.value = p.planet.starType;

      const orbSlider = document.getElementById('slider-orbital-distance') as HTMLInputElement | null;
      if (orbSlider) {
        orbSlider.value = String(p.planet.orbitalDistanceAU);
        document.getElementById('val-orbital-distance')!.textContent = `${p.planet.orbitalDistanceAU.toFixed(2)} AU`;
      }

      const eccSlider = document.getElementById('slider-eccentricity') as HTMLInputElement | null;
      if (eccSlider) {
        eccSlider.value = String(p.planet.eccentricity);
        document.getElementById('val-eccentricity')!.textContent = p.planet.eccentricity.toFixed(3);
      }

      const gravSlider = document.getElementById('slider-gravity-override') as HTMLInputElement | null;
      if (gravSlider) {
        const gOver = p.planet.gravityOverrideMs2 ?? 0;
        gravSlider.value = String(gOver);
        document.getElementById('val-gravity-override')!.textContent =
          gOver > 0 ? `${gOver.toFixed(2)} m/s²` : 'Auto (GM/R²)';
      }
    }

    if (p.terrain) {
      const styleSelect = document.getElementById('select-terrain-style') as HTMLSelectElement | null;
      if (styleSelect) styleSelect.value = p.terrain.style;

      const roughSlider = document.getElementById('slider-roughness') as HTMLInputElement | null;
      if (roughSlider) {
        roughSlider.value = String(p.terrain.roughness);
        document.getElementById('val-roughness')!.textContent = `${p.terrain.roughness.toFixed(2)}x`;
      }

      const mtnSlider = document.getElementById('slider-mountain-height') as HTMLInputElement | null;
      if (mtnSlider) {
        mtnSlider.value = String(p.terrain.mountainHeight);
        document.getElementById('val-mountain-height')!.textContent = `${p.terrain.mountainHeight.toFixed(2)}x`;
      }

      const contSlider = document.getElementById('slider-continent-scale') as HTMLInputElement | null;
      if (contSlider) {
        contSlider.value = String(p.terrain.continentScale);
        document.getElementById('val-continent-scale')!.textContent = `${p.terrain.continentScale.toFixed(2)}x`;
      }

      const cratSlider = document.getElementById('slider-crater-density') as HTMLInputElement | null;
      if (cratSlider) {
        cratSlider.value = String(p.terrain.craterDensity);
        document.getElementById('val-crater-density')!.textContent = `${Math.round(p.terrain.craterDensity * 100)}%`;
      }

      const platSlider = document.getElementById('slider-plateaus') as HTMLInputElement | null;
      if (platSlider) {
        platSlider.value = String(p.terrain.plateaus);
        document.getElementById('val-plateaus')!.textContent = `${Math.round(p.terrain.plateaus * 100)}%`;
      }

      const oceanSlider = document.getElementById('slider-ocean-target') as HTMLInputElement | null;
      if (oceanSlider) {
        const pct = Math.round((this.world.telemetry.oceanCoverageFraction ?? 0.7) * 100);
        oceanSlider.value = String(pct);
        document.getElementById('val-ocean-target')!.textContent = `${pct}%`;
      }
    }

    if (p.geology) {
      const heatSlider = document.getElementById('slider-internal-heat') as HTMLInputElement | null;
      if (heatSlider) {
        heatSlider.value = String(p.geology.internalHeat);
        document.getElementById('val-internal-heat')!.textContent = `${p.geology.internalHeat.toFixed(2)}x`;
      }
      const crustSlider = document.getElementById('slider-crust-thickness') as HTMLInputElement | null;
      if (crustSlider) {
        crustSlider.value = String(p.geology.crustThicknessKm);
        document.getElementById('val-crust-thickness')!.textContent = `${Math.round(p.geology.crustThicknessKm)} km`;
      }
      const mantleSlider = document.getElementById('slider-mantle-activity') as HTMLInputElement | null;
      if (mantleSlider) {
        mantleSlider.value = String(p.geology.mantleActivity);
        document.getElementById('val-mantle-activity')!.textContent = `${p.geology.mantleActivity.toFixed(2)}x`;
      }
      const tecSlider = document.getElementById('slider-tectonic-activity') as HTMLInputElement | null;
      if (tecSlider) {
        tecSlider.value = String(p.geology.tectonicActivity);
        document.getElementById('val-tectonic-activity')!.textContent = `${p.geology.tectonicActivity.toFixed(2)}x`;
      }
    }

    (document.getElementById('slider-sealevel') as HTMLInputElement).value = String(p.seaLevelMeters);
    document.getElementById('val-sealevel')!.textContent = `${p.seaLevelMeters} m`;

    (document.getElementById('slider-terrain-scale') as HTMLInputElement).value = String(p.terrainScale);
    document.getElementById('val-terrain-scale')!.textContent = `${p.terrainScale.toFixed(2)}x`;

    const press = p.pressureBar ?? 1.0;
    const pressSlider = document.getElementById('slider-pressure-bar') as HTMLInputElement | null;
    if (pressSlider) {
      pressSlider.value = String(press);
      document.getElementById('val-pressure-bar')!.textContent = `${press.toFixed(2)} bar`;
    }

    (document.getElementById('slider-co2') as HTMLInputElement).value = String(p.co2Ppm);
    document.getElementById('val-co2')!.textContent = `${Math.round(p.co2Ppm)} ppm`;

    const o2 = p.o2Percent ?? 0.1;
    (document.getElementById('slider-o2') as HTMLInputElement).value = String(o2);
    document.getElementById('val-o2')!.textContent = `${o2.toFixed(1)}%`;

    const ar = p.argonPercent ?? 0.93;
    const arSlider = document.getElementById('slider-argon') as HTMLInputElement | null;
    if (arSlider) {
      arSlider.value = String(ar);
      document.getElementById('val-argon')!.textContent = `${ar.toFixed(2)}%`;
    }

    const o2Eff = p.oxygenProductionEfficiency ?? 1.0;
    (document.getElementById('slider-o2-eff') as HTMLInputElement).value = String(o2Eff);
    document.getElementById('val-o2-eff')!.textContent = `${o2Eff.toFixed(2)}x`;

    (document.getElementById('chk-abiogenesis') as HTMLInputElement).checked = p.abiogenesisEnabled ?? true;

    (document.getElementById('slider-solar') as HTMLInputElement).value = String(p.solarLuminosity);
    document.getElementById('val-solar')!.textContent = `${p.solarLuminosity.toFixed(2)} S₀ (${Math.round(p.solarLuminosity * 1361)} W/m²)`;

    (document.getElementById('slider-tilt') as HTMLInputElement).value = String(p.axialTiltDeg);
    document.getElementById('val-tilt')!.textContent = `${p.axialTiltDeg.toFixed(1)}°`;

    (document.getElementById('slider-temp-offset') as HTMLInputElement).value = String(p.temperatureOffsetK);
    document.getElementById('val-temp-offset')!.textContent = `${p.temperatureOffsetK >= 0 ? '+' : ''}${p.temperatureOffsetK.toFixed(1)} K`;

    (document.getElementById('slider-humidity') as HTMLInputElement).value = String(p.humidityMultiplier);
    document.getElementById('val-humidity')!.textContent = `${p.humidityMultiplier.toFixed(2)}x`;

    (document.getElementById('slider-wind') as HTMLInputElement).value = String(p.windIntensity);
    document.getElementById('val-wind')!.textContent = `${p.windIntensity.toFixed(2)}x`;

    (document.getElementById('slider-precip') as HTMLInputElement).value = String(p.precipitationMultiplier);
    document.getElementById('val-precip')!.textContent = `${p.precipitationMultiplier.toFixed(2)}x`;

    (document.getElementById('slider-volcanism') as HTMLInputElement).value = String(p.volcanicActivity);
    document.getElementById('val-volcanism')!.textContent = `${p.volcanicActivity.toFixed(2)}x`;

    const mut = p.mutationRate ?? 1.0;
    (document.getElementById('slider-mutation-rate') as HTMLInputElement).value = String(mut);
    document.getElementById('val-mutation-rate')!.textContent = `${mut.toFixed(2)}x`;

    const sel = p.selectionPressure ?? 1.0;
    (document.getElementById('slider-selection-pressure') as HTMLInputElement).value = String(sel);
    document.getElementById('val-selection-pressure')!.textContent = `${sel.toFixed(2)}x`;

    const rep = p.reproductionMultiplier ?? 1.0;
    (document.getElementById('slider-reproduction-mult') as HTMLInputElement).value = String(rep);
    document.getElementById('val-reproduction-mult')!.textContent = `${rep.toFixed(2)}x`;

    const ext = p.extinctionSusceptibility ?? 1.0;
    (document.getElementById('slider-extinction-susc') as HTMLInputElement).value = String(ext);
    document.getElementById('val-extinction-susc')!.textContent = `${ext.toFixed(2)}x`;
  }

  private renderCheckpointsList(): void {
    const container = document.getElementById('checkpoint-list')!;
    container.innerHTML = '';
    const entries = this.worldLibrary.listWorlds();
    entries.forEach((entry) => {
      const cp = entry.snapshot;
      const div = document.createElement('div');
      div.className = 'list-item';
      const info = document.createElement('div');
      const presetTranslated = i18n.translatePresetName(cp.params.preset);
      info.innerHTML = `<strong>${entry.name}</strong><div class="list-item-meta">${presetTranslated} | ${i18n.t('label.steps')}: ${cp.timeState.stepsComputed}</div>`;

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '4px';

      const btnLoad = document.createElement('button');
      btnLoad.className = 'btn btn-accent';
      btnLoad.textContent = i18n.t('btn.restore_checkpoint');
      btnLoad.addEventListener('click', () => {
        this.world.loadSnapshot(entry.snapshot);
        this.syncSlidersFromParams();
        this.syncPauseButtonLabel();
        this.renderer.syncWithSimulation(this.world);
        this.updateUIReadouts();
      });

      const btnDup = document.createElement('button');
      btnDup.className = 'btn';
      btnDup.textContent = i18n.t('btn.duplicate_world');
      btnDup.addEventListener('click', () => {
        this.worldLibrary.duplicateWorld(entry.id);
        this.renderCheckpointsList();
      });

      const btnDel = document.createElement('button');
      btnDel.className = 'btn btn-danger';
      btnDel.textContent = i18n.t('btn.delete_world');
      btnDel.addEventListener('click', () => {
        this.worldLibrary.deleteWorld(entry.id);
        this.renderCheckpointsList();
      });

      actions.appendChild(btnLoad);
      actions.appendChild(btnDup);
      actions.appendChild(btnDel);

      div.appendChild(info);
      div.appendChild(actions);
      container.appendChild(div);
    });
  }

  private renderEvoChart(): void {
    const canvas = document.getElementById('evo-chart-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
    ctx.lineWidth = 1;
    for (let g = 1; g <= 3; g++) {
      const y = (h * g) / 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const hist = this.world.telemetryHistory;
    if (hist.length < 2) return;

    const drawSeries = (
      values: number[],
      minVal: number,
      maxVal: number,
      color: string
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      const span = Math.max(1e-6, maxVal - minVal);
      for (let i = 0; i < values.length; i++) {
        const x = (i / Math.max(1, values.length - 1)) * (w - 8) + 4;
        const norm = Math.max(0, Math.min(1, (values[i] - minVal) / span));
        const y = h - 6 - norm * (h - 14);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    if (this.chartMetricMode === 'bio_fauna') {
      drawSeries(hist.map((p) => p.biomassPercent), 0, 100, '#10b981');
      drawSeries(hist.map((p) => p.faunaPercent), 0, 100, '#f59e0b');
    } else if (this.chartMetricMode === 'biodiv') {
      drawSeries(hist.map((p) => p.biodiversityIndex), 0, 2.5, '#38bdf8');
      drawSeries(hist.map((p) => p.livingSpeciesCount), 0, 12, '#c084fc');
    } else if (this.chartMetricMode === 'temp_hab') {
      drawSeries(hist.map((p) => p.meanTempC), -40, 60, '#ef4444');
      drawSeries(hist.map((p) => p.habitabilityPercent), 0, 100, '#38bdf8');
    } else if (this.chartMetricMode === 'atmo') {
      drawSeries(hist.map((p) => p.o2Percent), 0, 35, '#38bdf8');
      drawSeries(hist.map((p) => p.co2Ppm), 50, 4000, '#f97316');
    }
  }

  private renderSpeciesExplorer(): void {
    const container = document.getElementById('species-explorer-list');
    if (!container) return;

    const t = this.world.telemetry;
    document.getElementById('evo-stat-living')!.textContent = String(t.livingSpeciesCount);
    document.getElementById('evo-stat-extinct')!.textContent = String(t.extinctSpeciesCount);
    document.getElementById('evo-stat-shannon')!.textContent = t.biodiversityIndex.toFixed(2);
    const trendPct = t.recoveryTrend * 100;
    document.getElementById('evo-stat-trend')!.textContent = `${trendPct >= 0 ? '+' : ''}${trendPct.toFixed(1)}%`;

    const allLineages = this.world.speciesLineages;
    if (allLineages.length === 0) {
      container.innerHTML = `<div class="micro-note">${i18n.t('evo.no_species')}</div>`;
      return;
    }

    const q = this.speciesSearchQuery;
    const filtered = allLineages.filter((sp) => {
      if (!q) return true;
      return (
        sp.name.toLowerCase().includes(q) ||
        sp.guild.toLowerCase().includes(q) ||
        sp.dominantBiome.toLowerCase().includes(q) ||
        sp.innovations.some((inn) => inn.toLowerCase().includes(q))
      );
    });

    container.innerHTML = '';
    const byId = new Map(allLineages.map((s) => [s.id, s]));
    const totalPop = Math.max(
      1,
      allLineages.filter((s) => !s.isExtinct).reduce((acc, s) => acc + s.populationEstimate, 0)
    );

    // Show living species first, then extinct
    const sorted = [...filtered].sort((a, b) => {
      if (a.isExtinct !== b.isExtinct) return a.isExtinct ? 1 : -1;
      return b.populationEstimate - a.populationEstimate;
    });

    for (const sp of sorted) {
      const card = document.createElement('div');
      card.className = `species-card${sp.isExtinct ? ' extinct' : ''}`;

      const parent = sp.parentId ? byId.get(sp.parentId) : null;
      const ancestorLabel = parent
        ? `${i18n.t('evo.parent_prefix')}: ${parent.name}`
        : i18n.t('evo.ancestor_root');

      const optTempC = (sp.traits.optimalTempK - 273.15).toFixed(1);
      const popShare = sp.isExtinct ? 0 : sp.populationEstimate / totalPop;
      const popPct = (popShare * 100).toFixed(1);

      const header = document.createElement('div');
      header.className = 'species-header';
      header.innerHTML = `
        <span class="species-name">${sp.name}</span>
        <span class="species-status${sp.isExtinct ? ' extinct' : ''}">
          ${sp.isExtinct ? i18n.t('evo.status_extinct') : i18n.t('evo.status_alive')}
        </span>
      `;
      card.appendChild(header);

      const meta = document.createElement('div');
      meta.className = 'species-meta';
      meta.textContent = `${sp.guild} | ${ancestorLabel} | Pop: ${popPct}%`;
      card.appendChild(meta);

      const traitsRow = document.createElement('div');
      traitsRow.className = 'species-traits';
      const pills = [
        `T_opt: ${optTempC}°C`,
        `O₂≥${sp.traits.minOxygenRequired.toFixed(1)}%`,
        `Resilience: ${(sp.traits.stressResistance * 100).toFixed(0)}%`,
        ...sp.innovations
      ];
      for (const pText of pills) {
        const pill = document.createElement('span');
        pill.className = 'trait-pill';
        pill.textContent = pText;
        traitsRow.appendChild(pill);
      }
      card.appendChild(traitsRow);

      if (!sp.isExtinct) {
        const barTrack = document.createElement('div');
        barTrack.className = 'pop-bar-track';
        const barFill = document.createElement('div');
        barFill.className = 'pop-bar-fill';
        barFill.style.width = `${Math.min(100, popShare * 100)}%`;
        barTrack.appendChild(barFill);
        card.appendChild(barTrack);

        const actionsRow = document.createElement('div');
        actionsRow.style.marginTop = '4px';
        actionsRow.style.display = 'flex';
        actionsRow.style.justifyContent = 'flex-end';
        const btnKill = document.createElement('button');
        btnKill.className = 'btn btn-danger';
        btnKill.style.padding = '2px 6px';
        btnKill.style.fontSize = '10px';
        btnKill.textContent = i18n.t('evo.btn_extirpate');
        btnKill.addEventListener('click', () => {
          this.world.removeSpeciesById(sp.id);
          this.renderer.syncWithSimulation(this.world);
          this.updateUIReadouts();
        });
        actionsRow.appendChild(btnKill);
        card.appendChild(actionsRow);
      }

      container.appendChild(card);
    }
  }

  private updateUIReadouts(): void {
    const t = this.world.telemetry;
    const p = this.world.params;
    const tb = formatTimeBreakdown(this.world.timeState);

    // Update 3.0 derived planetary physics readouts
    if (p.planet) {
      const derived = derivePlanetQuantities(p.planet);
      const gEl = document.getElementById('derived-gravity-val');
      const gRel = derived.effectiveGravityMs2 / EARTH_GRAVITY_MS2;
      if (gEl) gEl.textContent = `${derived.effectiveGravityMs2.toFixed(2)} m/s² (${gRel.toFixed(2)} g)`;
      const dEl = document.getElementById('derived-density-val');
      if (dEl) dEl.textContent = `${derived.densityGcm3.toFixed(2)} g/cm³`;
      const escEl = document.getElementById('derived-escape-val');
      if (escEl) escEl.textContent = `${derived.escapeVelocityKms.toFixed(2)} km/s`;
      const lapseEl = document.getElementById('derived-lapse-val');
      if (lapseEl) lapseEl.textContent = `${(derived.lapseRateKPerM * 1000).toFixed(2)} K/km`;
    }

    if (p.geology) {
      const impEl = document.getElementById('val-impact-count');
      if (impEl) impEl.textContent = String(p.geology.impactCount);
    }

    const n2El = document.getElementById('val-nitrogen-filler');
    if (n2El) {
      const n2 = nitrogenPercent({
        pressureBar: p.pressureBar ?? 1.0,
        o2Percent: p.o2Percent ?? 0.1,
        co2Ppm: p.co2Ppm,
        argonPercent: p.argonPercent ?? 0.93
      });
      n2El.textContent = `${n2.toFixed(2)}%`;
    }

    document.getElementById('readout-time-mode')!.textContent = `${i18n.t('time.mode_prefix')}: ${t.activeTimeMode} (${formatSciNumber(this.world.speedSci, 1)}x)`;
    document.getElementById('readout-geological')!.textContent = i18n.formatGeologicalTime(tb.geological);
    document.getElementById('readout-time-breakdown')!.textContent = `${tb.seconds} | ${tb.hours} | ${tb.days}`;

    document.getElementById('stat-mean-temp')!.textContent = `${t.meanSurfaceTempC.toFixed(1)} °C (${t.meanSurfaceTempK.toFixed(1)} K)`;
    document.getElementById('stat-minmax-temp')!.textContent = `${t.minSurfaceTempC.toFixed(0)}°C .. +${t.maxSurfaceTempC.toFixed(0)}°C`;
    document.getElementById('stat-ocean-cov')!.textContent = `${(t.oceanCoverageFraction * 100).toFixed(1)}%`;
    document.getElementById('stat-ice-cov')!.textContent = `${(t.iceCoverageFraction * 100).toFixed(1)}%`;
    document.getElementById('stat-biomass')!.textContent = `${(t.globalBiomassFraction * 100).toFixed(1)}% (Hab: ${(t.meanHabitability * 100).toFixed(0)}%)`;
    document.getElementById('stat-fauna-o2')!.textContent = `${(t.globalFaunaFraction * 100).toFixed(1)}% | ${t.oxygenPercent.toFixed(1)}% O₂`;
    document.getElementById('stat-species-biodiv')!.textContent = `${t.livingSpeciesCount} alive | H'=${t.biodiversityIndex.toFixed(2)}`;
    const trendPct = t.recoveryTrend * 100;
    document.getElementById('stat-ext-stress')!.textContent = `${(t.extinctionSeverity * 100).toFixed(0)}% | ${trendPct >= 0 ? '+' : ''}${trendPct.toFixed(1)}%`;
    document.getElementById('stat-eff-sealevel')!.textContent = `${Math.round(t.effectiveSeaLevelMeters)} m`;
    document.getElementById('stat-forcing')!.textContent = `${t.radiativeForcingWm2 >= 0 ? '+' : ''}${t.radiativeForcingWm2.toFixed(2)} W/m²`;
    document.getElementById('stat-albedo')!.textContent = t.planetaryAlbedo.toFixed(3);
    document.getElementById('stat-energy')!.textContent = `${t.netEnergyImbalanceWm2 >= 0 ? '+' : ''}${t.netEnergyImbalanceWm2.toFixed(1)} W/m²`;
    document.getElementById('stat-hydro')!.textContent = `${(t.meanHumidity * 100).toFixed(0)}% | ${t.meanPrecipitationMmDay.toFixed(1)} mm/d`;
    document.getElementById('stat-wind-max')!.textContent = `${t.maxWindSpeedMs.toFixed(1)} m/s`;

    document.getElementById('stat-steps-computed')!.textContent = this.world.timeState.stepsComputed.toLocaleString('en-US');
    document.getElementById('stat-steps-skipped')!.textContent = formatSciNumber(this.world.timeState.stepsSkippedSci, 2);
    document.getElementById('stat-perf')!.textContent = `${this.measuredFps} FPS | ${this.lastSimStepMs.toFixed(2)} ms`;
    document.getElementById('stat-stability-note')!.textContent = i18n.translateStabilityNote(t.lastStepStabilityNote);

    (document.getElementById('btn-undo') as HTMLButtonElement).disabled = !this.world.canUndo();
    (document.getElementById('btn-redo') as HTMLButtonElement).disabled = !this.world.canRedo();

    // Selected Coordinate Inspector
    const insp = this.world.inspectCoordinate(this.selectedLat, this.selectedLon);
    const latStr = `${Math.abs(insp.latDeg).toFixed(2)}° ${insp.latDeg >= 0 ? 'N' : 'S'}`;
    const lonStr = `${Math.abs(insp.lonDeg).toFixed(2)}° ${insp.lonDeg >= 0 ? 'E' : 'W'}`;
    document.getElementById('insp-coord')!.textContent = `${latStr}, ${lonStr}`;
    document.getElementById('selected-coord-label')!.textContent = `${i18n.t('label.selected_coord_prefix')}: ${latStr}, ${lonStr}`;

    const domainKey = `domain.${insp.biome}` as TranslationKey;
    document.getElementById('insp-domain')!.textContent = i18n.t(domainKey);

    document.getElementById('insp-elev')!.textContent = `${Math.round(insp.elevationMeters)} m`;
    document.getElementById('insp-depth')!.textContent = insp.isOcean
      ? `${Math.round(insp.waterDepthMeters)} ${i18n.t('insp.depth_unit')}`
      : `+${Math.round(insp.heightAboveSeaMeters)} ${i18n.t('insp.alt_unit')}`;
    document.getElementById('insp-temp')!.textContent = `${insp.temperatureC.toFixed(1)} °C (${insp.temperatureK.toFixed(1)} K)`;
    document.getElementById('insp-hum')!.textContent = `${(insp.humidity * 100).toFixed(1)}%`;
    document.getElementById('insp-precip')!.textContent = `${insp.precipitationMmDay.toFixed(2)} mm/day`;
    document.getElementById('insp-wind')!.textContent = `${insp.windSpeedMs.toFixed(1)} m/s (${insp.windU.toFixed(1)}, ${insp.windV.toFixed(1)})`;
    document.getElementById('insp-ice')!.textContent = `${insp.iceThicknessMeters.toFixed(1)} m`;
    document.getElementById('insp-hab')!.textContent = `${(insp.habitability * 100).toFixed(0)}% | ${(insp.biodiversity * 100).toFixed(0)}%`;
    document.getElementById('insp-bio')!.textContent = `${(insp.biomass * 100).toFixed(1)}% | ${(insp.fauna * 100).toFixed(1)}%`;
    document.getElementById('insp-species')!.textContent = insp.dominantSpeciesName;
    document.getElementById('insp-hazard')!.textContent = `${insp.volcanicHeatWm2.toFixed(0)} W/m² | ${insp.tsunamiWaveHeightMeters.toFixed(1)} m`;

    this.renderEvoChart();
    this.renderSpeciesExplorer();

    // Event log
    const logContainer = document.getElementById('event-log-list')!;
    logContainer.innerHTML = '';
    this.world.eventLog.slice(0, 20).forEach((ev) => {
      const item = document.createElement('div');
      item.className = 'list-item';
      const cat = i18n.translateEventCategory(ev.category);
      const msg = i18n.translateEventMessage(ev.message);
      item.innerHTML = `<div><strong>[${cat}]</strong> ${msg}<div class="list-item-meta">${ev.simTimeFormatted}</div></div>`;
      logContainer.appendChild(item);
    });
  }

  private loop(now: number): void {
    const dtMs = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.fpsFrameCount++;
    this.fpsAccumMs += dtMs;
    if (this.fpsAccumMs >= 500) {
      this.measuredFps = Math.round((this.fpsFrameCount * 1000) / this.fpsAccumMs);
      this.fpsFrameCount = 0;
      this.fpsAccumMs = 0;
    }

    this.autosaveAccumMs += dtMs;
    if (this.autosaveAccumMs >= 45000) {
      this.autosaveAccumMs = 0;
      this.worldLibrary.saveAutosave(this.world.serializeSnapshot('Autosave'));
    }

    if (!this.world.paused) {
      const t0 = performance.now();
      this.world.advanceFrame(dtMs / 1000);
      this.lastSimStepMs = performance.now() - t0;
      this.renderer.syncWithSimulation(this.world);
      this.updateUIReadouts();
    }

    this.renderer.renderFrame();
    requestAnimationFrame((t) => this.loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new HxnGenesisApp();
});
