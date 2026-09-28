'use client';

// Study modes
export type StudyMode = 'flashcard' | 'guess' | 'repeat';

// Helper to convert part of speech to localized label with custom badge color
export function getPartOfSpeechInfo(
  pos?: string,
  t?: any
): { label: string; color: string; bg: string; border: string } {
  if (!pos) {
    return {
      label: t ? t('pos.default', 'Từ vựng') : 'Từ vựng',
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    };
  }
  const lower = pos.toLowerCase().trim();
  switch (lower) {
    case 'noun':
    case 'n':
      return {
        label: t ? t('pos.noun', 'Danh từ') : 'Danh từ',
        color: 'text-sky-700',
        bg: 'bg-sky-50',
        border: 'border-sky-200',
      };
    case 'verb':
    case 'v':
      return {
        label: t ? t('pos.verb', 'Động từ') : 'Động từ',
        color: 'text-violet-700',
        bg: 'bg-violet-50',
        border: 'border-violet-200',
      };
    case 'adjective':
    case 'adj':
      return {
        label: t ? t('pos.adjective', 'Tính từ') : 'Tính từ',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
      };
    case 'adverb':
    case 'adv':
      return {
        label: t ? t('pos.adverb', 'Trạng từ') : 'Trạng từ',
        color: 'text-amber-700',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
      };
    case 'preposition':
    case 'prep':
      return {
        label: t ? t('pos.preposition', 'Giới từ') : 'Giới từ',
        color: 'text-rose-700',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
      };
    case 'pronoun':
    case 'pron':
      return {
        label: t ? t('pos.pronoun', 'Đại từ') : 'Đại từ',
        color: 'text-cyan-700',
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
      };
    case 'conjunction':
    case 'conj':
      return {
        label: t ? t('pos.conjunction', 'Liên từ') : 'Liên từ',
        color: 'text-teal-700',
        bg: 'bg-teal-50',
        border: 'border-teal-200',
      };
    case 'interjection':
      return {
        label: t ? t('pos.interjection', 'Thán từ') : 'Thán từ',
        color: 'text-fuchsia-700',
        bg: 'bg-fuchsia-50',
        border: 'border-fuchsia-200',
      };
    case 'idiom':
    case 'phrase':
      return {
        label: t ? t('pos.idiom', 'Thành ngữ / Cụm từ') : 'Thành ngữ / Cụm từ',
        color: 'text-purple-700',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
      };
    default:
      return {
        label: pos,
        color: 'text-blue-700',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
      };
  }
}

// Lightweight celebration confetti on canvas
export function triggerConfetti(originX = 0.5, originY = 0.6) {
  if (typeof window === 'undefined') return;

  const canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100vw';
  canvas.style.height = '100vh';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const colors = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ec4899',
    '#8b5cf6',
    '#06b6d4',
    '#ef4444',
  ];
  const particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    color: string;
    rotation: number;
    rotSpeed: number;
    opacity: number;
  }> = [];

  const count = 75;
  const startX = window.innerWidth * originX;
  const startY = window.innerHeight * originY;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
    const speed = 4 + Math.random() * 8;
    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)] || '#3b82f6',
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
    });
  }

  let animationFrameId: number;
  let startTime = performance.now();

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    let aliveCount = 0;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.98; // air resistance
      p.rotation += p.rotSpeed;
      p.opacity = Math.max(0, 1 - elapsed / 1800);

      if (p.opacity > 0 && p.y < window.innerHeight) {
        aliveCount++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    }

    if (aliveCount > 0 && elapsed < 2000) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  };

  animationFrameId = requestAnimationFrame(animate);
}

// Web Audio API Tones for instant game sound feedback
export function playTone(
  frequencies: number[],
  type: OscillatorType = 'sine',
  duration = 0.2,
  volume = 0.15
) {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    gain.connect(ctx.destination);

    frequencies.forEach((freq, idx) => {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      osc.connect(gain);
      osc.start(now + idx * 0.08);
      osc.stop(now + duration);
    });
  } catch {
    // Ignore audio context errors if blocked by browser policy
  }
}

export function playSuccessSound() {
  playTone([523.25, 659.25, 783.99], 'sine', 0.4, 0.15); // C5, E5, G5 chime
}

export function playComboSound() {
  playTone([587.33, 739.99, 880.0, 1046.5], 'triangle', 0.5, 0.2); // Energetic fanfare
}

export function playFlipSound() {
  playTone([400, 320], 'sine', 0.15, 0.08);
}

export function playErrorSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.setValueAtTime(170, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore
  }
}

export function playVictoryFanfare() {
  playTone([523.25, 659.25, 783.99, 1046.5, 1318.51], 'triangle', 0.8, 0.25);
}
