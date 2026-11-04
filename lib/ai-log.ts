/**
 * Prints every AI call a backend request made to the browser console, so a demo
 * can show how the Meta API is used. The backend sends the calls in the
 * X-AI-Trace response header (backend/ai/client.py). Open DevTools > Console.
 */
type AiCall = {
  purpose: string;
  model: string;
  endpoint: string;
  ms: number;
  in: number;
  out: number;
  reasoning: number;
  system: string;
  prompt: string;
  response: string;
};

const STYLE = 'background:#4f46e5;color:#fff;padding:1px 6px;border-radius:3px;font-weight:600';

export function logAiCalls(res: Response, path: string): void {
  if (typeof window === 'undefined') return;
  const raw = res.headers.get('X-AI-Trace');
  if (!raw) return;
  try {
    const calls = JSON.parse(raw) as AiCall[];
    for (const c of calls) {
      console.groupCollapsed(
        `%cAI%c ${c.purpose} · ${c.model} · ${c.ms} ms · ${c.in} in / ${c.out} out tokens`,
        STYLE,
        'color:inherit',
      );
      console.log('Endpoint:', c.endpoint, '(called from', path + ')');
      console.log('Model:', c.model, '| reasoning effort: low');
      console.log('Tokens:', { input: c.in, output: c.out, reasoning: c.reasoning });
      console.log('Latency:', `${c.ms} ms`);
      console.log('Instructions (start):', c.system);
      console.log('Input (start):', c.prompt);
      console.log('Output (start):', c.response);
      console.groupEnd();
    }
  } catch {
    /* a malformed header is not worth breaking a request over */
  }
}
