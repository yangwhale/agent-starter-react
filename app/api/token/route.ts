import { NextResponse } from 'next/server';
import { AccessToken, type AccessTokenOptions, type VideoGrant } from 'livekit-server-sdk';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { RoomAgentDispatch, RoomConfiguration } from '@livekit/protocol';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

// CloseCrab voice IO: 每个 bot 独立 HMAC secret 文件 ~/.closecrab-voice-hmac-{bot}.key
// (bot 启动时写, mode 0600). 一台机器多 bot 时按 URL 上的 ?bot= 参数读对应文件,
// 验签后签 feishu:{openId} identity + dispatch closecrab-voice-{bot} agent.
const AGENT_NAME_PREFIX = 'closecrab-voice';

// bot_name 来自用户可控 URL, 必须严格白名单防路径注入 (`bot=../../etc/passwd`).
// Firestore 里 bot key 实际就是 [a-z0-9_-]+, 这里保持一致。
const BOT_NAME_RE = /^[a-z0-9_-]{1,64}$/;

function hmacKeyPathForBot(bot: string): string {
  return join(homedir(), `.closecrab-voice-hmac-${bot}.key`);
}

function readHmacSecret(bot: string): string | null {
  try {
    return readFileSync(hmacKeyPathForBot(bot), 'utf-8').trim();
  } catch {
    return null;
  }
}

function verifySig(bot: string, openId: string, sig: string): boolean {
  const secret = readHmacSecret(bot);
  if (!secret) return false;
  const expected = createHmac('sha256', secret).update(openId).digest('hex');
  // 长度不同时 timingSafeEqual 会抛, 提前 reject.
  if (expected.length !== sig.length) return false;
  // 简单 constant-time 比较 (Buffer.compare 也行, 但这里手写更清楚)
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}

// don't cache the results
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    if (LIVEKIT_URL === undefined) {
      throw new Error('LIVEKIT_URL is not defined');
    }
    if (API_KEY === undefined) {
      throw new Error('LIVEKIT_API_KEY is not defined');
    }
    if (API_SECRET === undefined) {
      throw new Error('LIVEKIT_API_SECRET is not defined');
    }

    const body = await req.json().catch(() => ({}));

    // CloseCrab 模式: body 里带 bot + openId + sig, HMAC 验签后签 feishu identity.
    // bot 决定读哪个 secret 文件 + dispatch 哪个 agent (一台机器多 bot 共享前端).
    // 否则降级到 demo 模式 (匿名 voice_assistant_user_xxx).
    const closecrabBot = typeof body?.bot === 'string' ? body.bot : '';
    const closecrabOpenId = typeof body?.openId === 'string' ? body.openId : '';
    const closecrabSig = typeof body?.sig === 'string' ? body.sig : '';
    const isClosecrabMode = closecrabBot !== '' && closecrabOpenId !== '' && closecrabSig !== '';

    let participantName: string;
    let participantIdentity: string;
    let roomName: string;
    let roomConfig: RoomConfiguration;

    if (isClosecrabMode) {
      // 严格校验 bot 字符集, 防止 ?bot=../../foo 让 readFileSync 走偏。
      if (!BOT_NAME_RE.test(closecrabBot)) {
        return new NextResponse('invalid bot name', { status: 400 });
      }
      if (!verifySig(closecrabBot, closecrabOpenId, closecrabSig)) {
        return new NextResponse('invalid signature', { status: 403 });
      }
      const agentName = `${AGENT_NAME_PREFIX}-${closecrabBot}`;
      participantName = `feishu-${closecrabOpenId.slice(0, 8)}`;
      participantIdentity = `feishu:${closecrabOpenId}`;
      // room name 加 bot 前缀防撞 + 加时间戳后缀防 room 复用。
      // LiveKit room agents 是 per-room one-shot dispatch: 第一次创建 room 时
      // server 派一次 ROOM job, 之后这个 room 的 agent dispatch 就"用完了" ——
      // 哪怕 worker 重启回来 server 也不会二次 dispatch。所以如果用户挂断后
      // bot 重启再连进同一 room name, server 看到 room 已经派过 → 跳过 ROOM
      // dispatch → 只剩无效的 PUBLISHER/PARTICIPANT 尝试 → "no worker available"。
      // base36 时间戳 (~9 chars) 让每次 /voice 都生成唯一 room, 强制 server 重派。
      roomName = `voice-${closecrabBot}-${closecrabOpenId}-${Date.now().toString(36)}`;
      // 强制 dispatch 给本 bot 的 agent (覆盖前端传的 room_config).
      roomConfig = new RoomConfiguration({
        agents: [new RoomAgentDispatch({ agentName })],
      });
    } else {
      // Demo 模式: 走 starter-react 原有匿名逻辑. 前端传的 room_config 透传.
      participantName = 'user';
      participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
      roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;
      roomConfig = body?.room_config
        ? RoomConfiguration.fromJson(body.room_config, { ignoreUnknownFields: true })
        : new RoomConfiguration();
    }

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      roomConfig
    );

    const data: ConnectionDetails = {
      serverUrl: LIVEKIT_URL,
      roomName,
      participantName,
      participantToken,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    if (error instanceof Error) {
      console.error(error);
      return new NextResponse(error.message, { status: 500 });
    }
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig: RoomConfiguration | undefined
): Promise<string> {
  const at = new AccessToken(API_KEY, API_SECRET, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (roomConfig) {
    at.roomConfig = roomConfig;
  }

  return at.toJwt();
}
