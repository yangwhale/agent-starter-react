'use client';

import { useEffect, useMemo, useState } from 'react';
import { TokenSource } from 'livekit-client';
import { useSession } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react/dist/ssr';
import type { AppConfig } from '@/app-config';
import { AgentSessionProvider } from '@/components/agents-ui/agent-session-provider';
import { StartAudioButton } from '@/components/agents-ui/start-audio-button';
import { ViewController } from '@/components/app/view-controller';
import { Toaster } from '@/components/ui/sonner';
import { useAgentErrors } from '@/hooks/useAgentErrors';
import { useDebugMode } from '@/hooks/useDebug';
import { getSandboxTokenSource } from '@/lib/utils';

const IN_DEVELOPMENT = process.env.NODE_ENV !== 'production';

function AppSetup() {
  useDebugMode({ enabled: IN_DEVELOPMENT });
  useAgentErrors();

  return null;
}

interface AppProps {
  appConfig: AppConfig;
}

// CloseCrab voice IO 改造: 用 TokenSource.custom 把 URL 上的 ?bot/&openId/&sig=
// 透传给 /api/token endpoint, 否则 starter-react 默认走 demo 模式 (匿名 identity).
// 飞书 /voice 命令生成的链接形如:
//   https://live.higcp.com/?bot=tianmaojingling&openId=ou_xxxx&sig=hex_hmac_sha256
// route.ts 验签后才肯签 feishu:{openId} identity 并 dispatch
// closecrab-voice-{bot} agent (per-bot 独立 worker, 避免一台机器多 bot 撞车).
const CLOSECRAB_AGENT_PREFIX = 'closecrab-voice';

function readUrlParams(): { bot: string; openId: string; sig: string } {
  if (typeof window === 'undefined') {
    return { bot: '', openId: '', sig: '' };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    bot: params.get('bot') ?? '',
    openId: params.get('openId') ?? '',
    sig: params.get('sig') ?? '',
  };
}

function makeClosecrabTokenSource() {
  return TokenSource.custom(async (options) => {
    const { bot, openId, sig } = readUrlParams();
    const res = await fetch('/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...options,
        bot,
        openId,
        sig,
      }),
    });
    if (!res.ok) {
      throw new Error(`token endpoint ${res.status}: ${await res.text()}`);
    }
    return await res.json();
  });
}

export function App({ appConfig }: AppProps) {
  // CloseCrab 模式下 URL 必带 bot, useSession 等的 agent_name 必须和 token
  // 里 dispatch 的一致 → 从 URL 派生 closecrab-voice-{bot}, 不能用
  // appConfig.agentName (build-time env, 单值无法覆盖多 bot 场景).
  //
  // SSR 注意: 不能用 useMemo([], () => readUrlParams()) — SSR 阶段
  // window===undefined 返回空, hydration 后 deps=[] 不会重算, 永远 undefined.
  // 必须 useState(undefined) + useEffect 在 client mount 后 set, 触发 re-render
  // 把正确值喂给 useSession (它会响应 agentName 变化重新订阅 participant).
  const [closecrabAgentName, setClosecrabAgentName] = useState<string | undefined>(undefined);
  useEffect(() => {
    const { bot } = readUrlParams();
    if (bot) {
      setClosecrabAgentName(`${CLOSECRAB_AGENT_PREFIX}-${bot}`);
    }
  }, []);

  const tokenSource = useMemo(() => {
    return typeof process.env.NEXT_PUBLIC_CONN_DETAILS_ENDPOINT === 'string'
      ? getSandboxTokenSource(appConfig)
      : makeClosecrabTokenSource();
  }, [appConfig]);

  // closecrabAgentName 优先 (URL 派生); 其次 appConfig.agentName (demo fallback).
  const effectiveAgentName = closecrabAgentName ?? appConfig.agentName;
  const session = useSession(
    tokenSource,
    effectiveAgentName ? { agentName: effectiveAgentName } : undefined
  );

  return (
    <AgentSessionProvider session={session}>
      <AppSetup />
      <main className="grid h-svh grid-cols-1 place-content-center">
        <ViewController appConfig={appConfig} />
      </main>
      <StartAudioButton label="Start Audio" />
      <Toaster
        icons={{
          warning: <WarningIcon weight="bold" />,
        }}
        position="top-center"
        className="toaster group"
        style={
          {
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
          } as React.CSSProperties
        }
      />
    </AgentSessionProvider>
  );
}
