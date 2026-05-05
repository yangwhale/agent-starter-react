import { ReactNode, useEffect } from 'react';
import { toast as sonnerToast } from 'sonner';
import { useAgent, useSessionContext } from '@livekit/components-react';
import { WarningIcon } from '@phosphor-icons/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ToastProps {
  title: ReactNode;
  description: ReactNode;
}

function toastAlert(toast: ToastProps) {
  const { title, description } = toast;

  return sonnerToast.custom(
    (id) => (
      <Alert onClick={() => sonnerToast.dismiss(id)} className="bg-accent w-full md:w-[364px]">
        <WarningIcon weight="bold" />
        <AlertTitle>{title}</AlertTitle>
        {description && <AlertDescription>{description}</AlertDescription>}
      </Alert>
    ),
    { duration: 10_000 }
  );
}

export function useAgentErrors() {
  const agent = useAgent();
  const { isConnected } = useSessionContext();

  useEffect(() => {
    if (isConnected && agent.state === 'failed') {
      const reasons = agent.failureReasons;

      // CloseCrab 改造: 不再调 end() 主动断开 session.
      // 默认 20 秒 agent-init timeout 太严: 我们的 worker join 了 room 但
      // 不会主动 publish lk.agent.state="listening" attribute, 前端误判为
      // "agent did not complete initializing" 触发 end(). 实际上 worker 是
      // 健康的, 用户说话它就能回. 只 toast 提醒, 不强制断开.
      toastAlert({
        title: 'Agent state warning',
        description: (
          <>
            {reasons.length > 1 && (
              <ul className="list-inside list-disc">
                {reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            {reasons.length === 1 && <p className="w-full">{reasons[0]}</p>}
            <p className="w-full text-xs opacity-70">
              Session 保持开启 — 直接说话试试.
            </p>
          </>
        ),
      });
    }
  }, [agent, isConnected]);
}
