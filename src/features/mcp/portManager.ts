import * as net from "net";
import { logger } from "../../platform/vscode/logger";

export const DEFAULT_MCP_PORT = 25789;

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => {
      srv.close();
      resolve(true);
    });
    srv.listen(port, "127.0.0.1");
  });
}

/** Returns preferred port if available, otherwise 0 (OS will assign). */
export async function findAvailablePort(preferred: number): Promise<number> {
  if (await isPortAvailable(preferred)) {
    return preferred;
  }
  logger.info(`Port ${preferred} occupied, falling back to OS-assigned port`);
  return 0;
}
