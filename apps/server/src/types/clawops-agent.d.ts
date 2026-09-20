// moduleResolution:Node(CJS)에서는 package exports 서브패스 타입을 찾지 못하므로
// 에이전트 워커가 쓰는 최소 표면만 선언한다. 런타임 해석은 Node exports 맵이 담당.
declare module "@teamlearners/clawops/agent" {
  export class ClawOpsAgent {
    constructor(options: Record<string, unknown>);
    on(event: string, handler: (...args: unknown[]) => void | Promise<void>): this;
    tool(...args: unknown[]): this;
    connect(): Promise<void>;
    drain(options?: { timeoutMs?: number }): Promise<void>;
    disconnect(): Promise<void>;
  }
  export class OpenAIRealtime {
    constructor(options: Record<string, unknown>);
  }
}
