const fs = require('fs');
let html = fs.readFileSync('donor.html', 'utf8');

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

// Use regex to ignore whitespace differences
const regex = /<div class="fg">\s*<label style="display:flex;align-items:center;justify-content:space-between">\s*Food Name \*\s*<span id="food-type-pill" style="display:none"><\/span>\s*<\/label>\s*<input name="food_name" id="food-name-inp" placeholder="[^"]*" required oninput="onFoodNameInput\(this\.value\)" autocomplete="off">\s*<\/div>/;

if(regex.test(html)) {
    html = html.replace(regex, replacement);
    fs.writeFileSync('donor.html', html, 'utf8');
    console.log('Successfully replaced in donor.html');
} else {
    console.log('Regex did not match donor.html');
}
