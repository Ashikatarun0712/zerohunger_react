const fs = require('fs');
let code = fs.readFileSync('js/app.js', 'utf8');

// 1. Add 'material' to FOOD_DB
if (!code.includes('material:{keywords:[]')) {
    code = code.replace("warning:'🌿 Raw food — refrigerate when possible. Best distributed within 20 days.',color:'#065f46'}\n};", 
    "warning:'🌿 Raw food — refrigerate when possible. Best distributed within 20 days.',color:'#065f46'},\n  material:{keywords:[],days:3650,label:'Non-Food / Material',icon:'👕',cssClass:'material',\n    warning:'👕 Non-perishable material (Clothes, Books).',color:'#4b5563'}\n};");
}

// 2. Add pillColors for material in runExpiryPrediction
if (!code.includes("material:'#4b5563,#f3f4f6,#d1d5db'")) {
    code = code.replace("const pillColors={cooked:'#92400e,#fffbeb,#fcd34d',raw:'#065f46,#ecfdf5,#6ee7b7',packaged:'#1e3a5f,#eff6ff,#93c5fd'};",
    "const pillColors={cooked:'#92400e,#fffbeb,#fcd34d',raw:'#065f46,#ecfdf5,#6ee7b7',packaged:'#1e3a5f,#eff6ff,#93c5fd',material:'#4b5563,#f3f4f6,#d1d5db'};");
}

// 3. Update runExpiryPrediction to respect dropdown selection
const runExpRegex = /function runExpiryPrediction\(foodName\)\{[\s\S]*?const result=classifyFood\(foodName\);if\(\!result\)\{byId\('expiry-predict-box'\)\.innerHTML='';return;\}/;
const newRunExp = `window.onCategoryChange = function() {
  const inp = byId('food-name-inp');
  if(inp && inp.value.trim().length >= 2) {
      onFoodNameInput(inp.value);
  }
};

function runExpiryPrediction(foodName){
  const categorySel = byId('item-category-sel');
  const cat = categorySel ? categorySel.value : 'auto';
  
  let result = null;
  if (cat === 'auto') {
      const nfCheck=detectNonFood(foodName);
      if(nfCheck.isNonFood){
        showNonFoodWarning(foodName,nfCheck.matched);
        toast(\`⚠️ "\${foodName}" is not a food item! Please enter a valid food name.\`,'err',4000);
        return;
      }
      result = classifyFood(foodName);
  } else {
      // Manual Override
      const typeInfo = FOOD_DB[cat];
      if(typeInfo) {
          result = { type: cat, days: typeInfo.days, name: foodName.toLowerCase() };
      }
  }
  
  if(!result){byId('expiry-predict-box').innerHTML='';return;}`;
code = code.replace(runExpRegex, newRunExp);

// 4. Update the render text for text model vs Manual override
code = code.replace("🤖 Text Model", "${cat === 'auto' ? '🤖 AI Auto-Detect' : '👤 Manual Selection'}");
// But wait, cat is not defined in the lower scope if we just string replace. Let's fix that.
// I will just replace `🤖 Text Model` with `${cat === 'auto' ? '🤖 AI Auto-Detect' : '👤 Manual Override'}` 
// and `const typeInfo=FOOD_DB[result.type];` is right before.
code = code.replace("const typeInfo=FOOD_DB[result.type];", "const typeInfo=FOOD_DB[result.type];\n  const categorySel = byId('item-category-sel');\n  const cat = categorySel ? categorySel.value : 'auto';");

// 5. Chat optimization: Change 2500ms polling to 1000ms polling
code = code.replace("}, 2500);", "}, 1000);");

// Write back
fs.writeFileSync('js/app.js', code, 'utf8');
console.log('app.js successfully patched');
