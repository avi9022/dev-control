import fs from 'fs';
import path from 'path';

export const isFrontendProject = async (projectPath: string): Promise<boolean> => {
  const pkgPath = path.join(projectPath, 'package.json');

  try {
    const pkgContent = await fs.promises.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies
    };

    const frontendLibs = [
      'react', 'react-dom', 'next', 'vite', 'vue', 'svelte', '@angular/core', 'preact', 'parcel-bundler'
    ];

    return frontendLibs.some((lib) => deps[lib]);
  } catch {
    return false;
  }
};