import { SIM_CONFIG } from '../engine/simulation/SimConstants';
import {
  estimateParticleCount,
  spacingForTargetCount,
} from '../engine/simulation/fluidSpawn';

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

function ControlButton({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: 'primary' | 'muted';
  onClick: () => void;
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-stone-100/15 text-stone-100 hover:bg-stone-100/30'
      : 'bg-stone-100/10 text-stone-300 hover:bg-stone-100/25';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer px-3 py-1.5 text-sm transition ${toneClass}`}
    >
      {label}
    </button>
  );
}

function ParamHint({ text }: { text: string }) {
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={text}
        className="peer flex h-3.5 w-3.5 cursor-help items-center justify-center bg-stone-100/15 text-[9px] leading-none text-stone-300 transition hover:bg-stone-100/30 hover:text-stone-100"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full right-0 z-20 mt-1.5 w-44 bg-stone-950/90 px-2 py-1.5 text-[10px] leading-snug text-stone-200 opacity-0 shadow-lg transition peer-hover:opacity-100 peer-focus-visible:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 text-xs text-stone-200">
        <span className="flex items-center gap-1.5">
          <span>{label}</span>
          <ParamHint text={hint} />
        </span>
        <span className="font-mono text-[11px] text-stone-400">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-stone-500/40 accent-stone-100"
        aria-label={label}
      />
    </div>
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
  const minCount = SIM_CONFIG.MIN_PARTICLE_COUNT;
  const maxCount = SIM_CONFIG.MAX_PARTICLE_COUNT;

  return (
    <aside className="pointer-events-auto absolute top-5 right-5 z-10 flex w-56 flex-col gap-6 bg-transparent">
      <div className="flex gap-3">
        <ControlButton
          tone="primary"
          onClick={running ? onPause : onPlay}
          label={running ? 'Pause' : 'Start'}
        />
        <ControlButton tone="muted" onClick={onReset} label="Reset" />
      </div>

      <div className="flex flex-col gap-5">
        <SliderField
          label="Amplitude"
          hint="How far the piston travels each stroke. Higher values make stronger waves."
          value={amplitude}
          min={SIM_CONFIG.MIN_WAVE_AMPLITUDE}
          max={SIM_CONFIG.MAX_WAVE_AMPLITUDE}
          step={0.1}
          display={amplitude.toFixed(1)}
          onChange={onAmplitudeChange}
        />
        <SliderField
          label="Period"
          hint="Time for one full piston stroke. Shorter periods produce faster waves."
          value={periodSeconds}
          min={SIM_CONFIG.MIN_WAVE_PERIOD}
          max={SIM_CONFIG.MAX_WAVE_PERIOD}
          step={0.05}
          display={`${periodSeconds.toFixed(2)}s`}
          onChange={onPeriodChange}
        />
        <SliderField
          label="Particles"
          hint="Number of fluid particles. More particles look smoother but cost more performance."
          value={particleCount}
          min={minCount}
          max={maxCount}
          step={100}
          display={particleCount.toLocaleString()}
          onChange={(count) => {
            onParticleCountChange(spacingForTargetCount(count, amplitude));
          }}
        />
        <p className="text-[12px] leading-snug text-stone-500">
          Drag the colored points to reshape the floor and piston tip.
        </p>
      </div>
    </aside>
  );
}
