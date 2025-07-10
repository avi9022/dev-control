import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const detectPortFromScripts = (scripts: Record<string, string>): number | null => {
  const scriptKeys = ["dev", "start", "serve", "develop", "local", "watch"];
  for (const key of scriptKeys) {
    const script = scripts[key];
    if (!script) continue;

    const match = script.match(/(?:--port|-p)\s*(\d{2,5})/);
    if (match) return parseInt(match[1], 10);
  }
  return null;
};

const detectPortFromEnv = (dir: string): number | null => {
  const files = ['.env', '.env.local'];
  for (const file of files) {
    const envPath = path.join(dir, file);
    if (!fs.existsSync(envPath)) continue;

    const content = fs.readFileSync(envPath, 'utf-8');
    const match = content.match(/^PORT\s*=\s*(\d{2,5})/m);
    if (match) return parseInt(match[1], 10);
  }
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const detectPortFromFramework = (dirPath: string, pkg: Record<string, any>): number | null => {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (!deps) return null;

  // Vite
  if (deps['vite']) {
    const viteConfigPath = path.join(dirPath, 'vite.config.ts');
    if (fs.existsSync(viteConfigPath)) {
      const viteConfig = fs.readFileSync(viteConfigPath, 'utf-8');
      const match = viteConfig.match(/port\s*:\s*(\d{2,5})/);
      if (match) return parseInt(match[1], 10);
    }

    const jsConfigPath = path.join(dirPath, 'vite.config.js');
    if (fs.existsSync(jsConfigPath)) {
      const viteConfig = fs.readFileSync(jsConfigPath, 'utf-8');
      const match = viteConfig.match(/port\s*:\s*(\d{2,5})/);
      if (match) return parseInt(match[1], 10);
    }

    return null; // Don't assume 5173
  }

  // Next.js (Next config rarely defines port — usually set via env or CLI)
  if (deps['next']) {
    // Try .env (fallback to your env parser)
    const envPort = detectPortFromEnv(dirPath);
    if (envPort) return envPort;
    return null; // Don't assume 3000
  }

  // Create React App (react-scripts) — usually reads from PORT env
  if (deps['react-scripts']) {
    const envPort = detectPortFromEnv(dirPath);
    if (envPort) return envPort;
    return null;
  }

  // Gatsby
  if (deps['gatsby']) {
    const gatsbyConfigPath = path.join(dirPath, 'gatsby-config.js');
    if (fs.existsSync(gatsbyConfigPath)) {
      const config = fs.readFileSync(gatsbyConfigPath, 'utf-8');
      const match = config.match(/port\s*:\s*(\d{2,5})/);
      if (match) return parseInt(match[1], 10);
    }

    const envPort = detectPortFromEnv(dirPath);
    if (envPort) return envPort;

    return null;
  }

  return null;
};

export const detectPortByRunning = async (
  dirPath: string,
  command: string
): Promise<number | null> => {
  return new Promise((resolve) => {
    const proc = spawn(command, {
      cwd: dirPath,
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' },
    });

    const timeout = setTimeout(() => {
      proc.kill();
      resolve(null);
    }, 7000);

    const regex = /localhost:(\d{2,5})|port\s+(\d{2,5})/i;

    const handleOutput = (data: Buffer) => {
      const text = data.toString();
      const match = text.match(regex);
      if (match) {
        clearTimeout(timeout);
        proc.kill();
        resolve(parseInt(match[1] || match[2], 10));
      }
    };

    proc.stdout.on('data', handleOutput);
    proc.stderr.on('data', handleOutput);
    proc.on('exit', () => resolve(null));
  });
};

export const detectPort = async (dirPath: string, runCommand: string | null): Promise<number | null> => {
  const pkgPath = path.join(dirPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const scripts = pkg.scripts || {};

  // Try static methods first
  const staticPort =
    detectPortFromScripts(scripts) ||
    detectPortFromEnv(dirPath) ||
    detectPortFromFramework(dirPath, pkg);

  if (staticPort) return staticPort;

  // Fallback to sniffing if we have a runCommand
  if (runCommand) {
    return await detectPortByRunning(dirPath, runCommand);
  }

  return null;
};
