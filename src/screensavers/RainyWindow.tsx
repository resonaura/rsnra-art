// @ts-nocheck
import { RainyDay, Drop } from "./rainyday.vendor.js";
import { useEffect, useRef } from "react";
import type { ScreenSaverProps } from "./types";

// ─── Background capture ────────────────────────────────────────────────────

async function captureDesktopImg(
  exclude: HTMLElement | null,
  isPreview: boolean,
): Promise<HTMLImageElement | null> {
  try {
    const root = document.getElementById("rsnra-desktop-root");
    if (!root) return null;
    const { default: h2c } = await import("html2canvas");
    const snap = await h2c(root, {
      // Use a consistent scale. Very small scales (like 0.2) in html2canvas
      // cause severe visual artifacts that look like over-saturation.
      scale: 0.5,
      logging: false,
      ignoreElements: (el: Element) =>
        !!exclude && (el === exclude || exclude.contains(el)),
    });
    if (snap.width < 4 || snap.height < 4) return null;
    const img = new Image();
    img.src = snap.toDataURL("image/png");
    await new Promise<void>((res) => { img.onload = () => res(); });
    return img;
  } catch {
    return null;
  }
}

// ─── Component ─────────────────────────────────────────────────────────────

export function RainyWindow({ preview }: ScreenSaverProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // The blur strength rainyday uses for the background in full screen.
  const BLUR_PX = 10;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let alive = true;
    let rd: InstanceType<typeof RainyDay> | null = null;
    let dropInterval: ReturnType<typeof setInterval> | null = null;

    const W = Math.max(container.clientWidth,  2);
    const H = Math.max(container.clientHeight, 2);

    // ── Canvas — hidden until first composite frame ───────────────────────
    const canvas = document.createElement("canvas");
    canvas.width  = W;
    canvas.height = H;
    Object.assign(canvas.style, {
      position:       "absolute",
      inset:          "0",
      width:          "100%",
      height:         "100%",
      display:        "block",
      opacity:        "0",
      transition:     "opacity 0.35s ease",
      // GPU compositing hints
      transform:      "translateZ(0)",
      willChange:     "contents",
    });
    container.appendChild(canvas);

    // ── Drop presets ──────────────────────────────────────────────────────
    const dropSizes = preview
      ? [
          { minR: 1, baseR: 1, freq: 0.7 },  // tiny condensate
          { minR: 2, baseR: 2, freq: 0.35 },  // small sliding
        ]
      : [
          { minR: 2, baseR: 3, freq: 0.72 },  // micro-condensate (static)
          { minR: 5, baseR: 4, freq: 0.42 },  // medium sliding
          { minR: 10, baseR: 9, freq: 0.16 }, // large teardrops
        ];

    const nucleationMs = preview ? 280 : 120;

    // ── Initialise RainyDay ───────────────────────────────────────────────
    const initRD = (img: HTMLImageElement) => {
      if (!alive) return;

      if (dropInterval) { clearInterval(dropInterval); dropInterval = null; }
      if (rd) {
        try { rd.pause(); } catch { /**/ }
        rd = null;
      }

      rd = new RainyDay({
        image:         img,
        canvas,

        fps:           120,            // sets gravity factor; rAF uses monitor Hz
        blur:          BLUR_PX,
        opacity:       1,

        width:         W,
        height:        H,
        parentElement: container,
        position:      "absolute",
        top:           "0px",
        left:          "0px",
        enableSizeChange: false,

        reflectionScaledownFactor:   preview ? 12 : 5,
        reflectionDropMappingWidth:  preview ? 50 : 140,
        reflectionDropMappingHeight: preview ? 50 : 140,

        gravityThreshold:    preview ? 2 : 4,
        gravityAngle:        Math.PI / 2,
        gravityAngleVariance: 0,       // strict vertical, no horizontal drift
        enableCollisions:    true,

        fillStyle: "#1565c0",
      });

      try { rd.pause(); } catch { /**/ }

      // ── Override addDropCallback → composite EVERY rAF frame ────────
      // Original library only composites at the `speed` interval (≈11fps).
      // We remove that throttle so the output matches the rAF rate (60/120fps).
      const rdRef = rd as any;
      let firstFrame = true;

      rdRef.addDropCallback = function() {
        if (!rdRef.canvas || !rdRef.background || !rdRef.glass) return;
        const ctx = rdRef.canvas.getContext("2d");
        if (!ctx) return;

        ctx.clearRect(0, 0, rdRef.canvas.width, rdRef.canvas.height);
        ctx.drawImage(rdRef.background, 0, 0, rdRef.canvas.width, rdRef.canvas.height);
        ctx.save();
        ctx.globalAlpha = rdRef.options.opacity;
        ctx.drawImage(rdRef.glass, 0, 0, rdRef.canvas.width, rdRef.canvas.height);
        ctx.restore();

        // First rendered frame: reveal canvas, remove backdrop-filter
        if (firstFrame) {
          firstFrame = false;
          canvas.style.opacity = "1";
          if (!preview) {
            // Give the CSS transition a tick to start, then clear backdrop
            requestAnimationFrame(() => {
              if (!alive) return;
              container.style.backdropFilter = "";
              container.style.webkitBackdropFilter = "";
              container.style.background = "transparent";
            });
          }
        }
      };

      // Resume rAF animation loop
      try { rd.resume(); } catch {
        rdRef.animateDrops?.();
      }

      // ── Separate drop nucleation interval ───────────────────────────
      dropInterval = setInterval(() => {
        if (!alive || !rd) return;
        const rdR = rd as any;
        for (const { minR, baseR, freq } of dropSizes) {
          if (Math.random() < freq) {
            try {
              rdR.putDrop(
                new Drop(rdR, Math.random() * W, Math.random() * H, minR, baseR),
              );
            } catch { /**/ }
          }
        }
      }, nucleationMs);
    };

    // ── Boot: capture screenshot → init ───────────────────────────────────
    const run = async () => {
      // Double rAF + timeout guarantees the browser paints the CSS backdrop-filter
      // BEFORE html2canvas locks up the main thread.
      await new Promise<void>((res) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(res, 100);
          });
        });
      });
      if (!alive) return;

      const screenshotImg = await captureDesktopImg(container.parentElement, preview);
      if (!alive) return;

      if (screenshotImg) {
        initRD(screenshotImg);
      } else {
        // Fallback: plain dark image if capture fails
        const fb = document.createElement("canvas");
        fb.width = Math.max(W, 2); fb.height = Math.max(H, 2);
        const fc = fb.getContext("2d")!;
        fc.fillStyle = "#0a1f4a"; fc.fillRect(0, 0, fb.width, fb.height);
        const fbImg = new Image();
        fbImg.src = fb.toDataURL();
        await new Promise<void>((res) => { fbImg.onload = () => res(); });
        if (alive) initRD(fbImg);
      }
    };

    run();

    return () => {
      alive = false;
      if (dropInterval) clearInterval(dropInterval);
      try { rd?.pause(); } catch { /**/ }
      if (canvas.parentNode === container) container.removeChild(canvas);
    };
  }, [preview]);

  // ─── Audio & Lightning System ──────────────────────────────────────────
  useEffect(() => {
    // Never play audio in preview mode (Display Properties)
    if (preview) return;

    let alive = true;
    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let rainAudio: HTMLAudioElement | null = null;
    let thunderAudio: HTMLAudioElement | null = null;
    let thunderTimer: ReturnType<typeof setTimeout> | null = null;
    let animFrame: number;

    const initAudio = () => {
      try {
        // 1. Rain stream — let browser buffer via <audio> (no heavy preloading)
        rainAudio = new Audio("/audio/rain.m4a");
        rainAudio.loop = true;
        rainAudio.volume = 0.4;
        // Autoplay policy might block this until user interacts, but screensaver 
        // usually triggers after some user interaction with the PC.
        rainAudio.play().catch(() => { /* blocked */ });

        // 2. Thunder Web Audio API setup
        thunderAudio = new Audio("/audio/thunder.m4a");
        thunderAudio.crossOrigin = "anonymous";
        thunderAudio.volume = 0.8;

        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(thunderAudio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const flashEl = document.getElementById("lightning-flash-rw");

        // 3. Lightning sync loop
        const syncFlash = () => {
          if (!alive) return;
          if (flashEl && thunderAudio && !thunderAudio.paused) {
            analyser!.getByteFrequencyData(dataArray);
            
            // Focus on lower/mid frequencies for thunder impacts
            let sum = 0;
            for (let i = 0; i < 40; i++) { 
              sum += dataArray[i];
            }
            const avg = sum / 40;
            
            // Map amplitude (0-255) to flash opacity
            // Threshold at 50 to ignore subtle rumble, scale remaining up
            // Cap maximum brightness so it's not blindingly bright
            const opacity = avg > 50 ? Math.min(0.15, (avg - 50) / 250) : 0;
            
            // Apply lightning flash visually
            flashEl.style.backgroundColor = `rgba(200, 220, 255, ${opacity})`;
          } else if (flashEl) {
            flashEl.style.backgroundColor = "transparent";
          }
          animFrame = requestAnimationFrame(syncFlash);
        };
        syncFlash();

        // 4. Random thunder scheduler
        const scheduleThunder = () => {
          if (!alive) return;
          // Randomly between 25s and 60s
          const nextDelay = 25000 + Math.random() * 35000;
          thunderTimer = setTimeout(() => {
            if (!alive) return;
            if (audioCtx?.state === "suspended") audioCtx.resume();
            if (thunderAudio) {
              thunderAudio.currentTime = 0;
              thunderAudio.play().catch(() => { /* blocked */ });
            }
            scheduleThunder();
          }, nextDelay);
        };
        
        scheduleThunder();

      } catch (err) {
        console.error("RainyWindow Audio Error:", err);
      }
    };

    initAudio();

    return () => {
      alive = false;
      if (animFrame) cancelAnimationFrame(animFrame);
      if (thunderTimer) clearTimeout(thunderTimer);
      if (rainAudio) {
        rainAudio.pause();
        rainAudio.src = "";
      }
      if (thunderAudio) {
        thunderAudio.pause();
        thunderAudio.src = "";
      }
      if (audioCtx && audioCtx.state !== "closed") {
        audioCtx.close().catch(() => {});
      }
      const flashEl = document.getElementById("lightning-flash-rw");
      if (flashEl) flashEl.style.backgroundColor = "transparent";
    };
  }, [preview]);

  return (
    <div
      ref={containerRef}
      style={{
        position:   "relative",
        width:      "100%",
        height:     "100%",
        overflow:   "hidden",
        background: preview ? "#091830" : "rgba(0,10,30,0.25)",
        backdropFilter: preview ? "none" : `blur(${BLUR_PX}px)`,
        WebkitBackdropFilter: preview ? "none" : `blur(${BLUR_PX}px)`,
      }}
    />
  );
}
