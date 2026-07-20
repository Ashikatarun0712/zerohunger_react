const fs = require('fs');
let html = fs.readFileSync('donor.html', 'utf8');

// The multi_replace messed it up, so I will restore from git first:
const execSync = require('child_process').execSync;
execSync('git checkout donor.html');

html = fs.readFileSync('donor.html', 'utf8');

// Add boxicons
if (!html.includes('boxicons.min.css')) {
    html = html.replace('</head>', `<link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>\n</head>`);
}

// Remove Action from table
if (html.includes('<th>Status</th><th>Action</th></tr>')) {
    html = html.replace('<th>Status</th><th>Action</th></tr>', '<th>Status</th></tr>');
}

// Replace Food Name with Item Name and add Category
const target = `            <div class="fg">
              <label style="display:flex;align-items:center;justify-content:space-between">
                Food Name *
                <span id="food-type-pill" style="display:none"></span>
              </label>
              <input name="food_name" id="food-name-inp" placeholder="e.g. Rice, Sambar, Idli, Carrot…" required oninput="onFoodNameInput(this.value)" autocomplete="off">
            </div>`;
const replacement = `            <div class="fg">
              <label>Item Category *</label>
              <select name="item_category" id="item-category-sel" onchange="onCategoryChange()">
                <option value="auto">🤖 Auto-Detect (AI)</option>
                <option value="cooked">🍚 Cooked Food (Expires Fast)</option>
                <option value="raw">🥕 Raw Food / Veggies</option>
                <option value="packaged">📦 Packaged / Preserved Food</option>
                <option value="material">👕 Non-Food / Material (Clothes, Books, etc.)</option>
              </select>
            </div>
            <div class="fg">
              <label style="display:flex;align-items:center;justify-content:space-between">
                Item Name *
                <span id="food-type-pill" style="display:none"></span>
              </label>
              <input name="food_name" id="food-name-inp" placeholder="e.g. Rice, Clothes, Books, Carrot…" required oninput="onFoodNameInput(this.value)" autocomplete="off">
            </div>`;

html = html.replace(target, replacement);

fs.writeFileSync('donor.html', html, 'utf8');
console.log('donor.html fixed');
