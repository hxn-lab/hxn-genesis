/**
 * Real Performance Benchmark for HXN GENESIS Simulation Core
 * Measures actual step latency, throughput (steps/sec), theoretical FPS budget,
 * and memory footprint across grid resolutions.
 */
import { parseSciSpeed } from './time';
import { WorldSimulation } from './world';

function runResolutionBenchmark(width: number, height: number, iterations = 100): void {
  const memBefore = process.memoryUsage().heapUsed;
  const tInit0 = performance.now();
  const sim = new WorldSimulation(width, height, 'Earth-like', 'BENCH-SEED-01');
  const initMs = performance.now() - tInit0;

  // Warmup
  for (let i = 0; i < 10; i++) {
    sim.singleStep(600);
  }

  // Benchmark REALTIME single step
  sim.speedSci = parseSciSpeed('1');
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) {
    sim.advanceFrame(1 / 60);
  }
  const totalMs = performance.now() - t0;
  const avgStepMs = totalMs / iterations;
  const maxTheoreticalFps = 1000 / Math.max(0.01, avgStepMs);

  // Benchmark COARSE_TIME (1e6x, 6 substeps/frame)
  sim.speedSci = parseSciSpeed('1e6');
  const tCoarse0 = performance.now();
  for (let i = 0; i < 30; i++) {
    sim.advanceFrame(1 / 60);
  }
  const avgCoarseFrameMs = (performance.now() - tCoarse0) / 30;

  const memAfter = process.memoryUsage().heapUsed;
  const deltaHeapKb = Math.max(128, Math.round((memAfter - memBefore) / 1024));

  console.log(
    `Grid ${width}x${height} (${width * height} cells) | Init: ${initMs.toFixed(1)} ms | ` +
    `REALTIME Step: ${avgStepMs.toFixed(2)} ms (${maxTheoreticalFps.toFixed(0)} sim-steps/sec ceiling) | ` +
    `COARSE (1e6x) Frame: ${avgCoarseFrameMs.toFixed(2)} ms | Heap Δ: ~${deltaHeapKb} KB`
  );
}

console.log('=== HXN GENESIS — REAL SIMULATION PERFORMANCE BENCHMARK ===');
runResolutionBenchmark(72, 36, 120);
runResolutionBenchmark(144, 72, 120);
runResolutionBenchmark(288, 144, 60);
