import {
  estimateParticleCount,
  SIM_CONFIG,
  spacingForTargetCount,
} from '../engine/simulation/SimConstants';

type SimControlsProps = {
  running: boolean;
  amplitude: number;
  periodSeconds: number;
  particleSpacing: number;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onAmplitudeChange: (value: number) => void;
  onPeriodChange: (value: number) => void;
  onParticleCountChange: (spacing: number) => void;
};

function SliderField({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-stone-300">{label}</span>
        <span className="font-mono text-xs text-stone-400">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-stone-700 accent-sky-400"
      />
    </label>
  );
}

export function SimControls({
  running,
  amplitude,
  periodSeconds,
  particleSpacing,
  onPlay,
  onPause,
  onReset,
  onAmplitudeChange,
  onPeriodChange,
  onParticleCountChange,
}: SimControlsProps) {
  const particleCount = estimateParticleCount(particleSpacing, amplitude);
  const minCount = estimateParticleCount(
    SIM_CONFIG.MAX_PARTICLE_SPACING,
    amplitude
  );
  const maxCount = estimateParticleCount(
    SIM_CONFIG.MIN_PARTICLE_SPACING,
    amplitude
  );

  return (
    <aside className="flex w-full max-w-sm flex-col gap-6 border-l border-stone-800 bg-stone-950/90 p-5 text-stone-100 backdrop-blur-sm">
      <div>
        <h1 className="font-serif text-2xl tracking-tight text-stone-50">
          Fluid Tank
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={running ? onPause : onPlay}
          className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-stone-950 transition hover:bg-sky-400"
        >
          {running ? 'Stop' : 'Start'}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-stone-600 px-4 py-2 text-sm text-stone-200 transition hover:border-stone-400 hover:bg-stone-900"
        >
          Reset
        </button>
      </div>

      <div className="flex flex-col gap-5">
        <SliderField
          label="Wave amplitude"
          value={amplitude}
          min={SIM_CONFIG.MIN_WAVE_AMPLITUDE}
          max={SIM_CONFIG.MAX_WAVE_AMPLITUDE}
          step={0.1}
          display={`${amplitude.toFixed(1)} cells`}
          onChange={onAmplitudeChange}
        />
        <SliderField
          label="Wave period"
          value={periodSeconds}
          min={SIM_CONFIG.MIN_WAVE_PERIOD}
          max={SIM_CONFIG.MAX_WAVE_PERIOD}
          step={0.05}
          display={`${periodSeconds.toFixed(2)} s`}
          onChange={onPeriodChange}
        />
        <SliderField
          label="Particle count"
          value={particleCount}
          min={minCount}
          max={maxCount}
          step={100}
          display={`${particleCount.toLocaleString()} particles`}
          onChange={(count) => {
            onParticleCountChange(spacingForTargetCount(count, amplitude));
          }}
        />
      </div>
    </aside>
  );
}
