const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// The unclosed block
const brokenCRLF = '@keyframes floatAvatar {\r\n  0%, 100% { transform: translateY(0); }\r\n.park-slot.selected';
const fixedCRLF = '@keyframes floatAvatar {\r\n  0%, 100% { transform: translateY(0); }\r\n  50% { transform: translateY(-8px); }\r\n}\r\n.park-slot.selected';

const brokenLF = '@keyframes floatAvatar {\n  0%, 100% { transform: translateY(0); }\n.park-slot.selected';
const fixedLF = '@keyframes floatAvatar {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(-8px); }\n}\n.park-slot.selected';

if (css.includes(brokenCRLF)) {
  css = css.replace(brokenCRLF, fixedCRLF);
} else if (css.includes(brokenLF)) {
  css = css.replace(brokenLF, fixedLF);
} else {
  console.log("Could not find broken pattern.");
}

fs.writeFileSync('src/index.css', css);
console.log("Fix applied!");
