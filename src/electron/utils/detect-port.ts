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

const detectPortFromEnv = async (dir: string): Promise<number | null> => {
  const files = ['.env', '.env.local'];
  for (const file of files) {
    const envPath = path.join(dir, file);
    try {
      const content = await fs.promises.readFile(envPath, 'utf-8');
      const match = content.match(/^PORT\s*=\s*(\d{2,5})/m);
      if (match) return parseInt(match[1], 10);
    } catch {
      // File doesn't exist or can't be read, continue to next
      continue;
    }
  }
  return null;
};

export const detectPortFromFramework = async (dirPath: string, pkg: Record<string, unknown>): Promise<number | null> => {
  const deps: Record<string, unknown> = {
    ...(pkg.dependencies as Record<string, unknown> | undefined),
    ...(pkg.devDependencies as Record<string, unknown> | undefined),
  };
  if (!deps) return null;

  // Vite
  if (deps['vite']) {
    const viteConfigPath = path.join(dirPath, 'vite.config.ts');
    try {
      const viteConfig = await fs.promises.readFile(viteConfigPath, 'utf-8');
      const match = viteConfig.match(/port\s*:\s*(\d{2,5})/);
      if (match) return parseInt(match[1], 10);
    } catch {
      // Try JS config
    }

    const jsConfigPath = path.join(dirPath, 'vite.config.js');
    try {
      const viteConfig = await fs.promises.readFile(jsConfigPath, 'utf-8');
      const match = viteConfig.match(/port\s*:\s*(\d{2,5})/);
      if (match) return parseInt(match[1], 10);
    } catch {
      // No config found
    }

    return null; // Don't assume 5173
  }

  // Next.js (Next config rarely defines port — usually set via env or CLI)
  if (deps['next']) {
    // Try .env (fallback to your env parser)
    const envPort = await detectPortFromEnv(dirPath);
    if (envPort) return envPort;
    return null; // Don't assume 3000
  }

  // Create React App (react-scripts) — usually reads from PORT env
  if (deps['react-scripts']) {
    const envPort = await detectPortFromEnv(dirPath);
    if (envPort) return envPort;
    return null;
  }

  // Gatsby
  if (deps['gatsby']) {
    const gatsbyConfigPath = path.join(dirPath, 'gatsby-config.js');
    try {
      const config = await fs.promises.readFile(gatsbyConfigPath, 'utf-8');
      const match = config.match(/port\s*:\s*(\d{2,5})/);
      if (match) return parseInt(match[1], 10);
    } catch {
      // Config not found
    }

    const envPort = await detectPortFromEnv(dirPath);
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

  let pkg: Record<string, unknown>;
  try {
    const pkgContent = await fs.promises.readFile(pkgPath, 'utf-8');
    pkg = JSON.parse(pkgContent);
  } catch {
    return null;
  }

  const scripts = (pkg.scripts || {}) as Record<string, string>;

  // Try static methods first (in order of speed)
  const scriptsPort = detectPortFromScripts(scripts);
  if (scriptsPort) return scriptsPort;

  const envPort = await detectPortFromEnv(dirPath);
  if (envPort) return envPort;

  const frameworkPort = await detectPortFromFramework(dirPath, pkg);
  if (frameworkPort) return frameworkPort;

  // Fallback to sniffing if we have a runCommand
  if (runCommand) {
    return await detectPortByRunning(dirPath, runCommand);
  }

  return null;
};
