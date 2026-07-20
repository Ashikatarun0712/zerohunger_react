const fs = require('fs');
const files = ['profile.html', 'activity.html', 'admin.html'];
const tileHTML = '\n        <div class="cert-metric"><div class="cert-metric-val" id="cert-wasted" style="color: #ef4444;">0</div><div class="cert-metric-lbl">Food Wasted 😢</div></div>';

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (!content.includes('id="cert-wasted"')) {
       content = content.replace(/(<div class="cert-metric"><div class="cert-metric-val" id="cert-meals">0<\/div><div class="cert-metric-lbl">Meals Saved<\/div><\/div>)/g, '$1' + tileHTML);
       fs.writeFileSync(f, content, 'utf8');
       console.log('Updated ' + f);
    } else {
       console.log('Already updated ' + f);
    }
  }
});
