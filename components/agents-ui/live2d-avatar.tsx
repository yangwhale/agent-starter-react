'use client';

// PIXI / pixi-live2d-display ship as plain JS bundles via CDN (see app/layout.tsx).
// We don't pull in their types — typing the runtime as `any` is intentional.
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import { EMOTIONS, type EmotionKey, resolveEmotionBackground } from '@/lib/live2d-emotion';
import { cn } from '@/lib/shadcn/utils';

declare global {
  interface Window {
    PIXI?: any;
  }
}

const MODEL_URL = '/live2d/natori/Natori.model3.json';

// Wait for PIXI + pixi-live2d-display CDN scripts to finish loading before
// mounting the canvas. RootLayout includes them with strategy="beforeInteractive"
// but the actual JS runtime hookup can race with React mount.
async function waitForPixi(timeoutMs = 5000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (typeof window !== 'undefined' && window.PIXI?.live2d) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('pixi-live2d-display did not load within timeout');
}

interface Live2DAvatarProps {
  emotion?: EmotionKey;
  className?: string;
}

export function Live2DAvatar({ emotion = 'calm', className }: Live2DAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    let resizeHandler: (() => void) | null = null;

    (async () => {
      try {
        await waitForPixi();
        if (cancelled) return;
        const canvas = canvasRef.current;
        const wrapper = wrapperRef.current;
        if (!canvas || !wrapper) return;

        const PIXI = window.PIXI;
        const w = wrapper.clientWidth || 450;
        const h = wrapper.clientHeight || 450;

        const app = new PIXI.Application({
          view: canvas,
          width: w,
          height: h,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
        appRef.current = app;

        const model = await PIXI.live2d.Live2DModel.from(MODEL_URL, { autoInteract: true });
        if (cancelled) {
          app.destroy(true);
          return;
        }
        modelRef.current = model;

        // Lock the model's natural dimensions before any scale changes — PIXI's
        // model.width/height are getters returning `scale × originalSize`, so
        // dividing by them after the first transform causes scale to compound
        // on every resize (Natori grows until only the suit fills the canvas).
        const baseWidth = model.width;
        const baseHeight = model.height;

        const applyTransform = (cw: number, ch: number) => {
          const scaleX = (cw / baseWidth) * 0.9;
          const scaleY = (ch / baseHeight) * 1.3;
          const scale = Math.min(scaleX, scaleY);
          model.scale.set(scale);
          model.anchor.set(0.5, 0.35);
          model.x = cw / 2;
          model.y = ch * 0.7;
        };
        applyTransform(w, h);

        app.stage.addChild(model);
        app.stage.interactive = true;
        app.stage.hitArea = new PIXI.Rectangle(0, 0, w, h);

        model.on('hit', (hitAreas: string[]) => {
          if (hitAreas.includes('Head') || hitAreas.includes('Body')) {
            model.motion('TapBody');
          }
        });

        resizeHandler = () => {
          const nw = wrapper.clientWidth;
          const nh = wrapper.clientHeight;
          app.renderer.resize(nw, nh);
          applyTransform(nw, nh);
          app.stage.hitArea = new PIXI.Rectangle(0, 0, nw, nh);
        };
        window.addEventListener('resize', resizeHandler);

        // Apply initial emotion (will be overridden by the prop effect below).
        const initial = EMOTIONS[emotion] ?? EMOTIONS.calm;
        model.expression(initial.expression);
        model.motion(initial.motion.group, initial.motion.index);
        wrapper.style.background = resolveEmotionBackground(initial);

        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error('Live2DAvatar init failed:', err);
        setErrorMsg(msg);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      if (appRef.current) {
        try {
          appRef.current.destroy(true);
        } catch {
          /* ignore */
        }
        appRef.current = null;
      }
      modelRef.current = null;
    };
    // We intentionally only init once; emotion changes are handled by the next effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply emotion changes after model is mounted.
  //
  // ⚠️ Do NOT restart the Idle motion on every emotion change. Natori's Idle
  // motion (mtn_00, 7.97s loop) drives ParamBrowL/R/Form, ParamCheek,
  // ParamEyeLOpen/RSmile, ParamMouthForm/OpenY — i.e. the entire face. The
  // expression files use Blend: "Add" on top of motion params, so calling
  // model.motion('Idle') here resets the Idle clip to t=0 and snaps the face
  // back to the Idle keyframe, washing out the expression we just set.
  // Idle was started once at mount and loops on its own.
  useEffect(() => {
    const model = modelRef.current;
    const wrapper = wrapperRef.current;
    if (!model || !wrapper) return;
    const emo = EMOTIONS[emotion] ?? EMOTIONS.calm;
    try {
      model.expression(emo.expression);
      wrapper.style.background = resolveEmotionBackground(emo);
    } catch {
      /* expression switch failures are non-fatal */
    }
  }, [emotion]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'relative h-full w-full overflow-hidden rounded-2xl transition-[background] duration-500',
        className
      )}
      style={{ background: resolveEmotionBackground(EMOTIONS.calm) }}
    >
      <canvas ref={canvasRef} className="block h-full w-full cursor-pointer" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-gray-600 backdrop-blur-sm">
          Loading Live2D…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-x-2 bottom-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">
          Live2D 加载失败：{errorMsg}
        </div>
      )}
    </div>
  );
}
