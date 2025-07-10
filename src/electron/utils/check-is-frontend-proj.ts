import fs from 'fs';
import path from 'path';

export const isFrontendProject = (projectPath: string): boolean => {
  const pkgPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(pkgPath)) return false;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const deps = {
    ...pkg.dependencies,
    ...pkg.devDependencies
  };

  const frontendLibs = [
    'react', 'react-dom', 'next', 'vite', 'vue', 'svelte', '@angular/core', 'preact', 'parcel-bundler'
  ];

  return frontendLibs.some((lib) => deps[lib]);
};