const fs = require('fs');
const content = fs.readFileSync('src/hooks/useSession.ts', 'utf8');
const idx = content.indexOf('minute: "2-digit"');
if (idx >= 0) {
    console.log(content.substring(idx, idx+300));
}