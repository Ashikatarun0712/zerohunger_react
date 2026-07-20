const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

const regex = /const nfCheck=detectNonFood\(food_name\);\s*if\(nfCheck\.isNonFood\)\{toast\(\`🚫 "\$\{food_name\}" is not a food item! Only food donations are accepted.\`,'err',4000\);showNonFoodWarning\(food_name,nfCheck\.matched\);return;\}/;

const replacement = `
  const categorySel = byId('item-category-sel');
  const cat = categorySel ? categorySel.value : 'auto';
  
  if (cat === 'auto') {
      const nfCheck = detectNonFood(food_name);
      if(nfCheck.isNonFood){
          toast(\`🚫 "\${food_name}" is not a food item! Only food donations are accepted.\`,'err',4000);
          showNonFoodWarning(food_name,nfCheck.matched);
          return;
      }
  }
`;

code = code.replace(regex, replacement);

fs.writeFileSync('js/app.js', code, 'utf8');
console.log('Submit logic patched');
