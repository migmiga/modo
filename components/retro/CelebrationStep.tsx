"use client";

import { useState } from "react";
import Image from "next/image";
import { IconBeer, IconFlower, IconHeart, IconMoon, IconRocket, IconSun, IconTrophy } from "@tabler/icons-react";

import { MOMO_SETS } from "@/lib/momoSets";

const CONFETTI_COLORS = ["#2563eb", "#ea580c", "#16a34a", "#7c3aed"];

// Module-level, deterministic (not re-randomized per render) piece layout.
const CONFETTI_PIECES = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2;
  const distance = 70 + (i % 3) * 20;
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance - 40, // biased upward
    rot: (i % 2 === 0 ? 1 : -1) * (180 + i * 15),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delayMs: (i % 5) * 40,
  };
});

// Temp stand-ins for 모모's 7 transformations, in the same order as
// lib/momoSets.ts's MOMO_SETS (맥주잔/초승달/트로피/하트/꽃/햇살/로켓) — Momo
// itself becomes each shape, so these icons represent the *shape*, not an
// object Momo is holding. Swap to the real art via each MomoSet's imageSrc;
// this array stays as the fallback for any set that hasn't gotten one yet.
const MOMO_FALLBACK_ICONS = [IconBeer, IconMoon, IconTrophy, IconHeart, IconFlower, IconSun, IconRocket];

export function CelebrationStep({ onClose, momoSetIndex }: { onClose: () => void; momoSetIndex: number }) {
  // Only ever mounted client-side (post-hydration), so window is always safe
  // here — same technique as DayGroup.tsx's scrollByStep.
  const [reducedMotion] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  const index = ((momoSetIndex % MOMO_SETS.length) + MOMO_SETS.length) % MOMO_SETS.length;
  const set = MOMO_SETS[index];
  const FallbackIcon = MOMO_FALLBACK_ICONS[index];

  return (
    <div className="flex h-full flex-col items-center text-center">
      {/* Centers the image+text block within whatever space is left above
          the close button, instead of centering the whole group (image +
          text + button) in the full modal height — that previous approach
          split the leftover space above *and* below the button, leaving it
          floating with dead space beneath it. */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className="relative flex h-32 w-32 items-center justify-center" aria-hidden="true">
          {!reducedMotion &&
            CONFETTI_PIECES.map((p, i) => (
              <span
                key={i}
                className="animate-retro-confetti absolute left-1/2 top-1/2 h-2.5 w-1.5 rounded-[2px]"
                style={
                  {
                    backgroundColor: p.color,
                    animationDelay: `${p.delayMs}ms`,
                    "--confetti-x": `${p.x}px`,
                    "--confetti-y": `${p.y}px`,
                    "--confetti-rot": `${p.rot}deg`,
                  } as React.CSSProperties
                }
              />
            ))}
          {set.imageSrc ? (
            <Image src={set.imageSrc} alt="" width={128} height={128} className="h-full w-full object-contain" />
          ) : (
            <FallbackIcon size={56} className="text-slate" />
          )}
        </div>

        <div className="mt-9 space-y-2">
          <h2 className="text-xl font-medium">{set.title}</h2>
          <p className="text-xs text-muted">{set.subtitle}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="mt-auto flex h-[30px] w-full max-w-[400px] items-center justify-center rounded-[4px] bg-accent-strong px-3 py-2 text-xs font-medium text-accent-foreground transition hover:brightness-95 active:brightness-90"
      >
        닫기
      </button>
    </div>
  );
}
