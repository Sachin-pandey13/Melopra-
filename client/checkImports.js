const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('./src');
let hasError = false;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  // Match relative imports
  const regex = /import\s+.*?from\s+['"](\.\.?\/[^'"]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const importPath = match[1];
    let resolvedBase = path.resolve(path.dirname(file), importPath);
    const dirName = path.dirname(resolvedBase);
    if (!fs.existsSync(dirName)) {
       console.log("Error Dir:", importPath, "in", file);
       hasError = true;
       continue;
    }
    const actualFiles = fs.readdirSync(dirName);
    const baseName = path.basename(resolvedBase);
    let found = false;
    const candidates = [baseName, baseName + '.js', baseName + '.jsx', baseName + '.ts', baseName + '.tsx', baseName + '.css', baseName + '.scss'];
    
    for (let cand of candidates) {
       if (actualFiles.includes(cand)) { found = true; break; }
    }
    
    if (!found) {
      if (actualFiles.includes(baseName)) {
        const stats = fs.statSync(resolvedBase);
        if (stats.isDirectory()) {
            const indexFiles = fs.readdirSync(resolvedBase);
            if (indexFiles.includes('index.js') || indexFiles.includes('index.jsx')) {
                found = true;
            }
        }
      }
    }
    
    if (!found) {
       console.log("CASE SENSITIVITY ISSUE:", importPath, "in", file);
       hasError = true;
    }
  }
});
if (!hasError) console.log("CLEAN NO ISSUES");
