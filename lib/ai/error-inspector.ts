/**
 * Deep error inspector for AI SDK / Vercel Gateway errors.
 *
 * The AI SDK can throw:
 * - Error objects (normal)
 * - Promise objects that resolve or reject to the real error
 * - GatewayError objects with nested cause chains
 * - APICallError objects with statusCode, responseBody, data
 * - Plain objects with no prototype (e.g. {})
 * - Strings
 *
 * This utility unwraps all of these into a structured debug report
 * that flows through SSE events to the debug drawer.
 */

export interface ErrorReport {
  summary: string;       // One-line human-readable summary
  type: string;          // Constructor name
  message: string;       // Error message
  statusCode?: number;   // HTTP status if available
  responseBody?: string; // Raw response body
  cause?: ErrorReport;   // Nested cause chain
  allKeys: string[];     // All enumerable + own property names
  raw: string;           // Full JSON dump (truncated)
}

function inspectSingle(err: unknown): ErrorReport {
  if (err === null || err === undefined) {
    return { summary: 'null/undefined error', type: 'null', message: '', allKeys: [], raw: String(err) };
  }

  if (typeof err === 'string') {
    return { summary: err, type: 'string', message: err, allKeys: [], raw: err };
  }

  if (typeof err !== 'object') {
    return { summary: String(err), type: typeof err, message: String(err), allKeys: [], raw: String(err) };
  }

  const obj = err as any;
  const type = obj.constructor?.name || 'Object';
  const message = obj.message || obj.error || obj.detail || '';
  const statusCode = obj.statusCode || obj.status || obj.code;
  const responseBody = obj.responseBody ? String(obj.responseBody).substring(0, 1000) : undefined;
  const allKeys = [...new Set([...Object.keys(obj), ...Object.getOwnPropertyNames(obj)])];

  let cause: ErrorReport | undefined;
  if (obj.cause) {
    cause = inspectSingle(obj.cause);
  }

  // Try to get data/response fields
  const extras: string[] = [];
  if (obj.data) extras.push(`data=${JSON.stringify(obj.data).substring(0, 500)}`);
  if (obj.response && typeof obj.response === 'object') {
    extras.push(`response=${JSON.stringify(obj.response).substring(0, 500)}`);
  }
  if (obj.url) extras.push(`url=${obj.url}`);
  if (obj.requestBodyValues) extras.push(`requestBody=${JSON.stringify(obj.requestBodyValues).substring(0, 300)}`);

  let raw: string;
  try {
    raw = JSON.stringify(obj, null, 2).substring(0, 1500);
  } catch {
    raw = `[non-serializable: ${allKeys.join(', ')}]`;
  }

  const summary = [
    type !== 'Error' ? type : '',
    statusCode ? `HTTP ${statusCode}` : '',
    message || '(no message)',
    extras.length > 0 ? extras.join('; ') : '',
    cause ? `← caused by: ${cause.summary}` : '',
  ].filter(Boolean).join(' | ');

  return { summary, type, message, statusCode, responseBody, cause, allKeys, raw };
}

/**
 * Inspect any error, including Promise-wrapped errors from the AI SDK.
 * Returns a structured report with everything needed for debugging.
 */
export async function inspectError(err: unknown): Promise<ErrorReport> {
  // Handle Promise-wrapped errors (AI SDK throws these from generateVideo)
  if (err && typeof err === 'object' && typeof (err as any).then === 'function') {
    try {
      const resolved = await (err as Promise<unknown>);
      // Promise resolved — the resolved value IS the error info
      const inner = inspectSingle(resolved);
      return {
        ...inner,
        summary: `Promise resolved to: ${inner.summary}`,
        type: `Promise<${inner.type}>`,
      };
    } catch (rejected) {
      // Promise rejected — the rejection IS the real error
      const inner = await inspectError(rejected); // recursive in case of nested Promises
      return {
        ...inner,
        summary: `Promise rejected: ${inner.summary}`,
        type: `Promise<${inner.type}>`,
      };
    }
  }

  return inspectSingle(err);
}

/**
 * Format an ErrorReport as a multi-line string for SSE debug events.
 */
export function formatErrorReport(report: ErrorReport): string[] {
  const lines: string[] = [];
  lines.push(`Error: ${report.summary}`);
  lines.push(`Type: ${report.type} | Keys: ${report.allKeys.join(', ') || '(none)'}`);
  if (report.statusCode) lines.push(`Status: ${report.statusCode}`);
  if (report.responseBody) lines.push(`Response body: ${report.responseBody}`);
  if (report.cause) {
    lines.push(`Cause: ${report.cause.summary}`);
    if (report.cause.responseBody) lines.push(`Cause body: ${report.cause.responseBody}`);
    if (report.cause.cause) lines.push(`Root cause: ${report.cause.cause.summary}`);
  }
  lines.push(`Raw: ${report.raw}`);
  return lines;
}
