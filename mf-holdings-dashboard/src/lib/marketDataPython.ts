import { spawn } from "child_process";
import path from "path";

export type MarketHoldingInput = { ticker: string; weight: number };
const PYTHON_HARD_TIMEOUT_MS = 120_000;

/** Run scripts/fetch_market_data.py; returns parsed JSON array or throws */
export function fetchMarketDataViaPython(holdings: MarketHoldingInput[]): Promise<unknown[]> {
  const script = path.join(process.cwd(), "scripts", "fetch_market_data.py");
  const payload = JSON.stringify(holdings);

  const { cmd, argsPrefix } =
    process.platform === "win32"
      ? { cmd: "py", argsPrefix: ["-3"] as string[] }
      : { cmd: "python3", argsPrefix: [] as string[] };

  return new Promise((resolve, reject) => {
    const py = spawn(cmd, [...argsPrefix, script, payload], {
      cwd: process.cwd(),
      env: process.env,
      windowsHide: true,
    });
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      py.kill("SIGTERM");
      settled = true;
      reject(new Error(`python_timeout_${PYTHON_HARD_TIMEOUT_MS}ms`));
    }, PYTHON_HARD_TIMEOUT_MS);
    let output = "";
    let error = "";
    py.stdout.on("data", (d) => {
      output += d.toString();
    });
    py.stderr.on("data", (d) => {
      error += d.toString();
    });
    py.on("error", (err) => {
      if (settled) return;
      clearTimeout(timeout);
      settled = true;
      reject(err);
    });
    py.on("close", (code) => {
      if (settled) return;
      clearTimeout(timeout);
      settled = true;
      if (code !== 0) {
        reject(new Error(error || `python_exit_${code}`));
        return;
      }
      try {
        const data = JSON.parse(output.trim());
        if (!Array.isArray(data)) {
          reject(new Error("python_output_not_array"));
          return;
        }
        resolve(data);
      } catch {
        reject(new Error("parse_error"));
      }
    });
  });
}
