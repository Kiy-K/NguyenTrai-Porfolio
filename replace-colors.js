const fs = require('fs');
const path = require('path');

const replacements = {
  '#FAF7F2': '#F4EBD0',
  '#1A1A1A': '#2C1E16',
  '#D4AF37': '#B8860B',
  '#8C2121': '#8B3A3A',
  '#4A3F35': '#5C4033',
  '#E8DFCE': '#D4C4A8',
  '#2A1B18': '#3E2723',
  '#F0E6D2': '#E8D8B8'
};

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.next' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      if (dirPath.endsWith('.tsx') || dirPath.endsWith('.ts') || dirPath.endsWith('.css')) {
        callback(dirPath);
      }
    }
  });
}

walkDir('.', (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [oldColor, newColor] of Object.entries(replacements)) {
    if (content.includes(oldColor)) {
      content = content.split(oldColor).join(newColor);
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
});
