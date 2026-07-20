const fs = require('fs');
let p = fs.readFileSync('profile.html', 'utf8');
p = p.replace('<div id="profile-page" class="page active">', '<div id="profile-page" class="page" style="display:none">');
p = p.replace('<div id="activity-page" class="page">', '<div id="activity-page" class="page active">');
fs.writeFileSync('activity.html', p, 'utf8');
console.log('activity.html created successfully.');
