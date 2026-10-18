/**
 * Centralized Internationalization (i18n) System for HXN GENESIS
 * Supports English ('en') and Vietnamese ('vi') with strict TypeScript keys,
 * instant live DOM + dynamic telemetry translation without page reload,
 * and localStorage persistence.
 */

export type LanguageCode = 'en' | 'vi';

export const STORAGE_KEY_LANGUAGE = 'hxn_genesis_lang_v1';

export const TRANSLATIONS = {
  en: {
    'app.title': 'HXN GENESIS — Ultimate Living Planet Simulator',
    'brand.subtitle': 'PLANETARY ENVIRONMENT, CLIMATE & EVOLUTION SANDBOX',
    'lang.toggle_label': '🇻🇳 Tiếng Việt',
    'lang.toggle_title': 'Switch interface language to Vietnamese (Chuyển sang Tiếng Việt)',
    'lang.current_badge': '🇬🇧 English',

    // Transport & Time Controls
    'btn.pause': '⏸ Pause',
    'btn.resume': '▶ Resume',
    'btn.pause_title': 'Pause / Resume Simulation (Space)',
    'btn.step': '⏭ Step',
    'btn.step_title': 'Advance Single Physics Step (+10 min)',
    'input.custom_speed_placeholder': 'e.g. 5e40',
    'input.custom_speed_title': 'Scientific speed multiplier (supports up to 1e100+)',
    'btn.set_speed': 'Set Speed',
    'time.mode_prefix': 'MODE',
    'btn.toggle_left_title': 'Toggle God Mode Panel ([)',
    'btn.toggle_right_title': 'Toggle Telemetry Panel (])',

    // Tabs
    'tab.world': 'World & Seed',
    'tab.climate': 'Atmosphere',
    'tab.sculpt': 'Life & Hazards',
    'tab.evolab': '🧬 Evo Lab',
    'tab.history': 'Save & Log',

    // Tab 1: World & Seed
    'section.preset_seed': 'Planetary Scenario & Deterministic Seed',
    'label.world_preset': 'Planetary Scenario (12 Presets)',
    'preset.earth': 'Earth-like (Initial Abiotic)',
    'preset.ice': 'Ice World (Cryogenic Glaciation)',
    'preset.desert': 'Desert World (Hyper-Arid Dune/Rock)',
    'preset.ocean': 'Ocean World (Pelagic Bathymetry)',
    'preset.volcanic': 'Volcanic World (Hadean Outgassing)',
    'preset.young': 'Habitable Young Planet (Archean Warmth)',
    'preset.greenhouse': 'Rapid Greenhouse (Super-CO₂ Hothouse)',
    'preset.glaciation': 'Glaciation & Recovery (Snowball Cycle)',
    'preset.extinction': 'Mass Extinction Testbed (High Fragility)',
    'preset.isolated': 'Isolated Evolution (Archipelago Radiation)',
    'preset.lowo2': 'Low-Oxygen Biospheres (Anaerobic Bias)',
    'preset.custom': 'Custom Configuration',
    'label.seed': 'Deterministic Seed',
    'btn.generate_seed': 'Generate',
    'label.visual_quality': '3D Render Quality Preset',
    'quality.low': 'Low (Performance)',
    'quality.medium': 'Medium (Balanced)',
    'quality.high': 'High (Cinematic)',
    'section.hypsometry': 'Planetary Hypsometry & Hydrosphere',
    'label.sealevel': 'Sea Level Datum Offset',
    'label.terrain_scale': 'Crust Relief Scale',
    'label.ice_impulse': 'Cryosphere Ice Target Impulse',
    'btn.apply_ice': 'Apply Ice',
    'section.vis_layer': 'Data Visualization Layer',
    'layer.true_color': 'True Color (Rock/Life)',
    'layer.biosphere': '🌿 Biosphere Composite',
    'layer.habitability': '💧 Habitability Index',
    'layer.biomass': '🌲 Flora Biomass',
    'layer.fauna': '🦎 Fauna Density',
    'layer.biodiversity': '🧬 Biodiversity (H\')',
    'layer.extinction_impact': '☄️ Extinction Stress',
    'layer.temperature': '🌡 Surface Temp',
    'layer.elevation': '⛰ Crust Elevation',
    'layer.precipitation': '🌧 Precipitation',
    'layer.ice': '❄ Cryosphere Ice',
    'layer.wind': '💨 Wind Velocity',
    'section.reset_undo': 'Reset & Undo Controls',
    'btn.undo': '↩ Undo',
    'btn.redo': '↪ Redo',
    'btn.reset_partial': 'Partial Reset',
    'btn.reset_partial_title': 'Reset atmosphere, ocean waves & ice while preserving sculpted crust',
    'btn.reset_full': 'Full Reset',
    'btn.reset_full_title': 'Full reset of crust, time, biosphere, and parameters',

    // Tab 2: Atmosphere & Coupled Climate
    'section.radiative': 'Radiative Forcing & Insolation',
    'label.co2': 'Atmospheric CO₂',
    'note.co2_formula': 'Logarithmic forcing: ΔF = 5.35 × ln(C/280) W/m²',
    'label.o2': 'Atmospheric O₂ (Photosynthesis)',
    'label.o2_eff': 'Photosynthetic O₂ Yield Multiplier',
    'label.abiogenesis': 'Spontaneous Deep-Time Abiogenesis',
    'label.solar': 'Solar Luminosity (S / S₀)',
    'label.tilt': 'Planetary Axial Tilt',
    'label.temp_offset': 'Manual Thermal Forcing Offset',
    'label.daynight': 'Diurnal Day/Night Cycle',
    'label.sun_lon': 'Manual Sun Longitude',
    'section.circulation': 'Circulation & Hydrology',
    'label.humidity': 'Atmospheric Humidity Capacity',
    'label.wind': 'Global Wind Circulation',
    'label.precip': 'Precipitation Efficiency',
    'label.volcanism': 'Background Volcanism & Outgassing',

    // Tab 3: Biosphere Seeding, Sculpt & Hazards
    'section.biosphere_controls': 'Biosphere & Evolutionary Parameters',
    'note.biosphere_help': 'Initial world is abiotic (0% life). Seed microbes, flora, or fauna on habitable regions:',
    'btn.seed_global_life': '🌍 Bloom Global Biosphere',
    'btn.sterilize_planet': '☄️ Sterilize All Life',
    'confirm.sterilize': 'Are you sure you want to sterilize the entire planet and wipe out all living species?',
    'label.mutation_rate': 'Genetic Mutation Rate',
    'label.selection_pressure': 'Natural Selection Pressure',
    'label.reproduction_mult': 'Biotic Reproduction Multiplier',
    'label.extinction_susc': 'Extinction Susceptibility',
    'section.click_tool': 'Interactive Click Tool on 3D Globe',
    'note.click_tool_help': 'Choose what happens when you click a coordinate on the 3D planet:',
    'tool.inspect': '🔍 Inspect Only',
    'tool.seed_microbes': '🦠 Seed Microbes',
    'tool.seed_flora': '🌿 Seed Flora/Forest',
    'tool.seed_fauna': '🦎 Seed Fauna/Animals',
    'tool.sculpt_raise': '⛰ Raise Crust',
    'tool.sculpt_lower': '🌊 Excavate Trench',
    'tool.volcano': '🌋 Erupt Volcano',
    'tool.earthquake': '⚡ Fault Earthquake',
    'tool.tsunami': '🌊 Tsunami Impulse',
    'tool.storm': '🌀 Super Cyclone',
    'tool.drought': '☀ Regional Drought',
    'tool.flood': '🌊 Mega Flood',
    'tool.meteor': '☄️ Meteor Strike',
    'label.brush_radius': 'Brush Radius (Angular)',
    'label.brush_strength': 'Tool / Hazard Intensity',
    'section.trigger_selected': 'Trigger at Selected Coordinate',
    'label.selected_coord_prefix': 'Selected',
    'btn.trigger_flora': '🌿 Seed Life Here',
    'btn.trigger_meteor': '☄️ Meteor Here',
    'btn.trigger_volcano': '🌋 Erupt Here',
    'btn.trigger_quake': '⚡ Quake Here',
    'btn.trigger_tsunami': '🌊 Tsunami Here',
    'btn.trigger_storm': '🌀 Storm Here',
    'btn.trigger_flood': '🌧 Flood Here',
    'btn.focus_coord': '🎯 Focus Camera Here',

    // Tab 4: Evolution Lab & Phylogeny
    'section.evo_chart': 'Real-Time Planetary & Biosphere Time-Series',
    'label.chart_metric': 'Chart Metric',
    'chart.temp_hab': 'Surface Temp (°C) & Habitability (%)',
    'chart.atmo': 'Atmospheric O₂ (%) & CO₂ (ppm)',
    'chart.bio_fauna': 'Global Flora Biomass & Fauna (%)',
    'chart.biodiv': 'Biodiversity (H\') & Living Species',
    'section.evo_summary': 'Evolutionary Phylogeny & Trophic Guilds',
    'evo.living_species': 'Living Species',
    'evo.extinct_species': 'Extinct Lineages',
    'evo.shannon_index': 'Shannon Biodiversity (H\')',
    'evo.recovery_trend': 'Biosphere Trend',
    'input.species_search_placeholder': 'Search species name, guild, or trait...',
    'section.species_explorer': 'Species & Lineage Explorer',
    'evo.no_species': 'No species have emerged yet. Enable Abiogenesis + fast-forward time, or click "Bloom Global Biosphere".',
    'evo.status_alive': 'EXTANT',
    'evo.status_extinct': 'EXTINCT',
    'evo.btn_extirpate': 'Extirpate',
    'evo.ancestor_root': 'Abiogenesis Root',
    'evo.parent_prefix': 'Ancestor',

    // Tab 5: Save & History
    'section.checkpoints': 'Checkpoints & JSON State Persistence',
    'input.checkpoint_placeholder': 'Checkpoint label...',
    'btn.save_checkpoint': '+ Save',
    'btn.export_json': '⬇ Export JSON',
    'btn.import_json': '⬆ Import JSON',
    'section.saved_checkpoints': 'Saved Timeline Checkpoints',
    'btn.restore_checkpoint': 'Restore',
    'label.steps': 'Steps',
    'section.event_log': 'Planetary Event & History Log',

    // Right Panel: Telemetry & Inspector
    'section.telemetry': 'Global Planetary Telemetry',
    'stat.mean_temp': 'Mean Surface Temp',
    'stat.temp_extremes': 'Temp Extremes',
    'stat.ocean_cov': 'Ocean Coverage',
    'stat.ice_cov': 'Cryosphere Ice',
    'stat.eff_sealevel': 'Effective Sea Level',
    'stat.forcing': 'CO₂ Forcing (ΔF)',
    'stat.albedo': 'Planetary Albedo',
    'stat.energy': 'Net Energy Balance',
    'stat.hydro': 'Mean Humidity / Precip',
    'stat.wind_max': 'Peak Wind Velocity',
    'stat.biomass': 'Global Flora / Biomass',
    'stat.fauna_o2': 'Fauna / Atmo O₂',
    'stat.species_biodiv': 'Species / Shannon H\'',
    'stat.ext_stress': 'Extinction Stress / Trend',
    'section.honesty': 'Numerical Integration & Time Honesty',
    'honesty.steps_computed': 'Steps Computed:',
    'honesty.steps_skipped': 'Steps Bypassed (Coarse/Analytical):',
    'honesty.perf': 'Render FPS / Sim Step:',
    'section.inspector': 'Coordinate Inspector (Click Planet)',
    'domain.ABIOTIC_OCEAN': 'ABIOTIC OCEAN BASIN',
    'domain.POLAR_SEA_ICE': 'POLAR SEA ICE PACK',
    'domain.HYDROTHERMAL_VENT_MICROBES': 'HYDROTHERMAL VENT MICROBES',
    'domain.MARINE_PHYTOPLANKTON_REEF': 'MARINE PHYTOPLANKTON & REEF',
    'domain.GLACIAL_ICE_SHEET': 'GLACIAL ICE SHEET',
    'domain.ABIOTIC_REGOLITH': 'ABIOTIC CONTINENTAL CRUST',
    'domain.ARID_DESERT_SCRUB': 'ARID XEROPHYTIC SCRUB',
    'domain.TUNDRA_MOSS': 'SUBPOLAR TUNDRA MOSS',
    'domain.TEMPERATE_GRASSLAND': 'TEMPERATE SAVANNAH / GRASSLAND',
    'domain.BOREAL_TAIGA_FOREST': 'BOREAL TAIGA FOREST',
    'domain.TROPICAL_RAINFOREST': 'TROPICAL RAINFOREST CANOPY',
    'insp.elev': 'Crust Elevation:',
    'insp.depth': 'Water Depth / Alt:',
    'insp.depth_unit': 'm depth',
    'insp.alt_unit': 'm alt',
    'insp.temp': 'Surface Temp:',
    'insp.hum': 'Column Humidity:',
    'insp.precip': 'Precipitation:',
    'insp.wind': 'Local Wind Vector:',
    'insp.ice': 'Ice Sheet Thickness:',
    'insp.bio': 'Biomass / Fauna:',
    'insp.hab': 'Habitability / Biodiv:',
    'insp.species': 'Dominant Lineage:',
    'insp.hazard': 'Geothermal / Wave:',

    // Errors & Alerts
    'err.invalid_speed': 'Invalid scientific speed format',
    'err.negative_speed': 'Speed must be non-negative',
    'err.import_failed': 'Failed to import snapshot',

    // HXN GENESIS 3.0 — UI Mode, Tutorial & Help
    'btn.mode_creator': '🎨 Creator Mode',
    'btn.mode_advanced': '🔬 Advanced Mode',
    'btn.mode_toggle_title': 'Toggle between Creator Mode (simplified) and Advanced Scientific Mode',
    'btn.graticule': '🌐 Grid',
    'btn.graticule_title': 'Toggle 3D Latitude/Longitude Graticule & Axial Tilt Indicator (G)',
    'btn.help': '❓ Help & Tour',
    'btn.help_title': 'Open Interactive Tutorial & Controls Guide (?)',
    'welcome.badge': 'HXN GENESIS 3.0 — ULTIMATE PLANET CREATOR & LIVING WORLD SANDBOX',
    'welcome.title': 'Forge a Planet. Sculpt Continents. Spark Evolution.',
    'welcome.subtitle': 'Create an abiotic world from scratch, customize its physical & orbital properties, sculpt mountains and oceans in 3D, and guide life across billions of years.',
    'welcome.btn_create': '🪐 Create My World (Guided Tour)',
    'welcome.btn_preset': '🌍 Explore a Preset World',
    'welcome.btn_skip': '⏭ Skip Tutorial',
    'tutorial.step_prefix': 'TUTORIAL STEP',
    'tutorial.btn_prev': '← Back',
    'tutorial.btn_next': 'Next →',
    'tutorial.btn_skip': 'Skip Tour',
    'tutorial.btn_finish': '✓ Finish & Play',
    'tutorial.WATCH_PLANET.title': '1. Welcome to Your 3D Planet',
    'tutorial.WATCH_PLANET.body': 'Your planet begins as a lifeless (abiotic) world with coupled atmosphere, oceans, and crust relief. Observe the real-time clouds, oceans, and day-night terminator.',
    'tutorial.CAMERA_BASICS.title': '2. Camera & Globe Navigation',
    'tutorial.CAMERA_BASICS.body': 'Drag with Left Mouse to orbit, Scroll Wheel to zoom, and Right-Drag to pan. Use the camera preset buttons (North Pole, Equator, South Pole) or press R to reset view.',
    'tutorial.CHOOSE_WORLD.title': '3. Choose or Create a World',
    'tutorial.CHOOSE_WORLD.body': 'Pick one of 12 planetary scenarios or customize your planet’s name, seed, radius, mass, gravity, star type, and procedural terrain style in the World & Creator tab.',
    'tutorial.SCULPT_TERRAIN.title': '4. Sculpt Continents & Basins',
    'tutorial.SCULPT_TERRAIN.body': 'Open the Sculpt & Life tab to raise mountain ranges, carve ocean trenches, stamp impact craters, or paint land and ice directly onto the 3D sphere.',
    'tutorial.CLIMATE_WATER.title': '5. Tune Atmosphere, Gases & Oceans',
    'tutorial.CLIMATE_WATER.body': 'Adjust target Ocean Coverage (%), Surface Pressure (bar), CO₂, O₂, and Argon in the Atmosphere tab. N₂ automatically balances the remaining gas fraction.',
    'tutorial.SEED_LIFE.title': '6. Spark Life & Abiogenesis',
    'tutorial.SEED_LIFE.body': 'Click "Bloom Global Biosphere" or paint Microbes, Flora, and Fauna onto habitable zones—or enable Abiogenesis and let life emerge naturally in warm oceans.',
    'tutorial.TIME_EVOLUTION.title': '7. Deep-Time Acceleration',
    'tutorial.TIME_EVOLUTION.body': 'Use the top time controls (1x up to 1e9x+) to fast-forward thousands or millions of years and watch species mutate, adapt, and diversify.',
    'tutorial.SPECIES_INSPECT.title': '8. Inspect Coordinates & Lineages',
    'tutorial.SPECIES_INSPECT.body': 'Click any point on the globe to inspect elevation, temperature, biome, and dominant species, or open the Evo Lab tab to explore the phylogenetic tree.',
    'tutorial.EVENTS_GOD_MODE.title': '9. Trigger Catastrophes & Global Experiments',
    'tutorial.EVENTS_GOD_MODE.body': 'Test planetary resilience with Meteor Strikes, Supervolcanoes, Tsunamis, Global Cooling, Rapid Greenhouse spikes, or Ecological Recovery experiments.',
    'tutorial.SAVE_EXPORT.title': '10. World Library, Autosave & JSON Export',
    'tutorial.SAVE_EXPORT.body': 'Open the Save & Log tab to save worlds to your local World Library, duplicate or rename worlds, or export/import validated JSON snapshots.',

    // HXN GENESIS 3.0 — Planet Creation Wizard & Physical Properties
    'section.planet_identity': 'Planet Identity & Physical Properties',
    'label.planet_name': 'Planet Name',
    'input.planet_name_placeholder': 'e.g. Genesis Prime',
    'label.terrain_style': 'Procedural Terrain Style (10 Styles)',
    'style.EARTH_CONTINENTS': 'Earth Continents & Basins',
    'style.ARCHIPELAGO': 'Volcanic Island Archipelago',
    'style.SUPERCONTINENT': 'Pangaea Supercontinent',
    'style.OCEAN_PLANET': 'Pelagic Ocean Planet',
    'style.DESERT_PLANET': 'Arid Dune & Plateau World',
    'style.ICE_WORLD': 'Cryogenic Glaciated World',
    'style.VOLCANIC_WORLD': 'Tectonic Caldera & Lava World',
    'style.CRATERED_WORLD': 'Heavily Cratered Highlands',
    'style.ALIEN': 'Alien Warped Terraces',
    'style.CUSTOM': 'Custom Procedural Relief',
    'label.ocean_target': 'Target Ocean Coverage (%)',
    'label.planet_radius': 'Planet Radius (km)',
    'label.planet_mass': 'Planet Mass (M⊕)',
    'label.rotation_period': 'Rotation Period / Day Length (hr)',
    'label.orbital_distance': 'Orbital Semi-Major Axis (AU)',
    'label.eccentricity': 'Orbital Eccentricity (e)',
    'label.star_type': 'Host Star Spectral Class',
    'star.M': 'M-Dwarf (Red Dwarf, 0.04 L☉)',
    'star.K': 'K-Star (Orange Dwarf, 0.35 L☉)',
    'star.G': 'G-Star (Sun-like, 1.00 L☉)',
    'star.F': 'F-Star (Yellow-White, 2.60 L☉)',
    'label.gravity_override': 'Custom Gravity Override (m/s²)',
    'derived.gravity': 'Surface Gravity (g)',
    'derived.density': 'Bulk Density (ρ)',
    'derived.escape': 'Escape Velocity (vₑ)',
    'derived.insolation': 'Stellar Insolation (S/S₀)',
    'derived.lapse': 'Adiabatic Lapse Rate',
    'section.terrain_gen': 'Advanced Terrain Generator Settings',
    'label.roughness': 'Fine Crust Roughness',
    'label.mountain_height': 'Mountain Belt Height',
    'label.continent_scale': 'Continent Feature Size',
    'label.crater_density': 'Impact Crater Density',
    'label.plateaus': 'Plateau Terracing',
    'btn.regen_terrain': '↻ Regenerate Terrain with Style',

    // HXN GENESIS 3.0 — Geology & Interior
    'section.geology': 'Planetary Interior & Plate Tectonics',
    'label.internal_heat': 'Internal Radiogenic Heat',
    'label.crust_thickness': 'Crustal Thickness (km)',
    'label.mantle_activity': 'Mantle Plume Activity',
    'label.tectonic_activity': 'Plate Boundary Uplift Rate',
    'label.impact_count': 'Recorded Major Impacts',
    'btn.tectonic_pulse': '⛰ Trigger Tectonic Uplift Pulse',

    // HXN GENESIS 3.0 — Atmosphere Gas Composition
    'section.gas_composition': 'Atmospheric Gas Composition & Pressure',
    'label.pressure_bar': 'Surface Atmospheric Pressure',
    'label.argon': 'Argon (Ar Inert Trace)',
    'label.nitrogen_filler': 'Nitrogen Balance (N₂ Filler)',
    'note.gas_balance': 'Editing O₂, CO₂, or Ar automatically adjusts N₂ filler without altering other tracked gases.',

    // HXN GENESIS 3.0 — Sculpting Workshop & Global Experiments
    'tool.sculpt_smooth': '〰 Smooth Terrain',
    'tool.sculpt_flatten': '📏 Flatten Plateau',
    'tool.sculpt_mountain': '🏔 Raise Mountain Ridge',
    'tool.sculpt_basin': '🕳 Carve Basin',
    'tool.sculpt_crater': '☄ Stamp Impact Crater',
    'tool.paint_ocean': '🌊 Paint Ocean Floor',
    'tool.paint_land': '🏝 Paint Continental Land',
    'tool.add_ice': '❄ Paint Glacier Ice',
    'tool.remove_ice': '🔥 Melt Local Ice',
    'tool.restore_terrain': '↺ Restore Pristine Crust',
    'label.brush_falloff': 'Brush Falloff Profile',
    'falloff.SMOOTH': 'Smooth Cosine Bell',
    'falloff.LINEAR': 'Linear Cone',
    'falloff.CONSTANT': 'Hard Flat Stamp',
    'label.brush_shape': 'Brush Footprint Shape',
    'shape.CIRCLE': 'Spherical Circle',
    'shape.RING': 'Annular Ring / Caldera',
    'shape.RIDGE': 'Elongated Tectonic Ridge',
    'label.brush_symmetry': 'Stroke Symmetry',
    'symmetry.NONE': 'Single Stroke (None)',
    'symmetry.LONGITUDE_MIRROR': 'Mirror Longitude (±λ)',
    'symmetry.EQUATOR_MIRROR': 'Mirror Equator (±φ)',
    'section.global_experiments': 'Global Planetary Experiments',
    'btn.exp_cooling': '❄ Global Cooling Pulse',
    'btn.exp_greenhouse': '🔥 Rapid Greenhouse Spike',
    'btn.exp_atmo_loss': '💨 Strip Atmosphere',
    'btn.exp_ocean_loss': '🏜 Evaporate Oceans',
    'btn.exp_recovery': '🌱 Ecological Recovery Pulse',
    'confirm.destructive_event': 'This global event is destructive and will drastically alter the atmosphere, oceans, or biosphere. Proceed?',

    // HXN GENESIS 3.0 — World Library & Camera Presets
    'section.world_library': 'Saved World Library & Autosave',
    'btn.load_autosave': '↺ Load Last Autosave',
    'btn.duplicate_world': '⧉ Duplicate',
    'btn.rename_world': '✎ Rename',
    'btn.delete_world': '✕ Delete',
    'cam.default': '🌐 Default View',
    'cam.north': '⬆ North Pole',
    'cam.equator': '➖ Equator',
    'cam.south': '⬇ South Pole',
    'help.modal_title': 'HXN GENESIS 3.0 — Controls, Shortcuts & Scientific Guide',
    'help.search_placeholder': 'Search controls, keyboard shortcuts, or physics models...',
    'help.btn_restart_tour': '🎓 Restart 10-Step Interactive Tutorial',
    'help.btn_close': '✕ Close',
    'tab.explore': '🧭 Frontier',
    'tab.science': '🛰 Science Lab',
    'layer.radiation': '☢ Radiation',
    'layer.minerals': '⛏ Minerals',
    'layer.civilization': '🏛 Civilization',
    'btn.cmd_palette': '⌘ Command (Ctrl+K)',
    'btn.magnetosphere': '🧲 Magnetosphere 3D',
    'btn.presentation': '🎬 Tour Mode',
    'section.exploration': '1. Planetary Exploration & Surface Expedition',
    'section.geochemistry': '2. Geochemical Cycles & Resource Extraction',
    'section.civilization': '3. Civilization & Intelligent Life Sandbox',
    'section.terraforming': '4. Planetary Engineering & Terraforming Lab',
    'section.space_weather': '5. Asteroid Defense & Space Weather',
    'section.remote_sensing': '6. Remote Sensing & Synthetic Spectroscopy',
    'section.magnetism': '7. Planetary Magnetosphere & Radiation Shielding',
    'section.stratigraphy': '8. Stratigraphic Column & Fossil Record',
    'section.analytics': '9. Causal Attribution, Correlation & Monte Carlo',
    'section.missions_mods': '10–12. Procedural Missions, Extensions & Accessibility'
  },
  vi: {
    'app.title': 'HXN GENESIS — Mô Phỏng Hành Tinh Sống & Tiến Hóa Toàn Diện',
    'brand.subtitle': 'MÔ PHỎNG ĐỊA CHẤT, KHÍ HẬU & TIẾN HÓA SINH QUYỂN',
    'lang.toggle_label': '🇬🇧 English',
    'lang.toggle_title': 'Chuyển ngôn ngữ giao diện sang Tiếng Anh (Switch to English)',
    'lang.current_badge': '🇻🇳 Tiếng Việt',

    // Transport & Time Controls
    'btn.pause': '⏸ Tạm dừng',
    'btn.resume': '▶ Tiếp tục',
    'btn.pause_title': 'Tạm dừng / Tiếp tục mô phỏng (Phím Space)',
    'btn.step': '⏭ Bước đơn',
    'btn.step_title': 'Tiến thêm 1 bước vật lý (+10 phút)',
    'input.custom_speed_placeholder': 'VD: 5e40',
    'input.custom_speed_title': 'Hệ số tốc độ ký hiệu khoa học (hỗ trợ tới 1e100+)',
    'btn.set_speed': 'Đặt tốc độ',
    'time.mode_prefix': 'CHẾ ĐỘ',
    'btn.toggle_left_title': 'Ẩn/Hiện Bảng Điều Khiển ([)',
    'btn.toggle_right_title': 'Ẩn/Hiện Bảng Viễn Thám (])',

    // Tabs
    'tab.world': 'Thế Giới',
    'tab.climate': 'Khí Quyển',
    'tab.sculpt': 'Sự Sống',
    'tab.evolab': '🧬 Tiến Hóa',
    'tab.history': 'Lưu & Nhật Ký',

    // Tab 1: World & Seed
    'section.preset_seed': 'Kịch Bản Hành Tinh & Hạt Giống Tất Định (Seed)',
    'label.world_preset': 'Kịch Bản Hành Tinh (12 Kịch Bản)',
    'preset.earth': 'Giống Trái Đất (Khởi Đầu Vô Sinh)',
    'preset.ice': 'Hành Tinh Băng Giá (Ice World)',
    'preset.desert': 'Hành Tinh Sa Mạc Đá (Desert World)',
    'preset.ocean': 'Hành Tinh Đại Dương (Ocean World)',
    'preset.volcanic': 'Hành Tinh Núi Lửa (Volcanic World)',
    'preset.young': 'Hành Tinh Trẻ Thích Nghi (Archean Ấm)',
    'preset.greenhouse': 'Nhà Kính Cấp Tốc (Siêu CO₂)',
    'preset.glaciation': 'Băng Hà & Phục Hồi (Chu Kỳ Quả Cầu Tuyết)',
    'preset.extinction': 'Thử Nghiệm Đại Tuyệt Chủng (Độ Nhạy Cao)',
    'preset.isolated': 'Tiến Hóa Cô Lập (Quần Đảo Phân Hóa)',
    'preset.lowo2': 'Sinh Quyển Oxy Thấp (Kỵ Khí)',
    'preset.custom': 'Cấu Hình Tùy Chỉnh (Custom)',
    'label.seed': 'Mã Seed Tất Định',
    'btn.generate_seed': 'Tạo Mới',
    'label.visual_quality': 'Chất Lượng Đồ Họa 3D',
    'quality.low': 'Thấp (Tối Ưu FPS)',
    'quality.medium': 'Trung Bình (Cân Bằng)',
    'quality.high': 'Cao (Điện Ảnh)',
    'section.hypsometry': 'Độ Cao Địa Hình & Thủy Quyển',
    'label.sealevel': 'Độ Lệch Mực Nước Biển Chuẩn',
    'label.terrain_scale': 'Hệ Số Độ Dốc Vỏ Hành Tinh',
    'label.ice_impulse': 'Mục Tiêu Độ Phủ Băng Quyển',
    'btn.apply_ice': 'Áp Dụng Băng',
    'section.vis_layer': 'Lớp Hiển Thị Dữ Liệu 3D',
    'layer.true_color': 'Màu Thực (Đá & Sinh Vật)',
    'layer.biosphere': '🌿 Tổng Hợp Sinh Quyển',
    'layer.habitability': '💧 Chỉ Số Thích Nghi',
    'layer.biomass': '🌲 Sinh Khối Thực Vật',
    'layer.fauna': '🦎 Mật Độ Động Vật',
    'layer.biodiversity': '🧬 Đa Dạng Sinh Học (H\')',
    'layer.extinction_impact': '☄️ Chấn Động Tuyệt Chủng',
    'layer.temperature': '🌡 Nhiệt Độ Bề Mặt',
    'layer.elevation': '⛰ Độ Cao Địa Chất',
    'layer.precipitation': '🌧 Lượng Mưa',
    'layer.ice': '❄ Độ Dày Băng Quyển',
    'layer.wind': '💨 Vận Tốc Gió',
    'section.reset_undo': 'Hoàn Tác & Đặt Lại Thế Giới',
    'btn.undo': '↩ Hoàn tác',
    'btn.redo': '↪ Làm lại',
    'btn.reset_partial': 'Đặt Lại Khí Hậu',
    'btn.reset_partial_title': 'Đặt lại khí quyển, sóng biển & băng về cân bằng nhưng giữ nguyên địa hình đã điêu khắc',
    'btn.reset_full': 'Đặt Lại Toàn Bộ',
    'btn.reset_full_title': 'Khôi phục toàn bộ địa hình gốc, thời gian, sinh quyển và tham số',

    // Tab 2: Atmosphere & Coupled Climate
    'section.radiative': 'Cưỡng Bức Bức Xạ & Năng Lượng Mặt Trời',
    'label.co2': 'Nồng Độ Khí Quyển CO₂',
    'note.co2_formula': 'Cưỡng bức bức xạ logarit: ΔF = 5.35 × ln(C/280) W/m²',
    'label.o2': 'Nồng Độ Oxy Khí Quyển O₂ (Quang Hợp)',
    'label.o2_eff': 'Hiệu Suất Sinh Oxy Quang Hợp',
    'label.abiogenesis': 'Tự Khởi Phát Sự Sống Ở Biển Sâu (Abiogenesis)',
    'label.solar': 'Độ Chói Mặt Trời (S / S₀)',
    'label.tilt': 'Độ Nghiêng Trục Quay',
    'label.temp_offset': 'Độ Lệch Cưỡng Bức Nhiệt Thủ Công',
    'label.daynight': 'Chu Kỳ Ngày / Đêm (Diurnal)',
    'label.sun_lon': 'Kinh Độ Mặt Trời Thủ Công',
    'section.circulation': 'Hoàn Lưu Gió & Thủy Văn',
    'label.humidity': 'Dung Lượng Độ Ẩm Khí Quyển',
    'label.wind': 'Cường Độ Hoàn Lưu Gió Toàn Cầu',
    'label.precip': 'Hiệu Suất Ngưng Tụ Mưa',
    'label.volcanism': 'Hoạt Động Núi Lửa Nền & Thoát Khí',

    // Tab 3: Biosphere Seeding, Sculpt & Hazards
    'section.biosphere_controls': 'Gieo Mầm Sự Sống & Tham Số Tiến Hóa',
    'note.biosphere_help': 'Thế giới khởi đầu vô sinh (0% sự sống). Hãy gieo vi sinh, thực vật hoặc động vật lên vùng thích nghi:',
    'btn.seed_global_life': '🌍 Phủ Sự Sống Toàn Cầu',
    'btn.sterilize_planet': '☄️ Tuyệt Chủng Toàn Bộ',
    'confirm.sterilize': 'Bạn có chắc chắn muốn tiệt trùng toàn bộ hành tinh và xóa sổ mọi loài sinh vật đang sống?',
    'label.mutation_rate': 'Tốc Độ Đột Biến Di Truyền',
    'label.selection_pressure': 'Áp Lực Chọn Lọc Tự Nhiên',
    'label.reproduction_mult': 'Hệ Số Sinh Sản Sinh Học',
    'label.extinction_susc': 'Độ Nhạy Cảm Tuyệt Chủng',
    'section.click_tool': 'Công Cụ Tương Tác Trực Tiếp Trên Địa Cầu 3D',
    'note.click_tool_help': 'Chọn tác động khi nhấp chuột vào một tọa độ trên hành tinh 3D:',
    'tool.inspect': '🔍 Chỉ Quan Sát',
    'tool.seed_microbes': '🦠 Gieo Vi Sinh Vật',
    'tool.seed_flora': '🌿 Trồng Thực Vật/Rừng',
    'tool.seed_fauna': '🦎 Thả Động Vật',
    'tool.sculpt_raise': '⛰ Nâng Địa Hình',
    'tool.sculpt_lower': '🌊 Đào Rãnh Sâu',
    'tool.volcano': '🌋 Phun Trào Núi Lửa',
    'tool.earthquake': '⚡ Động Đất Đứt Gãy',
    'tool.tsunami': '🌊 Kích Hoạt Sóng Thần',
    'tool.storm': '🌀 Siêu Bão Xoáy Thuận',
    'tool.drought': '☀ Hạn Hán Khu Vực',
    'tool.flood': '🌊 Đại Hồng Thủy (Lũ)',
    'tool.meteor': '☄️ Thiên Thạch Va Chạm',
    'label.brush_radius': 'Bán Kính Vùng Tác Động (Độ góc)',
    'label.brush_strength': 'Cường Độ Công Cụ / Tai Biến',
    'section.trigger_selected': 'Kích Hoạt Tại Tọa Độ Đang Chọn',
    'label.selected_coord_prefix': 'Đang chọn',
    'btn.trigger_flora': '🌿 Gieo Sự Sống Tại Đây',
    'btn.trigger_meteor': '☄️ Thiên Thạch Tại Đây',
    'btn.trigger_volcano': '🌋 Phun Trào Tại Đây',
    'btn.trigger_quake': '⚡ Động Đất Tại Đây',
    'btn.trigger_tsunami': '🌊 Sóng Thần Tại Đây',
    'btn.trigger_storm': '🌀 Siêu Bão Tại Đây',
    'btn.trigger_flood': '🌧 Gây Lũ Tại Đây',
    'btn.focus_coord': '🎯 Xoay Camera Tới Đây',

    // Tab 4: Evolution Lab & Phylogeny
    'section.evo_chart': 'Biểu Đồ Thời Gian Thực Khí Hậu & Sinh Quyển',
    'label.chart_metric': 'Chỉ Số Biểu Đồ',
    'chart.temp_hab': 'Nhiệt Độ TB (°C) & Độ Thích Nghi (%)',
    'chart.atmo': 'Khí Quyển O₂ (%) & CO₂ (ppm)',
    'chart.bio_fauna': 'Sinh Khối Thực Vật & Động Vật (%)',
    'chart.biodiv': 'Đa Dạng Sinh Học (H\') & Số Loài Sống',
    'section.evo_summary': 'Cây Phát Sinh Chủng Loại & Bậc Dinh Dưỡng',
    'evo.living_species': 'Loài Đang Sống',
    'evo.extinct_species': 'Nhánh Tuyệt Chủng',
    'evo.shannon_index': 'Chỉ Số Đa Dạng (H\')',
    'evo.recovery_trend': 'Xu Hướng Sinh Quyển',
    'input.species_search_placeholder': 'Tìm tên loài, bậc dinh dưỡng, đặc điểm...',
    'section.species_explorer': 'Danh Mục Loài & Nhánh Tiến Hóa',
    'evo.no_species': 'Chưa có loài sinh vật nào xuất hiện. Hãy bật Abiogenesis và tua nhanh thời gian, hoặc nhấn "Phủ Sự Sống Toàn Cầu".',
    'evo.status_alive': 'ĐANG TỒN TẠI',
    'evo.status_extinct': 'ĐÃ TUYỆT CHỦNG',
    'evo.btn_extirpate': 'Xóa sổ',
    'evo.ancestor_root': 'Gốc Khởi Nguyên (Abiogenesis)',
    'evo.parent_prefix': 'Tổ tiên',

    // Tab 5: Save & History
    'section.checkpoints': 'Điểm Lưu (Checkpoints) & Xuất/Nhập JSON',
    'input.checkpoint_placeholder': 'Tên điểm lưu...',
    'btn.save_checkpoint': '+ Lưu',
    'btn.export_json': '⬇ Xuất JSON',
    'btn.import_json': '⬆ Nhập JSON',
    'section.saved_checkpoints': 'Danh Sách Điểm Lưu Dòng Thời Gian',
    'btn.restore_checkpoint': 'Khôi phục',
    'label.steps': 'Bước tính',
    'section.event_log': 'Nhật Ký Sự Kiện & Lịch Sử Hành Tinh',

    // Right Panel: Telemetry & Inspector
    'section.telemetry': 'Thông Số Viễn Thám Hành Tinh Toàn Cầu',
    'stat.mean_temp': 'Nhiệt Độ Bề Mặt TB',
    'stat.temp_extremes': 'Biên Độ Nhiệt Cực Trị',
    'stat.ocean_cov': 'Độ Phủ Đại Dương',
    'stat.ice_cov': 'Độ Phủ Băng Quyển',
    'stat.eff_sealevel': 'Mực Nước Biển Hiệu Dụng',
    'stat.forcing': 'Cưỡng Bức CO₂ (ΔF)',
    'stat.albedo': 'Suất Phản Chiếu (Albedo)',
    'stat.energy': 'Cân Bằng Năng Lượng Ròng',
    'stat.hydro': 'Độ Ẩm TB / Lượng Mưa',
    'stat.wind_max': 'Vận Tốc Gió Cực Đại',
    'stat.biomass': 'Sinh Khối Thực Vật TB',
    'stat.fauna_o2': 'Động Vật / Khí Quyển O₂',
    'stat.species_biodiv': 'Số Loài / Đa Dạng H\'',
    'stat.ext_stress': 'Áp Lực Tuyệt Chủng',
    'section.honesty': 'Tích Phân Số Học & Minh Bạch Thời Gian',
    'honesty.steps_computed': 'Số Bước Đã Tính Thực Tế:',
    'honesty.steps_skipped': 'Số Bước Rút Gọn (Coarse/Analytical):',
    'honesty.perf': 'Tốc Độ Khung Hình / Bước Sim:',
    'section.inspector': 'Trạm Quan Trắc Tọa Độ (Nhấp Vào Hành Tinh)',
    'domain.ABIOTIC_OCEAN': 'BỒN ĐẠI DƯƠNG VÔ SINH',
    'domain.POLAR_SEA_ICE': 'BĂNG BIỂN VÙNG CỰC (SEA ICE)',
    'domain.HYDROTHERMAL_VENT_MICROBES': 'VI SINH VẬT MIỆNG THỦY NHIỆT',
    'domain.MARINE_PHYTOPLANKTON_REEF': 'TẢO PHÙ DU & RẠN SAN HÔ BIỂN',
    'domain.GLACIAL_ICE_SHEET': 'THỀM BĂNG LỤC ĐỊA (GLACIER)',
    'domain.ABIOTIC_REGOLITH': 'VỎ LỤC ĐỊA ĐÁ TRƠ VÔ SINH',
    'domain.ARID_DESERT_SCRUB': 'CÂY BỤI BÁN HOANG MẠC KHÔ HẠN',
    'domain.TUNDRA_MOSS': 'RÊU ĐÀI NGUYÊN CẬN CỰC (TUNDRA)',
    'domain.TEMPERATE_GRASSLAND': 'THẢO NGUYÊN ÔN ĐỚI / SAVANNAH',
    'domain.BOREAL_TAIGA_FOREST': 'RỪNG LÁ KIM PHƯƠNG BẮC (TAIGA)',
    'domain.TROPICAL_RAINFOREST': 'RỪNG MƯA NHIỆT ĐỚI RẬM RẠP',
    'insp.elev': 'Độ Cao Vỏ Địa Chất:',
    'insp.depth': 'Độ Sâu Nước / Độ Cao:',
    'insp.depth_unit': 'm sâu',
    'insp.alt_unit': 'm cao',
    'insp.temp': 'Nhiệt Độ Bề Mặt:',
    'insp.hum': 'Độ Ẩm Cột Khí Quyển:',
    'insp.precip': 'Lượng Mưa Khu Vực:',
    'insp.wind': 'Vectơ Gió Tại Chỗ:',
    'insp.ice': 'Độ Dày Lớp Băng:',
    'insp.bio': 'Sinh Khối / Động Vật:',
    'insp.hab': 'Thích Nghi / Đa Dạng:',
    'insp.species': 'Loài Chiếm Ưu Thế:',
    'insp.hazard': 'Địa Nhiệt / Sóng Thần:',

    // Errors & Alerts
    'err.invalid_speed': 'Định dạng tốc độ khoa học không hợp lệ',
    'err.negative_speed': 'Tốc độ mô phỏng không được âm',
    'err.import_failed': 'Không thể đọc file snapshot JSON',

    // HXN GENESIS 3.0 — UI Mode, Tutorial & Help
    'btn.mode_creator': '🎨 Chế Độ Sáng Tạo',
    'btn.mode_advanced': '🔬 Chế Độ Chuyên Sâu',
    'btn.mode_toggle_title': 'Chuyển đổi giữa Chế độ Sáng tạo (rút gọn) và Chế độ Khoa học Chuyên sâu',
    'btn.graticule': '🌐 Lưới Tọa Độ',
    'btn.graticule_title': 'Bật/Tắt Lưới Kinh Vĩ Độ 3D & Trục Nghiêng Hành Tinh (G)',
    'btn.help': '❓ Hướng Dẫn',
    'btn.help_title': 'Mở Hướng Dẫn Tương Tác & Bảng Phím Tắt (?)',
    'welcome.badge': 'HXN GENESIS 3.0 — CÔNG CỤ KIẾN TẠO HÀNH TINH & TIẾN HÓA SINH QUYỂN',
    'welcome.title': 'Kiến Tạo Hành Tinh. Điêu Khắc Lục Địa. Khởi Nguyên Sự Sống.',
    'welcome.subtitle': 'Tạo một hành tinh từ con số 0, tùy chỉnh vật lý & quỹ đạo, điêu khắc núi non và đại dương 3D, rồi dẫn dắt sự sống tiến hóa qua hàng tỷ năm.',
    'welcome.btn_create': '🪐 Tự Tạo Thế Giới (Hướng Dẫn Từng Bước)',
    'welcome.btn_preset': '🌍 Khám Phá Kịch Bản Có Sẵn',
    'welcome.btn_skip': '⏭ Bỏ Qua Hướng Dẫn',
    'tutorial.step_prefix': 'BƯỚC HƯỚNG DẪN',
    'tutorial.btn_prev': '← Quay lại',
    'tutorial.btn_next': 'Tiếp theo →',
    'tutorial.btn_skip': 'Bỏ qua',
    'tutorial.btn_finish': '✓ Hoàn tất & Bắt đầu',
    'tutorial.WATCH_PLANET.title': '1. Chào Mừng Đến Với Hành Tinh 3D',
    'tutorial.WATCH_PLANET.body': 'Hành tinh khởi đầu ở trạng thái vô sinh (Abiotic) với khí quyển, đại dương và địa hình gắn kết vật lý. Hãy quan sát mây, đại dương và ranh giới ngày-đêm.',
    'tutorial.CAMERA_BASICS.title': '2. Điều Khiển Camera & Góc Nhìn 3D',
    'tutorial.CAMERA_BASICS.body': 'Kéo Chuột Trái để xoay quanh hành tinh, Cuộn Chuột để phóng to/thu nhỏ, Kéo Chuột Phải để dịch chuyển. Dùng nút góc nhìn nhanh hoặc nhấn phím R để đặt lại camera.',
    'tutorial.CHOOSE_WORLD.title': '3. Chọn Kịch Bản Hoặc Tự Tạo Hành Tinh',
    'tutorial.CHOOSE_WORLD.body': 'Chọn 1 trong 12 kịch bản hoặc tùy chỉnh Tên hành tinh, Seed, Bán kính, Khối lượng, Trọng lực, Loại sao chủ và Kiểu địa hình trong tab Thế Giới.',
    'tutorial.SCULPT_TERRAIN.title': '4. Điêu Khắc Lục Địa & Đáy Đại Dương',
    'tutorial.SCULPT_TERRAIN.body': 'Mở tab Sự Sống để nâng dãy núi, đào rãnh đại dương, tạo hố thiên thạch, làm phẳng cao nguyên hoặc vẽ đất liền và băng tuyết trực tiếp lên quả cầu 3D.',
    'tutorial.CLIMATE_WATER.title': '5. Tinh Chỉnh Khí Quyển, Khí Nhà Kính & Đại Dương',
    'tutorial.CLIMATE_WATER.body': 'Điều chỉnh Độ phủ Đại dương (%), Áp suất bề mặt (bar), CO₂, O₂ và Argon trong tab Khí Quyển. Khí N₂ sẽ tự động cân bằng phần trăm còn lại.',
    'tutorial.SEED_LIFE.title': '6. Gieo Mầm Sự Sống & Tự Khởi Sinh (Abiogenesis)',
    'tutorial.SEED_LIFE.body': 'Nhấn "Phủ Sự Sống Toàn Cầu" hoặc gieo Vi sinh vật, Thực vật, Động vật lên vùng thích nghi—hoặc bật Abiogenesis để sự sống tự nảy mầm ở biển ấm.',
    'tutorial.TIME_EVOLUTION.title': '7. Tua Nhanh Thời Gian Địa Chất (Deep-Time)',
    'tutorial.TIME_EVOLUTION.body': 'Sử dụng thanh tốc độ phía trên (1x tới 1e9x+) để tua nhanh hàng nghìn đến hàng triệu năm, quan sát sinh vật đột biến và phân hóa loài.',
    'tutorial.SPECIES_INSPECT.title': '8. Quan Trắc Tọa Độ & Cây Tiến Hóa',
    'tutorial.SPECIES_INSPECT.body': 'Nhấp vào bất kỳ vị trí nào trên quả cầu để xem độ cao, nhiệt độ, quần xã và loài thống trị, hoặc mở tab Tiến Hóa để tra cứu cây phả hệ.',
    'tutorial.EVENTS_GOD_MODE.title': '9. Tai Biến Thiên Nhiên & Thí Nghiệm Toàn Cầu',
    'tutorial.EVENTS_GOD_MODE.body': 'Thử thách sức chống chịu của sinh quyển bằng Thiên thạch, Siêu núi lửa, Sóng thần, Lạnh đi toàn cầu, Hiệu ứng nhà kính cấp tốc hoặc Phục hồi sinh thái.',
    'tutorial.SAVE_EXPORT.title': '10. Thư Viện Thế Giới, Tự Động Lưu & Xuất JSON',
    'tutorial.SAVE_EXPORT.body': 'Mở tab Lưu & Nhật Ký để lưu hành tinh vào Thư viện Thế giới, nhân bản, đổi tên hoặc xuất/nhập file JSON an toàn.',

    // HXN GENESIS 3.0 — Planet Creation Wizard & Physical Properties
    'section.planet_identity': 'Định Danh Hành Tinh & Tham Số Vật Lý',
    'label.planet_name': 'Tên Hành Tinh',
    'input.planet_name_placeholder': 'VD: Genesis Prime',
    'label.terrain_style': 'Kiểu Địa Hình Thủ Tục (10 Kiểu)',
    'style.EARTH_CONTINENTS': 'Lục Địa & Đại Dương Giống Trái Đất',
    'style.ARCHIPELAGO': 'Quần Đảo Núi Lửa Phân Tán',
    'style.SUPERCONTINENT': 'Siêu Lục Địa Pangaea',
    'style.OCEAN_PLANET': 'Hành Tinh Đại Dương Toàn Cầu',
    'style.DESERT_PLANET': 'Hành Tinh Sa Mạc & Cao Nguyên Đá',
    'style.ICE_WORLD': 'Hành Tinh Băng Hà Đóng Băng',
    'style.VOLCANIC_WORLD': 'Hành Tinh Miệng Núi Lửa & Dung Nham',
    'style.CRATERED_WORLD': 'Cao Nguyên Hố Va Chạm Thiên Thạch',
    'style.ALIEN': 'Địa Hình Xoắn Kỳ Dị Ngoại Hành Tinh',
    'style.CUSTOM': 'Địa Hình Tùy Chỉnh Tự Do',
    'label.ocean_target': 'Độ Phủ Đại Dương Mục Tiêu (%)',
    'label.planet_radius': 'Bán Kính Hành Tinh (km)',
    'label.planet_mass': 'Khối Lượng Hành Tinh (M⊕)',
    'label.rotation_period': 'Chu Kỳ Tự Quay / Độ Dài Ngày (giờ)',
    'label.orbital_distance': 'Khoảng Cách Quỹ Đạo (AU)',
    'label.eccentricity': 'Độ Lệch Tâm Quỹ Đạo (e)',
    'label.star_type': 'Phân Loại Quang Phổ Sao Chủ',
    'star.M': 'Sao Lùn Đỏ M (0.04 L☉)',
    'star.K': 'Sao Lùn Cam K (0.35 L☉)',
    'star.G': 'Sao Giống Mặt Trời G (1.00 L☉)',
    'star.F': 'Sao Trắng Vàng F (2.60 L☉)',
    'label.gravity_override': 'Ghi Đè Trọng Lực Tùy Chỉnh (m/s²)',
    'derived.gravity': 'Gia Tốc Trọng Trường (g)',
    'derived.density': 'Khối Lượng Riêng TB (ρ)',
    'derived.escape': 'Vận Tốc Vũ Trụ Cấp 2 (vₑ)',
    'derived.insolation': 'Bức Xạ Sao Nhận Được (S/S₀)',
    'derived.lapse': 'Gradien Nhiệt Độ Theo Độ Cao',
    'section.terrain_gen': 'Tham Số Tạo Địa Hình Chuyên Sâu',
    'label.roughness': 'Độ Nhám Địa Hình Chi Tiết',
    'label.mountain_height': 'Chiều Cao Dãy Núi Kiến Tạo',
    'label.continent_scale': 'Kích Thước Mảng Lục Địa',
    'label.crater_density': 'Mật Độ Hố Va Chạm Thiên Thạch',
    'label.plateaus': 'Độ Phân Bậc Cao Nguyên',
    'btn.regen_terrain': '↻ Tạo Lại Địa Hình Theo Kiểu Này',

    // HXN GENESIS 3.0 — Geology & Interior
    'section.geology': 'Nội Tâm Hành Tinh & Kiến Tạo Mảng',
    'label.internal_heat': 'Nhiệt Lượng Phóng Xạ Nội Tâm',
    'label.crust_thickness': 'Độ Dày Vỏ Hành Tinh (km)',
    'label.mantle_activity': 'Cường Độ Đối Lưu Manti',
    'label.tectonic_activity': 'Tốc Độ Nâng/Tách Ranh Giới Mảng',
    'label.impact_count': 'Số Vụ Va Chạm Lớn Đã Ghi Nhận',
    'btn.tectonic_pulse': '⛰ Kích Hoạt Xung Kiến Tạo Mảng',

    // HXN GENESIS 3.0 — Atmosphere Gas Composition
    'section.gas_composition': 'Thành Phần Khí Quyển & Áp Suất Bề Mặt',
    'label.pressure_bar': 'Áp Suất Khí Quyển Bề Mặt',
    'label.argon': 'Khí Trơ Argon (Ar %)',
    'label.nitrogen_filler': 'Khí Nitơ Cân Bằng (N₂ %)',
    'note.gas_balance': 'Khi chỉnh O₂, CO₂ hoặc Ar, khí nền N₂ sẽ tự động bù trừ mà không làm thay đổi các khí khác.',

    // HXN GENESIS 3.0 — Sculpting Workshop & Global Experiments
    'tool.sculpt_smooth': '〰 Làm Mượt Địa Hình',
    'tool.sculpt_flatten': '📏 San Phẳng Cao Nguyên',
    'tool.sculpt_mountain': '🏔 Tạo Dãy Núi Dài',
    'tool.sculpt_basin': '🕳 Đào Bồn Trũng Sâu',
    'tool.sculpt_crater': '☄ Đóng Dấu Hố Thiên Thạch',
    'tool.paint_ocean': '🌊 Vẽ Đáy Đại Dương',
    'tool.paint_land': '🏝 Боồi Đắp Đất Liền',
    'tool.add_ice': '❄ Phủ Băng Tuyết',
    'tool.remove_ice': '🔥 Làm Tan Băng Cục Bộ',
    'tool.restore_terrain': '↺ Khôi Phục Địa Hình Gốc',
    'label.brush_falloff': 'Đường Cong Suy Giảm Cọ (Falloff)',
    'falloff.SMOOTH': 'Chuông Cosine Mượt',
    'falloff.LINEAR': 'Hình Nón Tuyến Tính',
    'falloff.CONSTANT': 'Đóng Dấu Phẳng Cứng',
    'label.brush_shape': 'Hình Dạng Đầu Cọ (Shape)',
    'shape.CIRCLE': 'Hình Tròn Cầu',
    'shape.RING': 'Vành Đai / Miệng Núi Lửa',
    'shape.RIDGE': 'Sống Núi Dài Kiến Tạo',
    'label.brush_symmetry': 'Đối Xứng Nét Vẽ (Symmetry)',
    'symmetry.NONE': 'Đơn Lẻ (Không Đối Xứng)',
    'symmetry.LONGITUDE_MIRROR': 'Đối Xứng Qua Kinh Tuyến (±λ)',
    'symmetry.EQUATOR_MIRROR': 'Đối Xứng Qua Xích Đạo (±φ)',
    'section.global_experiments': 'Thí Nghiệm Môi Trường Toàn Cầu',
    'btn.exp_cooling': '❄ Xung Lạnh Đi Toàn Cầu',
    'btn.exp_greenhouse': '🔥 Sốc Nhà Kính Cấp Tốc',
    'btn.exp_atmo_loss': '💨 Tước Bỏ Khí Quyển',
    'btn.exp_ocean_loss': '🏜 Bốc Hơi Toàn Bộ Đại Dương',
    'btn.exp_recovery': '🌱 Xung Phục Hồi Sinh Thái',
    'confirm.destructive_event': 'Sự kiện toàn cầu này có tính hủy diệt cao đối với khí quyển, đại dương hoặc sinh quyển. Bạn có muốn tiếp tục?',

    // HXN GENESIS 3.0 — World Library & Camera Presets
    'section.world_library': 'Thư Viện Thế Giới & Tự Động Lưu',
    'btn.load_autosave': '↺ Tải Bản Tự Động Lưu',
    'btn.duplicate_world': '⧉ Nhân bản',
    'btn.rename_world': '✎ Đổi tên',
    'btn.delete_world': '✕ Xóa',
    'cam.default': '🌐 Góc Nhìn Chuẩn',
    'cam.north': '⬆ Cực Bắc',
    'cam.equator': '➖ Xích Đạo',
    'cam.south': '⬇ Cực Nam',
    'help.modal_title': 'HXN GENESIS 3.0 — Hướng Dẫn Điều Khiển, Phím Tắt & Cơ Sở Khoa Học',
    'help.search_placeholder': 'Tìm kiếm công cụ, phím tắt bàn phím, hoặc mô hình vật lý...',
    'help.btn_restart_tour': '🎓 Mở Lại Hướng Dẫn Tương Tác 10 Bước',
    'help.btn_close': '✕ Đóng',
    'tab.explore': '🧭 Thám Hiểm',
    'tab.science': '🛰 Phòng Lab',
    'layer.radiation': '☢ Bức Xạ',
    'layer.minerals': '⛏ Khoáng Sản',
    'layer.civilization': '🏛 Văn Minh',
    'btn.cmd_palette': '⌘ Lệnh Nhanh (Ctrl+K)',
    'btn.magnetosphere': '🧲 Từ Quyển 3D',
    'btn.presentation': '🎬 Trình Chiếu',
    'section.exploration': '1. Thám Hiểm Bề Mặt & Bản Đồ Hành Tinh',
    'section.geochemistry': '2. Chu Trình Địa Hóa & Khai Thác Tài Nguyên',
    'section.civilization': '3. Văn Minh Thông Minh & Đô Thị Hóa',
    'section.terraforming': '4. Kỹ Thuật Cải Tạo Hành Tinh (Terraforming)',
    'section.space_weather': '5. Phòng Thủ Thiên Thạch & Thời Tiết Vũ Trụ',
    'section.remote_sensing': '6. Viễn Thám & Quang Phổ Ngoại Hành Tinh',
    'section.magnetism': '7. Từ Quyển Hành Tinh & Lá Chắn Bức Xạ',
    'section.stratigraphy': '8. Cột Địa Tầng & Hồ Sơ Hóa Thạch',
    'section.analytics': '9. Phân Tích Nhân Quả, Tương Quan & Monte Carlo',
    'section.missions_mods': '10–12. Nhiệm Vụ, Tiện Ích Mở Rộng & Trợ Năng'
  }
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

export class I18nManager {
  private currentLang: LanguageCode = 'en';
  private listeners: Array<(lang: LanguageCode) => void> = [];

  constructor(defaultLang: LanguageCode = 'en') {
    this.currentLang = this.loadSavedLanguage(defaultLang);
  }

  private loadSavedLanguage(fallback: LanguageCode): LanguageCode {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY_LANGUAGE);
        if (saved === 'en' || saved === 'vi') {
          return saved;
        }
      }
    } catch {
      // Ignore storage access errors in headless/node tests
    }
    return fallback;
  }

  public getLanguage(): LanguageCode {
    return this.currentLang;
  }

  public setLanguage(lang: LanguageCode): void {
    this.currentLang = lang;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_LANGUAGE, lang);
      }
      if (typeof document !== 'undefined') {
        document.documentElement.lang = lang;
        document.title = this.t('app.title');
        this.applyToDOM();
      }
    } catch {
      // Ignore storage errors
    }
    for (const cb of this.listeners) {
      cb(lang);
    }
  }

  public toggleLanguage(): LanguageCode {
    const next: LanguageCode = this.currentLang === 'en' ? 'vi' : 'en';
    this.setLanguage(next);
    return next;
  }

  public onChange(cb: (lang: LanguageCode) => void): void {
    this.listeners.push(cb);
  }

  public t(key: TranslationKey): string {
    return TRANSLATIONS[this.currentLang][key] ?? TRANSLATIONS.en[key];
  }

  public formatGeologicalTime(rawGeological: string): string {
    if (this.currentLang === 'en') return rawGeological;
    return rawGeological
      .replace('yr (Present Epoch)', 'năm (Kỷ nguyên Hiện tại)')
      .replace('yr (Holocene-scale)', 'năm (Thang Thế Toàn Tân / Holocene)')
      .replace('kyr (Glacial-scale)', 'nghìn năm / kyr (Thang Băng Hà)')
      .replace('Myr (Tectonic-scale)', 'triệu năm / Myr (Thang Kiến Tạo)')
      .replace('Gyr (Planetary Eon)', 'tỷ năm / Gyr (Liên đại Hành tinh)')
      .replace('yr (Cosmological Deep Time)', 'năm (Thời gian Sâu Vũ trụ)');
  }

  public translateStabilityNote(note: string): string {
    if (this.currentLang === 'en') return note;
    return note
      .replace('Fine Euler-CFL step (REALTIME)', 'Bước tích phân mịn Euler-CFL (REALTIME)')
      .replace(/Fast-Forward \((\d+) substeps\/frame\)/, 'Tua nhanh Fast-Forward ($1 bước phụ/khung hình)')
      .replace(
        'Coarse-Time implicit-damped step (CFL clamped)',
        'Bước thời gian thô giảm chấn ẩn (Giới hạn ổn định CFL)'
      )
      .replace(
        'Analytical radiative-cryosphere relaxation + secular erosion',
        'Hội tụ giải tích bức xạ - băng quyển & xói mòn kiến tạo dài hạn'
      )
      .replace(
        /Visual Time Warp \(([^)]+)\): asymptotic equilibrium & secular tectonic decay/,
        'Bước nhảy thị giác ($1): cân bằng tiệm cận & suy giảm địa chất dài hạn'
      )
      .replace('Initialized deterministic world from seed', 'Đã khởi tạo thế giới tất định từ Seed')
      .replace('Climate reset to radiative equilibrium', 'Đã đặt lại khí hậu về trạng thái cân bằng bức xạ')
      .replace('Updated global terrain relief scale', 'Đã cập nhật hệ số độ dốc địa hình toàn cầu')
      .replace('Localized terrain sculpted', 'Đã điêu khắc địa hình cục bộ')
      .replace('Modified planetary cryosphere coverage', 'Đã điều chỉnh độ phủ băng quyển hành tinh')
      .replace('Restored world state from snapshot', 'Đã khôi phục trạng thái hành tinh từ bản lưu')
      .replace('Sea level datum adjusted', 'Đã điều chỉnh mực nước biển chuẩn')
      .replace('Updated atmospheric parameter', 'Đã cập nhật thông số khí quyển')
      .replace('Global Biosphere seeded across habitable zones', 'Đã gieo mầm sinh quyển trên toàn bộ vùng thích nghi')
      .replace('Biosphere sterilized (Abiotic state restored)', 'Đã tiệt trùng sinh quyển (Trở về trạng thái vô sinh)')
      .replace(/^Seeded (\w+) at/, 'Đã gieo mầm $1 tại')
      .replace(/^Triggered (\w+) at/, 'Đã kích hoạt $1 tại');
  }

  public translateEventCategory(category: string): string {
    if (this.currentLang === 'en') return category;
    switch (category) {
      case 'GOD_ACTION':
        return 'TÁC ĐỘNG';
      case 'HAZARD':
        return 'TAI BIẾN';
      case 'CLIMATE':
        return 'KHÍ HẬU';
      case 'BIOSPHERE':
        return 'SINH QUYỂN';
      case 'EVOLUTION':
        return 'TIẾN HÓA';
      case 'TIME':
        return 'THỜI GIAN';
      case 'SYSTEM':
        return 'HỆ THỐNG';
      default:
        return category;
    }
  }

  public translateEventMessage(msg: string): string {
    if (this.currentLang === 'en') return msg;
    return msg
      .replace(
        /^Generated world with seed "([^"]+)" \(([^)]+)\)$/,
        'Khởi tạo thế giới với Seed "$1" ($2)'
      )
      .replace(
        'Partial Reset: restored atmosphere, ocean waves, and ice to equilibrium.',
        'Đặt lại một phần: đã đưa khí quyển, sóng biển và băng về trạng thái cân bằng.'
      )
      .replace(
        /^Full World Reset to preset "([^"]+)" \(seed: ([^)]+)\)\.$/,
        'Đặt lại toàn bộ thế giới về kịch bản "$1" (seed: $2).'
      )
      .replace(
        /^Adjusted global cryosphere target coverage to (\d+)%\.$/,
        'Đã điều chỉnh mục tiêu độ phủ băng quyển toàn cầu thành $1%.'
      )
      .replace(
        'Global Biosphere Bloom: seeded flora and fauna across all habitable zones.',
        'Bùng nổ Sinh quyển Toàn cầu: đã phủ thực vật và động vật trên mọi vùng thích nghi.'
      )
      .replace(
        'Planet sterilized: all biomass and fauna wiped out.',
        'Đã tiệt trùng hành tinh: toàn bộ sinh khối và động vật bị xóa sổ.'
      )
      .replace(
        'Abiogenesis: microbial life emerged naturally in warm marine basins!',
        'Khởi nguyên sự sống (Abiogenesis): vi sinh vật đã tự hình thành trong vùng biển ấm!'
      )
      .replace(/^Seeded (\w+) at (.+)$/, 'Đã gieo mầm $1 tại $2')
      .replace(/^Set custom simulation speed to (.+)$/, 'Đã đặt tốc độ mô phỏng tùy chỉnh thành $1')
      .replace(/^Saved checkpoint "([^"]+)"$/, 'Đã lưu điểm mốc "$1"')
      .replace(/^Undid action: (.+)$/, 'Đã hoàn tác: $1')
      .replace(/^Redid action: (.+)$/, 'Đã làm lại: $1')
      .replace(
        /^VOLCANO triggered at ([^()]+) \(intensity (\d+%)\)$/,
        'NÚI LỬA phun trào tại $1 (cường độ $2)'
      )
      .replace(
        /^METEOR triggered at ([^()]+) \(intensity (\d+%)\)$/,
        'THIÊN THẠCH va chạm tại $1 (cường độ $2)'
      )
      .replace(
        /^EARTHQUAKE triggered at ([^()]+) \(intensity (\d+%)\)$/,
        'ĐỘNG ĐẤT đứt gãy tại $1 (cường độ $2)'
      )
      .replace(
        /^TSUNAMI triggered at ([^()]+) \(intensity (\d+%)\)$/,
        'SÓNG THẦN khởi phát tại $1 (cường độ $2)'
      )
      .replace(
        /^STORM triggered at ([^()]+) \(intensity (\d+%)\)$/,
        'SIÊU BÃO xoáy thuận tại $1 (cường độ $2)'
      )
      .replace(
        /^DROUGHT triggered at ([^()]+) \(intensity (\d+%)\)$/,
        'HẠN HÁN khu vực tại $1 (cường độ $2)'
      )
      .replace(
        /^FLOOD triggered at ([^()]+) \(intensity (\d+%)\)$/,
        'LŨ LỤT ĐẠI HỒNG THỦY tại $1 (cường độ $2)'
      );
  }

  public translatePresetName(preset: string): string {
    if (this.currentLang === 'en') return preset;
    switch (preset) {
      case 'Earth-like':
        return 'Giống Trái Đất';
      case 'Ice World':
        return 'Hành Tinh Băng';
      case 'Desert World':
        return 'Hành Tinh Sa Mạc';
      case 'Ocean World':
        return 'Hành Tinh Đại Dương';
      case 'Volcanic World':
        return 'Hành Tinh Núi Lửa';
      case 'Habitable Young Planet':
        return 'Hành Tinh Trẻ Thích Nghi';
      case 'Rapid Greenhouse':
        return 'Nhà Kính Cấp Tốc';
      case 'Glaciation & Recovery':
        return 'Băng Hà & Phục Hồi';
      case 'Mass Extinction Testbed':
        return 'Thử Nghiệm Đại Tuyệt Chủng';
      case 'Isolated Evolution':
        return 'Tiến Hóa Cô Lập';
      case 'Low-Oxygen Biospheres':
        return 'Sinh Quyển Oxy Thấp';
      case 'Custom':
        return 'Tùy Chỉnh';
      default:
        return preset;
    }
  }

  public applyToDOM(root: ParentNode = document): void {
    root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n') as TranslationKey;
      if (key && key in TRANSLATIONS.en) {
        el.textContent = this.t(key);
      }
    });

    root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title') as TranslationKey;
      if (key && key in TRANSLATIONS.en) {
        el.setAttribute('title', this.t(key));
      }
    });

    root.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder') as TranslationKey;
      if (key && key in TRANSLATIONS.en) {
        el.setAttribute('placeholder', this.t(key));
      }
    });
  }
}

export const i18n = new I18nManager('en');
