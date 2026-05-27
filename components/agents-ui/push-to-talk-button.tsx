'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { useLocalParticipant } from '@livekit/components-react';
import { MicrophoneIcon } from '@phosphor-icons/react/dist/ssr';
import { cn } from '@/lib/shadcn/utils';

// Push-to-talk: 按住 unmute, 松开 mute。
// 默认 mute 实现: 监听 SDK 的 localTrackPublished 事件, 等 mic track 真正 publish 后
// 再 setMicrophoneEnabled(false) — 此时 track 已上传到 server, 切 mute 只动 flag,
// 不会跟 publish 时序撞导致 track 上传被取消 (上一版直接 mount mute 翻车的根因).
// 如果挂载前 SDK 已经 publish 完了, 走 fast-path 直接 mute。
// pointer capture: 按下后即使手指划出按钮边界, 松开仍触发 up 事件, 避免 mic 卡开。
export function PushToTalkButton({ className }: { className?: string }) {
  const { localParticipant } = useLocalParticipant();
  const pressedRef = useRef(false);
  const initialMutedRef = useRef(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (initialMutedRef.current) return;

    const muteIfNeeded = (reason: string) => {
      if (initialMutedRef.current) return;
      initialMutedRef.current = true;
      localParticipant.setMicrophoneEnabled(false).catch((err) => {
        console.warn(`PTT initial mute failed (${reason}):`, err);
      });
    };

    const existing = localParticipant.getTrackPublication(Track.Source.Microphone);
    if (existing?.track) {
      muteIfNeeded('fast-path');
      return;
    }

    const handler = (pub: { source?: Track.Source }) => {
      if (pub?.source === Track.Source.Microphone) muteIfNeeded('event');
    };
    localParticipant.on('localTrackPublished', handler);
    return () => {
      localParticipant.off('localTrackPublished', handler);
    };
  }, [localParticipant]);

  const enableMic = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      console.warn('PTT mic enable failed:', err);
    }
  }, [localParticipant]);

  const disableMic = useCallback(async () => {
    try {
      await localParticipant.setMicrophoneEnabled(false);
    } catch (err) {
      console.warn('PTT mic disable failed:', err);
    }
  }, [localParticipant]);

  const handleDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (pressedRef.current) return;
      pressedRef.current = true;
      setActive(true);
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore - capture may fail on some devices
      }
      void enableMic();
    },
    [enableMic]
  );

  const handleUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!pressedRef.current) return;
      pressedRef.current = false;
      setActive(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      void disableMic();
    },
    [disableMic]
  );

  return (
    <button
      type="button"
      aria-label="Push to talk"
      onPointerDown={handleDown}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'mb-2 flex h-14 w-full touch-none items-center justify-center gap-2 rounded-full select-none',
        'text-primary-foreground text-base font-semibold shadow-md transition-colors duration-150',
        active ? 'bg-red-500 shadow-red-500/40' : 'bg-primary hover:bg-primary/90',
        className
      )}
    >
      <MicrophoneIcon size={22} weight="fill" />
      <span>{active ? 'Recording…' : 'Hold to talk'}</span>
    </button>
  );
}
