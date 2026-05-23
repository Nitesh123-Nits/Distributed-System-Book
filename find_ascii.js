const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        if (file === 'node_modules' || file === '_book' || file === 'scratch') return;
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.md')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(process.cwd());
files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let inCodeBlock = false;
    let blockLang = '';
    let blockLines = [];
    let startLine = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('```')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                blockLang = line.substring(3).trim().toLowerCase();
                blockLines = [];
                startLine = i + 1;
            } else {
                inCodeBlock = false;
                if (!['mermaid', 'java', 'python', 'json', 'yaml', 'yml', 'bash', 'sh', 'sql', 'go'].includes(blockLang)) {
                    // Check if blockLines looks like a diagram
                    const text = blockLines.join('\n');
                    if (text.includes('+---') || text.includes('--->') || text.includes('===>') || text.includes('<---') || text.match(/\|\s+/)) {
                        console.log(`Found ASCII diagram in ${file} (Line ${startLine})`);
                    }
                }
            }
        } else if (inCodeBlock) {
            blockLines.push(line);
        }
    }
});
