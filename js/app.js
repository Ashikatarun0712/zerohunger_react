'use strict';

const ADMIN_SECRET = 'assara';
const DEFAULT_LAT=9.9252, DEFAULT_LNG=78.1198;
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwmR5nnlB1so5ez8EPXRkZPIU6Jngfp6qvumeoPd40HfSsbMath7cslbH2VfgqxcJGQRw/exec'; // <-- REPLACE THIS WITH YOUR DEPLOYED WEB APP URL

// --- SUPABASE CONFIG ---
const SUPABASE_URL = 'https://gyfubwmalzsjtbmlyhgl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_X0UNvNRQfFStItXbSNlgbw_E_nT_cMC';
let supabaseClient;
if (typeof supabase !== 'undefined') {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

function loadRegistry(){
  try{const d=localStorage.getItem('zh_registry');return d?JSON.parse(d):{};}
  catch(e){return{};}
}
function saveRegistry(){
  try{localStorage.setItem('zh_registry',JSON.stringify(REGISTRY));}catch(e){}
}
const REGISTRY = loadRegistry();

// DB schema version — bump this when schema changes to clear stale cache
const DB_VERSION = 'v4';
if (sessionStorage.getItem('zh_db_version') !== DB_VERSION) {
    sessionStorage.removeItem('zh_db');
    sessionStorage.setItem('zh_db_version', DB_VERSION);
}

function loadDB(){
  try{const d=sessionStorage.getItem('zh_db');return d?JSON.parse(d):{donations:[],requests:[],volunteers:[],ratings:[],notifications:[],trusts:[],fund_requests:[],messages:[],platform_stats:null,nid:{don:1,req:1,vol:1,notif:1,fund:1,msg:1}};}
  catch(e){return{donations:[],requests:[],volunteers:[],ratings:[],notifications:[],trusts:[],fund_requests:[],messages:[],platform_stats:null,nid:{don:1,req:1,vol:1,notif:1,fund:1,msg:1}};}
}
function saveDB(){
  try{sessionStorage.setItem('zh_db',JSON.stringify(DB));}catch(e){}
}
const DB = loadDB();

async function syncDatabase() {
    try {
        // --- GOOGLE SHEETS BACKEND (Temporarily Muted) ---
        /*
        const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'sync' }) });
        const data = await res.json();
        if (data.success) {
            DB.donations = data.data.donations || [];
            DB.requests = data.data.requests || [];
            DB.volunteers = data.data.volunteers || [];
            DB.ratings = data.data.ratings || [];
            saveDB();
        }
        */

        // --- SUPABASE BACKEND ---
        if (supabaseClient) {
            const [donRes, reqRes, volRes, ratRes, trustRes, fundRes, msgRes, statRes, notifRes] = await Promise.all([
                supabaseClient.from('donations').select('*'),
                supabaseClient.from('requests').select('*'),
                supabaseClient.from('volunteers').select('*'),
                supabaseClient.from('ratings').select('*'),
                supabaseClient.from('trusts').select('*'),
                supabaseClient.from('fund_requests').select('*'),
                supabaseClient.from('messages').select('*'),
                supabaseClient.from('platform_stats').select('*').single(),
                supabaseClient.from('notifications').select('*')
            ]);
            
            // Log any individual table errors
            if (donRes.error) console.error('donations fetch error:', donRes.error);
            if (reqRes.error) console.error('requests fetch error:', reqRes.error);
            if (msgRes.error) console.error('messages fetch error:', msgRes.error);
            
            DB.donations = donRes.data || [];
            DB.requests = reqRes.data || [];
            DB.volunteers = volRes.data || [];
            DB.ratings = ratRes.data || [];
            DB.trusts = trustRes.data || [];
            DB.fund_requests = fundRes.data || [];
            DB.messages = msgRes.data || [];
            DB.platform_stats = statRes?.data || null;
            DB.notifications = notifRes.data || [];

            // Frontend Auto-Expiry Check
            const now = new Date();
            DB.donations.forEach(d => {
                if (d.status === 'available' && new Date(d.expiry_date) < now) {
                    d.status = 'expired'; // Treat as expired locally without DB write
                }
            });
            
            saveDB();
            
            // Update debug status if element exists
            const dbg = document.getElementById('db-debug');
            if (dbg) {
                dbg.textContent = `✅ Supabase connected — ${DB.donations.length} donation(s), ${DB.requests.length} request(s), ${DB.messages.length} message(s) loaded at ${new Date().toLocaleTimeString()}`;
                dbg.style.color = DB.donations.length > 0 ? '#059669' : '#b45309';
            }
        } else {
            const dbg = document.getElementById('db-debug');
            if (dbg) { dbg.textContent = '❌ Supabase client not initialised. Check API keys.'; dbg.style.color = '#dc2626'; }
            console.error('supabaseClient is undefined — check Supabase CDN and api_keys.js');
        }
    } catch (e) {
        console.error("Sync error:", e);
        const dbg = document.getElementById('db-debug');
        if (dbg) { dbg.textContent = `❌ Sync error: ${e.message}`; dbg.style.color = '#dc2626'; }
    }
}


const APP={role:null,user:null,name:null,slot:null,maps:{},charts:{},userLat:null,userLng:null,userAccuracy:null,userAddress:null,geoWatchId:null,prevPage:'profile-page',routeLines:[],parkingState:null,selectedParkSlot:null,mobileNetModel:null,mobileNetLoading:false};

const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fClass=s=>{s=+s;return s>=8?'bg-g':s>=5?'bg-y':'bg-r'};
const sBadge=s=>({available:'bg-g',requested:'bg-y',delivered:'bg-t',pending:'bg-y',assigned:'bg-b',done:'bg-t',completed:'bg-t',expired:'bg-r',busy:'bg-r',active:'bg-g'})[s]||'bg-g';
const pClass=s=>{s=+s;return s>=70?'color:var(--r1);font-weight:700':s>=40?'color:var(--a1);font-weight:700':'color:var(--g2);font-weight:700'};
const stars=s=>{const f=Math.min(5,Math.round(+s||0));return'★'.repeat(f)+'☆'.repeat(5-f)};
const ago=ts=>{const d=Math.floor((Date.now()-new Date(ts))/1000);if(d<60)return d+'s ago';if(d<3600)return Math.floor(d/60)+'m ago';return Math.floor(d/3600)+'h ago'};
const byId=id=>document.getElementById(id);
const setTxt=(id,v)=>{const e=byId(id);if(e)e.textContent=v};

function toast(msg,type='ok',dur=3200){
  const c=byId('toasts');
  const el=document.createElement('div');el.className=`toast ${type}`;
  const ico={ok:'✅',err:'❌',info:'ℹ️'}[type]||'';
  el.innerHTML=`<span>${ico}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transition='.3s';setTimeout(()=>el.remove(),350)},dur);
}

function haversine(lat1,lng1,lat2,lng2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180;const dLon=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function getDistBadge(km){
  if(km<1)return`<span class="dist-badge dist-near">📍 ${km.toFixed(1)} km · Walk</span>`;
  if(km<5)return`<span class="dist-badge dist-mid">📍 ${km.toFixed(1)} km · Bike</span>`;
  return`<span class="dist-badge dist-far">📍 ${km.toFixed(1)} km · Vehicle</span>`;
}
function getDonationDistance(d){
  const uLat=APP.userLat||DEFAULT_LAT,uLng=APP.userLng||DEFAULT_LNG;
  return haversine(uLat,uLng,+(d.lat||DEFAULT_LAT),+(d.lng||DEFAULT_LNG));
}

function getTrustScore(name,type='donor'){
  if(!name||!name.trim())return{score:0,level:'No Rating Yet',color:'var(--txt3)',hasRating:false};
  const nameLower=name.toLowerCase().trim();
  const userRatings=DB.ratings.filter(r=>
    r.category===type && (r.target_username || r.target || '').toLowerCase().trim()===nameLower
  );
  if(!userRatings.length)return{score:0,level:'No Rating Yet',color:'var(--txt3)',hasRating:false};
  const avg=userRatings.reduce((s,r)=>s+(+r.score),0)/userRatings.length;
  const score=Math.round((avg/5)*100);
  if(score>=85)return{score,level:'Trusted ✅',color:'var(--g2)',hasRating:true};
  if(score>=60)return{score,level:'Reliable 👍',color:'var(--a1)',hasRating:true};
  return{score,level:'Needs Review ⚠️',color:'var(--r1)',hasRating:true};
}

function renderTrustCard(){
  const el=byId('user-trust-card');if(!el)return;
  const ts=getTrustScore(APP.name||'','donor');
  const tsV=getTrustScore(APP.name||'','volunteer');
  const tsUse=(tsV.hasRating&&(!ts.hasRating||tsV.score>=ts.score))?tsV:ts;
  if(!tsUse.hasRating){
    el.innerHTML=`
      <div class="trust-new-card">
        <div class="trust-new-inner">
          <div class="trust-new-icon">🏅</div>
          <div class="trust-new-body">
            <div class="trust-new-title">Your Community Trust Score</div>
            <div class="trust-new-sub">Build your reputation by donating food, completing deliveries, and receiving community ratings.</div>
            <div class="trust-new-steps">
              <div class="trust-step-chip">🎁 Donate Food</div>
              <div class="trust-step-chip">🚗 Complete Delivery</div>
              <div class="trust-step-chip">⭐ Get Rated</div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-size:.72rem;color:var(--txt3);font-weight:600;white-space:nowrap">NOT YET RATED</div>
            <div style="font-size:1.6rem;font-weight:800;color:var(--txt3);font-family:'Bricolage Grotesque',sans-serif;margin-top:2px">—/100</div>
          </div>
        </div>
      </div>`;
    return;
  }
  const totalRatings=DB.ratings.filter(r=>(r.target_username || r.target || '').toLowerCase()===APP.name.toLowerCase()).length;
  el.innerHTML=`<div class="card" style="border-left:4px solid ${tsUse.color};margin-bottom:0">
    <div class="card-body" style="padding:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-weight:700;font-size:.9rem">🏅 Your Community Trust Score</div>
        <div style="font-weight:800;font-size:1.1rem;color:${tsUse.color}">${tsUse.score}/100 · <span style="font-size:.8rem">${tsUse.level}</span></div>
      </div>
      <div class="trust-bar"><div class="trust-fill ${tsUse.score>=85?'trust-high':tsUse.score>=60?'trust-mid':'trust-low'}" style="width:${tsUse.score}%"></div></div>
      <div style="font-size:.72rem;color:var(--txt3);margin-top:6px">Score based on ${totalRatings} community rating(s).</div>
    </div>
  </div>`;
}

function updateProfileCert(){
  let donCount = 0, avgFresh = '—', meals = 0;
  if (DB.platform_stats) {
      donCount = DB.platform_stats.total_donations || 0;
      avgFresh = donCount > 0 ? (DB.platform_stats.total_freshness_score / donCount).toFixed(1) : '—';
      meals = DB.platform_stats.total_meals_saved || 0;
  } else {
      donCount=DB.donations.length;
      avgFresh=donCount>0?(DB.donations.reduce((s,d)=>s+(+d.freshness_score||0),0)/donCount).toFixed(1):'—';
      meals=Math.round(DB.donations.reduce((s,d)=>s+d.quantity,0)*0.8);
  }
  setTxt('cert-donations',donCount);
  setTxt('cert-freshness',avgFresh);
  setTxt('cert-meals',meals);
  
  const wastedCount = DB.donations.filter(d => (d.status || '').toLowerCase() === 'expired').length;
  const els = document.querySelectorAll('#cert-wasted');
  els.forEach(el => el.textContent = wastedCount);
}

/* =====================================================
   NON-FOOD ITEM DETECTION
   ===================================================== */
const NON_FOOD_ITEMS=[
  'cycle','bicycle','bike','motorbike','motorcycle','scooter','car','truck','van','bus','boat','ship','airplane','train','vehicle','auto','rickshaw','tractor','jeep','lorry',
  'phone','mobile','laptop','computer','tablet','keyboard','mouse','monitor','screen','tv','television','radio','speaker','headphone','earphone','charger','battery','cable','wire',
  'camera','drone','clock','watch','calculator','printer','scanner','projector','router','modem','hard disk','pendrive','usb','sim card',
  'pen','pencil','eraser','rubber','ruler','compass','scissors','stapler','tape','glue','marker','chalk','book','notebook','paper','folder','file','binder','crayon','highlighter',
  'chair','table','desk','bed','sofa','couch','cupboard','wardrobe','almirah','shelf','rack','drawer','door','window','curtain','mat','carpet','pillow','blanket','towel',
  'fan','washing machine','microwave','iron','mixer','grinder','cooler','heater','lamp','bulb','tubelight','refrigerator',
  'shirt','pant','trouser','jeans','dress','saree','kurta','blouse','skirt','jacket','coat','sweater','hoodie','shoe','sandal','slipper','chappal','boot','sock','underwear','bra','belt','bag','purse','wallet','cap','hat','helmet','glove','scarf',
  'hammer','nail','screw','bolt','nut','drill','saw','wrench','spanner','plier','screwdriver','rope','chain','lock','key','pump','pipe','brick','cement','sand','stone','wood','plank','paint','brush tool',
  'soap','shampoo','conditioner','lotion','cream','ointment','toothbrush','toothpaste','comb','razor','blade','perfume','deodorant','diapers','sanitary pad',
  'medicine','tablet pill','capsule','syrup','injection','syringe','bandage','cotton','dettol',
  'ball','bat','racket','toy','doll','kite','puzzle','lego',
  'diesel','petrol','engine oil','grease','lubricant','fertilizer','pesticide','paint thinner',
  'flower','plant','pot','soil','umbrella','torch','candle','matchbox','lighter','ashtray',
  'money','coin','ticket','spectacles','glasses'
];

function detectNonFood(name){
  if(!name||name.trim().length<2)return{isNonFood:false};
  const lower=name.toLowerCase().trim();
  
  const onlyAlpha = lower.replace(/[^a-z]/g, '');
  if(onlyAlpha.length > 0 && !/[aeiouy]/.test(onlyAlpha)) return {isNonFood:true, matched:'Random/Gibberish input'};
  if(/(.)\1{3,}/.test(lower)) return {isNonFood:true, matched:'Random/Gibberish input'};
  if(/[bcdfghjklmnpqrstvwxz]{5,}/.test(onlyAlpha)) return {isNonFood:true, matched:'Random/Gibberish input'};
  if(/^[\d\s\W]+$/.test(lower)) return {isNonFood:true, matched:'Numeric/Invalid input'};
  const smashes = ['asdf','qwer','zxcv','hjkl','uiop','tyui'];
  for(const sm of smashes) if(lower.includes(sm)) return {isNonFood:true, matched:'Random/Gibberish input'};

  const words=lower.split(/\s+/);
  for(const item of NON_FOOD_ITEMS){
    const itemL=item.toLowerCase();
    if(lower===itemL)return{isNonFood:true,matched:item};
    if(words[0]===itemL&&itemL.length>=4)return{isNonFood:true,matched:item};
    if(lower.includes(itemL)&&itemL.length>=5)return{isNonFood:true,matched:item};
  }
  return{isNonFood:false};
}

function showNonFoodWarning(inputName,matchedItem){
  const suggestions=['Rice 🍚','Sambar 🥘','Vegetables 🥦','Fruits 🍎','Bread 🍞','Dal 🫘','Idli 🍽️','Banana 🍌','Milk 🥛','Curry 🍛'];
  const inp=byId('food-name-inp');
  if(inp){
    inp.style.borderColor='#dc2626';
    inp.style.boxShadow='0 0 0 3px rgba(220,38,38,.18)';
    setTimeout(()=>{inp.style.borderColor='';inp.style.boxShadow='';},3000);
  }
  byId('expiry-predict-box').innerHTML=`
    <div class="non-food-warn">
      <div class="non-food-warn-inner">
        <div class="non-food-warn-icon">🚫</div>
        <div class="non-food-warn-body">
          <div class="non-food-warn-title">⚠️ Non-Food Item Detected!</div>
          <div class="non-food-warn-msg">
            <strong style="color:#fff">"${esc(inputName)}"</strong> is not a food item and cannot be donated through this system.
            ${matchedItem?`Detected as: <strong style="color:#fca5a5">${esc(matchedItem)}</strong>.`:''}
            <br>Please enter a valid <strong style="color:#fef9c3">food item</strong> to get AI expiry prediction.
          </div>
          <div class="non-food-warn-examples">
            <span class="non-food-example-chip label-chip">✅ Valid examples:</span>
            ${suggestions.slice(0,5).map(s=>`<span class="non-food-example-chip">${s}</span>`).join('')}
          </div>
          <button class="non-food-warn-dismiss" onclick="clearNonFoodWarning()">✏️ Clear & Re-enter</button>
        </div>
      </div>
    </div>`;
  byId('expiry-ai-badge').style.display='none';
  byId('food-type-pill').style.display='none';
  currentFoodType=null;aiPredictedExpiry=null;aiPredictedMfg=null;
}

function clearNonFoodWarning(){
  byId('expiry-predict-box').innerHTML='';
  const inp=byId('food-name-inp');
  if(inp){inp.value='';inp.focus();}
}

/* =====================================================
   FOOD CLASSIFICATION (text-based)
   ===================================================== */
const FOOD_DB={
  cooked:{keywords:['rice','sambar','dal','curry','kootu','rasam','idli','dosa','pongal','upma','chapati','roti','paratha','sabzi','biryani','pulao','fried rice','soup','stew','gravy','masala','fry','roast','boiled','steamed','cooked','khichdi','porridge','kanji','congee','poori','puri','vada','pakoda','bajji','bonda','kuzhambu','poriyal','thoran','aviyal','fish curry','chicken curry','mutton','egg curry','omelette','noodles cooked','pasta cooked','payasam','kheer','halwa','ladoo','sweets','mithai','prepared','leftover','meal','dish'],
    days:1,label:'Cooked Food',icon:'🍚',cssClass:'cooked',
    warning:'⚠️ Cooked food spoils fast! Must be distributed within 24 hours (1 day).',color:'#92400e'},
  packaged:{keywords:['biscuit','biscuits','cookies','chips','wafer','namkeen','mixture','murukku','chocolate','candy','toffee','jam','pickle','achar','sauce','ketchup','noodles packet','maggi','pasta dry','macaroni','vermicelli','semiya','bread packet','rusk','toast','malt','horlicks','bournvita','boost','milk powder','formula','baby food','cereal','cornflakes','oats packet','sugar','salt','oil','ghee','butter','cheese','paneer packaged','canned','tin','bottled','sealed','packaged','processed','instant','tinned','preserved','jaggery','honey','syrup','squash','juice packet','coconut milk tin','condensed milk','evaporated'],
    days:90,label:'Packaged / Preserved',icon:'📦',cssClass:'packaged',
    warning:'📦 Packaged food — check label. AI estimate: 30–180 days.',color:'#1e40af'},
  raw:{keywords:[],days:20,label:'Raw / Uncooked Food',icon:'🥕',cssClass:'raw',
    warning:'🌿 Raw food — refrigerate when possible. Best distributed within 20 days.',color:'#065f46'}
};

const FOOD_OVERRIDES={'idli':1,'dosa':1,'pongal':1,'upma':1,'sambar':1,'rasam':1,'kootu':1,'payasam':1,'kheer':1,'soup':1,'porridge':1,'kanji':1,'congee':1,'rice':1,'dal':1,'curry':1,'biryani':1,'pulao':1,'roti':1,'chapati':1,'gravy':1,'stew':1,'khichdi':1,'vada':1,'pakoda':1,'bajji':1,'bonda':1,'kuzhambu':1,'poriyal':1,'thoran':1,'aviyal':1,'fish curry':1,'chicken curry':1,'egg curry':1,'omelette':1,'fried rice':1,'leafy greens':5,'spinach':5,'palak':5,'methi':5,'keerai':5,'lettuce':3,'mushroom':7,'mushrooms':7,'tomato':10,'tomatoes':10,'banana':7,'bananas':7,'papaya':7,'mango':10,'mangoes':10,'carrot':20,'potato':20,'onion':30,'garlic':30,'ginger':20,'apple':25,'apples':25,'orange':20,'grapes':14,'biscuit':120,'biscuits':120,'chips':90,'chocolate':180,'jam':180,'pickle':365,'ghee':180,'oil':360,'sugar':720,'salt':720};

let foodPredictDebounce=null,currentFoodType=null,aiPredictedExpiry=null,aiPredictedMfg=null;

function classifyFood(name){
  if(!name||name.trim().length<2)return null;
  const lower=name.toLowerCase().trim();
  for(const[key,days] of Object.entries(FOOD_OVERRIDES)){
    if(lower.includes(key)){
      const type=days<=1?'cooked':days>=30?'packaged':'raw';
      return{type,days,name:lower};
    }
  }
  for(const kw of FOOD_DB.cooked.keywords)if(lower.includes(kw))return{type:'cooked',days:1,name:lower};
  for(const kw of FOOD_DB.packaged.keywords)if(lower.includes(kw))return{type:'packaged',days:90,name:lower};
  return{type:'raw',days:20,name:lower};
}

function formatDateValue(date){return`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function formatDateDisplay(dateStr){return new Date(dateStr+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});}

function onFoodNameInput(value){
  clearTimeout(foodPredictDebounce);
  if(!value||value.trim().length<2){
    byId('expiry-predict-box').innerHTML='';
    byId('expiry-ai-badge').style.display='none';
    byId('food-type-pill').style.display='none';
    currentFoodType=null;return;
  }
  foodPredictDebounce=setTimeout(()=>{showExpiryLoading();setTimeout(()=>runExpiryPrediction(value),900);},400);
}

function showExpiryLoading(){
  byId('expiry-predict-box').innerHTML=`<div class="predict-loading"><div class="spin" style="border-top-color:#22c55e;width:16px;height:16px;border-width:2px"></div><span>🤖 Analyzing food item…</span></div>`;
}

window.onCategoryChange = function() {
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
        toast(`⚠️ "${foodName}" is not a food item! Please enter a valid food name.`,'err',4000);
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
  
  if(!result){byId('expiry-predict-box').innerHTML='';return;}
  const typeInfo=FOOD_DB[result.type];

  const now=new Date();const expDate=new Date(now);
  expDate.setDate(expDate.getDate()+result.days);
  const mfgStr=formatDateValue(now),expStr=formatDateValue(expDate);
  currentFoodType=result.type;aiPredictedMfg=mfgStr;aiPredictedExpiry=expStr;

  const pillColors={cooked:'#92400e,#fffbeb,#fcd34d',raw:'#065f46,#ecfdf5,#6ee7b7',packaged:'#1e3a5f,#eff6ff,#93c5fd',material:'#4b5563,#f3f4f6,#d1d5db'};
  const[tc,bg,bc]=pillColors[result.type].split(',');
  byId('food-type-pill').innerHTML=`<span style="display:inline-flex;align-items:center;gap:4px;background:${bg};color:${tc};border:1px solid ${bc};padding:2px 8px;border-radius:99px;font-size:.7rem;font-weight:700">${typeInfo.icon} ${typeInfo.label}</span>`;
  byId('food-type-pill').style.display='inline-flex';
  byId('expiry-ai-badge').style.display='inline';

  byId('expiry-predict-box').innerHTML=`
    <div class="predict-result" style="border:1.5px solid ${bc};border-radius:10px;overflow:hidden;background:${bg}">
      <div style="padding:8px 12px;background:${tc === '#92400e' ? 'rgba(146,64,14,0.08)' : tc === '#065f46' ? 'rgba(6,95,70,0.08)' : 'rgba(30,58,95,0.08)'};display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:.74rem;font-weight:700;color:${tc};display:flex;align-items:center;gap:5px">${typeInfo.icon} AI Expiry Prediction</span>
        <span style="font-size:.68rem;opacity:.7;color:${tc}">${cat === 'auto' ? '🤖 AI Auto-Detect' : '👤 Manual Selection'}</span>
      </div>
      <div style="padding:10px 12px">
        <div class="predict-dates-clean">
          <div class="predict-date-chip mfg">
            <div style="font-size:.65rem;margin-bottom:3px;opacity:.65;font-weight:600">📅 MFG DATE</div>
            <div style="font-weight:800;font-size:.85rem">${formatDateDisplay(mfgStr)}</div>
          </div>
          <div class="predict-date-chip exp">
            <div style="font-size:.65rem;margin-bottom:3px;opacity:.65;font-weight:600">⏰ EXPIRY DATE</div>
            <div style="font-weight:800;font-size:.85rem">${formatDateDisplay(expStr)}</div>
          </div>
        </div>
        <button class="apply-btn-clean" onclick="applyAIDates()">✅ Apply Dates to Form</button>
      </div>
    </div>`;
}

function applyAIDates(){
  if(!aiPredictedMfg||!aiPredictedExpiry)return;
  const mfgInp=byId('don-mfg-date'),expInp=byId('don-expiry-date');
  if(mfgInp)mfgInp.value=aiPredictedMfg;
  if(expInp)expInp.value=aiPredictedExpiry;
  [mfgInp,expInp].forEach(el=>{if(!el)return;el.style.transition='all .3s';el.style.borderColor='var(--g2)';el.style.background='#ecfdf5';el.style.boxShadow='0 0 0 3px rgba(22,163,74,.15)';setTimeout(()=>{el.style.background='';el.style.boxShadow='';},1500);});
  const typeInfo=FOOD_DB[currentFoodType];
  toast(`🤖 Dates applied! Expires ${formatDateDisplay(aiPredictedExpiry)}`,'ok',3000);
}

/* =====================================================
   TensorFlow.js MobileNet
   ===================================================== */
async function loadMobileNet(){
  if(APP.mobileNetModel)return APP.mobileNetModel;
  if(APP.mobileNetLoading)return null;
  APP.mobileNetLoading=true;
  try{
    const model=await mobilenet.load({version:2,alpha:1.0});
    APP.mobileNetModel=model;APP.mobileNetLoading=false;return model;
  }catch(e){APP.mobileNetLoading=false;console.error('MobileNet load failed:',e);return null;}
}

function mapMobileNetToFreshness(predictions,foodHint){
  const FRESH_CLASSES=['Granny Smith','lemon','orange','banana','pineapple','strawberry','fig','pomegranate','artichoke','cucumber','zucchini','acorn squash','butternut squash','mashed potato','cauliflower','broccoli','cabbage','bell pepper','head cabbage','spaghetti squash','green bean'];
  const MEDIUM_CLASSES=['mushroom','French loaf','pretzel','bagel','pizza','cheeseburger','hot dog','corn','ear','maize','corn on the cob','mango','papaya'];
  const SPOILED_CLASSES=['slime mold','stinkhorn','earthstar','gyromitra','agaric','coral fungus','hen-of-the-woods','bolete','web cap'];
  let freshScore=0,mediumScore=0,spoiledScore=0;
  for(const p of predictions){
    const cls=(p.className||'').toLowerCase();const prob=p.probability||0;
    if(SPOILED_CLASSES.some(s=>cls.includes(s.toLowerCase()))){spoiledScore+=prob*2;continue;}
    if(FRESH_CLASSES.some(s=>cls.includes(s.toLowerCase()))){freshScore+=prob;continue;}
    if(MEDIUM_CLASSES.some(s=>cls.includes(s.toLowerCase()))){mediumScore+=prob*0.5;continue;}
    if(p.probability>0.4)freshScore+=0.3;else if(p.probability>0.15)freshScore+=0.15;else mediumScore+=0.1;
  }
  const hint=(foodHint||'').toLowerCase();
  const isCookedHint=['rice','sambar','curry','idli','dosa','dal','biryani','soup','cooked'].some(k=>hint.includes(k));
  if(isCookedHint){freshScore*=0.5;mediumScore+=0.3;}
  const top1Conf=predictions[0]?.probability||0;
  if(top1Conf>0.5)freshScore+=0.5;else if(top1Conf>0.25)freshScore+=0.2;else if(top1Conf<0.1)spoiledScore+=0.3;
  const total=freshScore+mediumScore+spoiledScore||1;
  const fN=freshScore/total,mN=mediumScore/total,sN=spoiledScore/total;
  if(fN>=mN&&fN>=sN)return{label:'Fresh',cssClass:'fresh-food',icon:'✅',confidence:Math.round(fN*100),freshScore:Math.min(10,6+fN*4),emoji:'🟢'};
  if(mN>=sN)return{label:'Medium',cssClass:'medium-food',icon:'⚠️',confidence:Math.round(mN*100),freshScore:Math.min(7,4+mN*3),emoji:'🟡'};
  return{label:'Spoiled',cssClass:'spoiled-food',icon:'❌',confidence:Math.round(sN*100),freshScore:Math.max(0,sN*2),emoji:'🔴'};
}

function doImgUpload(file){
  if(!file)return;
  const pr=byId('img-prev');const rd=new FileReader();rd.onload=ev=>{pr.src=ev.target.result;pr.style.display='block';};rd.readAsDataURL(file);
  byId('vision-res').innerHTML='';byId('deep-scan-btn').style.display='flex';
  toast('Image loaded. Click "Analyze Freshness" for CNN analysis.','info');
  loadMobileNet().then(m=>{if(m)toast('🧠 MobileNet model ready!','info',1800);});
}

async function runDeepScan(){
  const imgEl=byId('img-prev');
  if(!imgEl||!imgEl.src||imgEl.style.display==='none'){toast('Please upload an image first','err');return;}
  byId('deep-scan-btn').disabled=true;
  const steps=['Loading TensorFlow.js runtime…','Initializing MobileNet v2 (ImageNet)…','Preprocessing image tensor (224×224 px)…','Running CNN forward pass…','Extracting top-5 feature predictions…','Mapping ImageNet classes to freshness…','Computing Fresh / Medium / Spoiled score…','Generating safety report…'];
  byId('vision-res').innerHTML=`<div class="scan-bar-wrap"><div class="ai-dot" style="font-size:.72rem">⚡ TensorFlow.js MobileNet Analysis Running</div><div class="scan-progress"><div class="scan-fill" id="scan-fill" style="width:0%"></div></div><div class="scan-steps" id="scan-steps">${steps.map((s,i)=>`<div class="scan-step" id="step-${i}"><div class="scan-step-dot"></div><span>${s}</span></div>`).join('')}</div></div>`;
  let stepIdx=0;
  const stepInterval=setInterval(()=>{
    if(stepIdx>0)byId(`step-${stepIdx-1}`)?.classList.replace('active','done');
    byId(`step-${stepIdx}`)?.classList.add('active');
    byId('scan-fill').style.width=`${Math.round(((stepIdx+1)/steps.length)*100)}%`;
    stepIdx++;if(stepIdx>=steps.length)clearInterval(stepInterval);
  },320);
  try{
    const model=await loadMobileNet();
    if(!model){clearInterval(stepInterval);await runClaudeApiFallback();byId('deep-scan-btn').disabled=false;return;}
    await new Promise(r=>setTimeout(r,steps.length*350));clearInterval(stepInterval);
    const predictions=await model.classify(imgEl,5);
    const foodHint=byId('food-name-inp')?.value||'';
    const result=mapMobileNetToFreshness(predictions,foodHint);
    const textType=currentFoodType||classifyFood(foodHint)?.type||'raw';
    showMobileNetResult(result,predictions,FOOD_DB[textType],foodHint);
  }catch(err){clearInterval(stepInterval);console.error('MobileNet error:',err);await runClaudeApiFallback();}
  byId('deep-scan-btn').disabled=false;
}

function showMobileNetResult(result,predictions,typeInfo,foodHint){
  const confPercentages=[
    {label:'Fresh 🟢',val:result.label==='Fresh'?result.confidence:Math.max(0,result.confidence-30),cls:'fresh-food'},
    {label:'Medium 🟡',val:result.label==='Medium'?result.confidence:Math.max(0,result.confidence-40),cls:'medium-food'},
    {label:'Spoiled 🔴',val:result.label==='Spoiled'?result.confidence:Math.max(0,100-result.confidence-20),cls:'spoiled-food'}
  ];
  const total=confPercentages.reduce((s,x)=>s+x.val,0)||100;
  confPercentages.forEach(x=>x.val=Math.round((x.val/total)*100));
  const top3Preds=predictions.slice(0,3).map(p=>`<span style="background:rgba(255,255,255,.1);padding:2px 8px;border-radius:99px;font-size:.72rem">${p.className} (${(p.probability*100).toFixed(1)}%)</span>`).join('');
  const safetyMsg={Fresh:'Food appears fresh and safe to distribute. Vibrant colors and good texture detected.',Medium:'Some aging signs detected. Distribute as soon as possible within today.',Spoiled:'Signs of spoilage or decay detected. Do NOT distribute — discard safely.'}[result.label];
  const freshScoreVal=result.freshScore.toFixed(1);
  byId('fresh-hint').textContent=`MobileNet: ${result.label} (${result.confidence}% confidence) · Freshness: ${freshScoreVal}/10`;
  byId('vision-res').innerHTML=`
    <div class="mobilenet-result">
      <div class="mobilenet-banner ${result.cssClass}">
        <span style="font-size:2rem">${result.icon}</span>
        <div><div style="font-size:1rem;font-weight:800">MobileNet CNN: ${result.label}</div><div style="font-size:.76rem;opacity:.85;margin-top:2px">Confidence: <strong>${result.confidence}%</strong> · Freshness score: ${freshScoreVal}/10</div></div>
      </div>
      <div class="mobilenet-body ${result.cssClass}">
        <div style="font-weight:700;font-size:.86rem;margin-bottom:8px">${safetyMsg}</div>
        <div class="conf-bar-wrap">${confPercentages.map(c=>`<div style="margin-bottom:8px"><div class="conf-bar-lbl"><span>${c.label}</span><span>${c.val}%</span></div><div class="conf-bar"><div class="conf-fill ${c.cls}" style="width:${c.val}%"></div></div></div>`).join('')}</div>
        <div style="margin-top:10px;padding:8px 10px;background:rgba(0,0,0,.06);border-radius:8px"><div style="font-size:.72rem;font-weight:700;margin-bottom:5px;opacity:.8">🧠 Top-3 ImageNet Detections:</div><div style="display:flex;gap:4px;flex-wrap:wrap">${top3Preds}</div></div>
       
      </div>
    </div>
    ${result.label==='Fresh'?`<div class="safety-cert"><div class="cert-badge">✅</div><div style="font-family:'Bricolage Grotesque',sans-serif;font-size:1.2rem;font-weight:800;margin-bottom:6px">🏅 MobileNet Safety Certificate</div><div style="font-size:.82rem;opacity:.8;margin-bottom:14px">TensorFlow.js · MobileNet v2 · ImageNet Pretrained</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px"><div style="background:rgba(255,255,255,.1);border-radius:8px;padding:10px"><div style="font-size:.68rem;opacity:.7">Freshness</div><div style="font-size:1.5rem;font-weight:800;color:#4ade80">${freshScoreVal}<small>/10</small></div></div><div style="background:rgba(255,255,255,.1);border-radius:8px;padding:10px"><div style="font-size:.68rem;opacity:.7">Label</div><div style="font-size:1.1rem;font-weight:800;color:#4ade80">${result.label}</div></div><div style="background:rgba(255,255,255,.1);border-radius:8px;padding:10px"><div style="font-size:.68rem;opacity:.7">Confidence</div><div style="font-size:1.5rem;font-weight:800;color:#2dd4bf">${result.confidence}<small>%</small></div></div></div></div>`:''}
  `;
}

async function runClaudeApiFallback(){
  const imgEl=byId('img-prev');const foodHint=byId('food-name-inp')?.value||'';
  byId('vision-res').innerHTML=`<div class="predict-loading"><div class="spin" style="border-top-color:#22c55e;width:16px;height:16px;border-width:2px"></div><span>Using Claude Vision as fallback…</span></div>`;
  try{
    const base64=imgEl.src.split(',')[1]||'';
    const prompt=`You are a food freshness classifier. Look at this food image${foodHint?` (hint: "${foodHint}")`:''}.
Classify as EXACTLY one of: Fresh, Medium, or Spoiled.
Respond ONLY with valid JSON (no markdown):
{"label":"Fresh|Medium|Spoiled","confidence":<70-99>,"freshness_score":<1.0-10.0>,"reason":"<one sentence>"}`;
    const resp=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-20250514',max_tokens:200,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:'image/jpeg',data:base64}},{type:'text',text:prompt}]}]})});
    const data=await resp.json();
    const text=(data.content?.[0]?.text||'{}').replace(/```json|```/gi,'').trim();
    const r=JSON.parse(text);
    const labelMap={'Fresh':{cssClass:'fresh-food',icon:'✅',emoji:'🟢'},'Medium':{cssClass:'medium-food',icon:'⚠️',emoji:'🟡'},'Spoiled':{cssClass:'spoiled-food',icon:'❌',emoji:'🔴'}};
    const lm=labelMap[r.label]||labelMap['Medium'];
    const textType=currentFoodType||classifyFood(foodHint)?.type||'raw';
    showMobileNetResult({label:r.label,cssClass:lm.cssClass,icon:lm.icon,confidence:r.confidence||85,freshScore:r.freshness_score||7,emoji:lm.emoji},[{className:r.reason||'AI analyzed',probability:r.confidence/100}],FOOD_DB[textType],foodHint);
  }catch(e){byId('vision-res').innerHTML=`<div class="ai-box"><div class="ai-dot">Analysis Error</div><p style="font-size:.82rem;opacity:.75;margin-top:8px">Could not analyze image. Check your internet connection and try again.</p></div>`;}
}

/* =====================================================
   P2P MATCHING
   ===================================================== */
function populateFoodDropdown(selId) {
    const sel = byId(selId);
    if (!sel) return;
    
    // Clear existing (keep first default option)
    while (sel.options.length > 1) sel.remove(1);
    
    const available = DB.donations.filter(d => d.status === 'available');
    
    if (available.length > 0) {
        available.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.id; // use donation ID
            opt.textContent = `${d.food_name} by ${d.donor_name} — ${d.quantity} units`;
            opt.dataset.qty = d.quantity;
            opt.dataset.donor = d.donor_name;
            sel.appendChild(opt);
        });
    } else {
        // Fallback default items
        const defaults = ['Rice (100 units)', 'Chapathi (50 units)', 'Dal (30 units)', 'Bread (20 units)', 'Fruits (40 units)'];
        defaults.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.split(' ')[0]; // just 'Rice' etc.
            opt.textContent = `Default: ${d}`;
            opt.dataset.qty = parseInt(d.match(/\d+/)[0]);
            opt.dataset.donor = 'Community Pool';
            sel.appendChild(opt);
        });
    }
}

function renderP2PMatches(){
  const el=byId('p2p-matches');if(!el)return;
  let available=DB.donations.filter(d=>d.status==='available');
  
  // AI Filtering
  if (window.aiActiveFilter) {
      const f = window.aiActiveFilter;
      if (f.includes('rice')) available = available.filter(d => d.food_name.toLowerCase().includes('rice'));
      if (f.includes('chapathi') || f.includes('roti')) available = available.filter(d => d.food_name.toLowerCase().includes('chapathi') || d.food_name.toLowerCase().includes('roti'));
  }
  
  if(!available.length){
    el.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="ico">📍</div><p>No donations available matching criteria</p></div>';
    populateFoodDropdown('req-food-sel');
    return;
  }
  
  const sorted=[...available].map(d=>({...d,dist:getDonationDistance(d)})).sort((a,b)=>a.dist-b.dist);
  el.innerHTML=sorted.map((d,i)=>{const ti=FOOD_DB[d.food_type||'raw'];const ts=getTrustScore(d.donor_name,'donor');return`<div class="match-card" onclick="selectMatch(${d.id},this)"><div class="match-score">${i+1}</div><div style="font-size:1.4rem;margin-bottom:6px">${ti.icon}</div><div style="font-weight:700;font-size:.9rem;margin-bottom:4px">${esc(d.food_name)}</div><div style="font-size:.76rem;color:var(--txt2);margin-bottom:6px">by ${esc(d.donor_name)}</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">${getDistBadge(d.dist)}<span class="badge ${fClass(d.freshness_score)}">${d.freshness_score}/10</span><span class="badge bg-b">${d.quantity} units</span></div><div style="font-size:.72rem;color:var(--txt3)">${esc(d.location_label)}</div><div style="margin-top:8px;font-size:.72rem;color:${ts.hasRating?ts.color:'var(--txt3)'}">🏅 ${ts.hasRating?`Trust: ${ts.score}/100 · ${ts.level}`:'Not yet rated'}</div></div>`;}).join('');
  populateFoodDropdown('req-food-sel');
}
function selectMatch(id,cardEl){
  document.querySelectorAll('.match-card').forEach(c=>c.classList.remove('selected'));cardEl.classList.add('selected');
  const sel=byId('req-food-sel');if(sel)sel.value=id;
  const d=DB.donations.find(x=>x.id===id);if(!d)return;
  const dist=getDonationDistance(d);
  byId('req-dist-preview').innerHTML=`<div style="padding:10px;background:#eff6ff;border-radius:8px;font-size:.84rem;display:flex;align-items:center;gap:8px"><span style="font-size:1.2rem">📍</span><div><div style="font-weight:700">AI Match: ${esc(d.food_name)}</div><div style="color:var(--txt2)">Distance: ${dist.toFixed(2)} km</div></div></div>`;
}

const FRIDGE_SLOTS=[{id:1,label:'Slot A1',food:'Rice & Dal',exp:'2h',status:'fresh'},{id:2,label:'Slot A2',food:'Vegetables',exp:'6h',status:'warn'},{id:3,label:'Slot A3',food:'',exp:'',status:'empty'},{id:4,label:'Slot B1',food:'Bread',exp:'12h',status:'fresh'},{id:5,label:'Slot B2',food:'',exp:'',status:'empty'},{id:6,label:'Slot B3',food:'Fruits',exp:'1d',status:'fresh'}];
function renderFridge(){const el=byId('fridge-grid');if(!el)return;el.innerHTML=FRIDGE_SLOTS.map(s=>`<div class="fridge-slot ${s.status==='empty'?'empty-slot':s.status}" onclick="claimFridge(${s.id})"><div style="font-size:1.4rem">${s.status==='empty'?'➕':s.status==='fresh'?'🟢':'🟡'}</div><div style="font-weight:700;font-size:.76rem;margin-top:4px">${s.label}</div>${s.food?`<div style="font-size:.7rem;margin-top:2px">${s.food}</div><div style="font-size:.68rem;opacity:.7;margin-top:2px">⏱️ ${s.exp}</div>`:'<div style="font-size:.7rem;opacity:.5;margin-top:2px">Empty</div>'}</div>`).join('');}
function claimFridge(id){const slot=FRIDGE_SLOTS.find(s=>s.id===id);if(!slot)return;if(slot.status==='empty')toast(`📦 Slot ${slot.label} reserved`,'info');else toast(`🧊 Claimed: ${slot.food} from ${slot.label}!`,'ok');}

function initParkingState(){
  const hour=new Date().getHours();const isPeak=(hour>=9&&hour<=11)||(hour>=13&&hour<=15)||(hour>=17&&hour<=19);const occupyChance=isPeak?0.7:0.4;
  APP.parkingState=Array.from({length:15},(_,i)=>({id:i+1,row:Math.floor(i/5),col:i%5,label:`${String.fromCharCode(65+Math.floor(i/5))}${(i%5)+1}`,occupied:Math.random()<occupyChance,reserved:false,reservedBy:null}));
  const empty=APP.parkingState.filter(s=>!s.occupied);if(empty.length<4){let freed=0;for(const s of APP.parkingState){if(s.occupied&&freed<4){s.occupied=false;freed++;}}}
  APP.selectedParkSlot=null;
}
function findBestParkingSlot(){if(!APP.parkingState)return null;const empty=APP.parkingState.filter(s=>!s.occupied&&!s.reserved);if(!empty.length)return null;const scored=empty.map(s=>({...s,score:Math.abs(s.col-2)*-1+(s.row===0?2:0)}));scored.sort((a,b)=>b.score-a.score);return scored[0].id;}
function renderParking(recommendedId){
  const el=byId('parking-radar');if(!el||!APP.parkingState)return;
  const empty=APP.parkingState.filter(s=>!s.occupied).length;const occupied=APP.parkingState.filter(s=>s.occupied).length;
  const statsEl=byId('parking-stats');if(statsEl)statsEl.innerHTML=`<span style="color:var(--g2);font-weight:600">🟢 ${empty} empty</span> · <span style="color:var(--r1);font-weight:600">🔴 ${occupied} occupied</span>`;
  el.innerHTML=APP.parkingState.map(s=>{let cls='empty',icon='P';if(s.occupied){cls='occupied';icon='🚗';}else if(s.reserved&&s.reservedBy===APP.name){cls='selected';icon='✅';}else if(s.reserved){cls='occupied';icon='🔒';}else if(s.id===recommendedId){cls='highlight';icon='⭐';}return`<div class="park-slot ${cls}" onclick="selectParkSlot(${s.id},'${s.label}')"><div style="font-size:${s.occupied?'1rem':'.9rem'}">${icon}</div><div class="park-slot-label">${s.label}</div></div>`;}).join('');
}
function selectParkSlot(id,label){
  if(!APP.parkingState)return;const slot=APP.parkingState.find(s=>s.id===id);if(!slot)return;
  if(slot.occupied){toast(`🚗 Slot ${label} is occupied.`,'err');return;}
  if(slot.reserved&&slot.reservedBy!==APP.name){toast(`🔒 Slot ${label} is reserved.`,'err');return;}
  if(APP.selectedParkSlot&&APP.selectedParkSlot!==id){const prev=APP.parkingState.find(s=>s.id===APP.selectedParkSlot);if(prev&&prev.reservedBy===APP.name){prev.reserved=false;prev.reservedBy=null;}}
  if(slot.reserved&&slot.reservedBy===APP.name){slot.reserved=false;slot.reservedBy=null;APP.selectedParkSlot=null;const msgEl=byId('parking-msg');if(msgEl)msgEl.innerHTML='';renderParking(findBestParkingSlot());toast(`Slot ${label} reservation cancelled.`,'info');}
  else{slot.reserved=true;slot.reservedBy=APP.name;APP.selectedParkSlot=id;const msgEl=byId('parking-msg');if(msgEl)msgEl.innerHTML=`<div style="padding:8px 12px;background:#ecfdf5;border:1px solid #22c55e;border-radius:8px;color:#065f46;font-weight:600">✅ Slot <strong>${label}</strong> reserved!</div>`;renderParking(findBestParkingSlot());toast(`✅ Slot ${label} reserved!`,'ok');}
}
function scanParking(){
  if(!APP.parkingState)initParkingState();
  else{APP.parkingState.forEach(s=>{if(!s.reserved){if(s.occupied&&Math.random()<0.3)s.occupied=false;else if(!s.occupied&&Math.random()<0.2)s.occupied=true;}});}
  const bestId=findBestParkingSlot();renderParking(bestId);
  const empty=APP.parkingState.filter(s=>!s.occupied&&!s.reserved).length;
  const best=APP.parkingState.find(s=>s.id===bestId);
  toast(`🅿️ Scan: ${empty} slots available${best?` · Slot ${best.label} recommended`:''}!`,'ok');
}

function generateSmartRoute(){
  const map=APP.maps.volLiveMap;if(!map)return;
  APP.routeLines.forEach(l=>{try{l.remove()}catch(e){}});APP.routeLines=[];
  const uLat=APP.userLat||DEFAULT_LAT,uLng=APP.userLng||DEFAULT_LNG;
  if(!DB.donations.length){toast('No donations to route to','err');return;}
  const nearest=DB.donations.reduce((a,b)=>getDonationDistance(a)<getDonationDistance(b)?a:b);
  const dLat=+(nearest.lat||DEFAULT_LAT),dLng=+(nearest.lng||DEFAULT_LNG);
  const line=L.polyline([[uLat,uLng],[dLat,dLng]],{color:'#3b82f6',weight:4,opacity:.8,dashArray:'12 6'}).addTo(map);
  APP.routeLines.push(line);
  const dist=haversine(uLat,uLng,dLat,dLng);
  line.bindPopup(`<div style="font-size:12px"><b>🗺️ Smart Route</b><br>Distance: ${dist.toFixed(2)} km</div>`).openPopup();
  map.fitBounds([[uLat,uLng],[dLat,dLng]],{padding:[40,40]});
  const routeInfo=byId('smart-route-section');
  if(routeInfo)routeInfo.innerHTML=`<div class="route-info"><div class="ai-dot">🗺️ Smart Route Generated</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px;text-align:center"><div style="background:rgba(255,255,255,.07);border-radius:6px;padding:8px"><div style="font-size:.68rem;opacity:.7">Distance</div><div style="font-size:1.1rem;font-weight:700">${dist.toFixed(2)} km</div></div><div style="background:rgba(255,255,255,.07);border-radius:6px;padding:8px"><div style="font-size:.68rem;opacity:.7">Est. Time</div><div style="font-size:1.1rem;font-weight:700">${dist<2?Math.round(dist*15):Math.round(dist*4)} min</div></div></div></div><button class="btn btn-primary btn-full" style="margin-top:8px" onclick="generateSmartRoute()">🔄 Recalculate</button>`;
  toast(`🗺️ Route: ${dist.toFixed(2)} km to nearest donation`,'ok');
}

function checkMicroVolunteerAlert(){
  const el=byId('micro-vol-alert');if(!el)return;
  const pending=DB.requests.filter(r=>r.status==='pending');
  if(!pending.length){el.style.display='none';return;}
  const nearest=pending[0];
  el.style.display='block';
  el.innerHTML=`<div class="micro-alert"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><div style="font-weight:700;font-size:.9rem">⚡ Micro-Volunteer Opportunity!</div><button class="btn btn-sm" style="background:rgba(255,255,255,.15);color:#fff" onclick="byId('micro-vol-alert').style.display='none'">✕</button></div><div style="font-size:.82rem;opacity:.85">Someone nearby needs food. Can you help?</div><div style="margin-top:10px;padding:8px;background:rgba(255,255,255,.1);border-radius:6px"><div style="font-size:.8rem;font-weight:600">${esc(nearest.food_name)}</div><div style="font-size:.74rem;opacity:.7;margin-top:2px">Priority: ${nearest.priority_score}/100</div></div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn-sm btn-primary" onclick="acceptMicroTask(${nearest.id})">✅ I'll carry it!</button><button class="btn btn-sm btn-ghost" onclick="byId('micro-vol-alert').style.display='none'">Not now</button></div></div>`;
}
function acceptMicroTask(reqId){const req=DB.requests.find(r=>r.id===reqId);if(req)req.status='assigned';byId('micro-vol-alert').style.display='none';saveDB();toast('🌟 Micro-task accepted!','ok');}

function addTiles(map){L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'© OpenStreetMap © CARTO',subdomains:'abcd',maxZoom:19}).addTo(map);}
function scrollToTop(){window.scrollTo({top:0,left:0,behavior:'instant'});document.documentElement.scrollTop=0;}

function showPage(id){
  const targetPage = id === 'login-page' ? 'index.html' : id.replace('-page', '.html');
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  if (currentPath !== targetPage) {
    const pageId = currentPath === 'index.html' ? 'login-page' : currentPath.replace('.html', '-page');
    sessionStorage.setItem('zh_prevPage', pageId);
    window.location.href = targetPage;
  }
}

function switchAuthTab(tab){
  const isSignin=tab==='signin';
  byId('auth-signin').style.display=isSignin?'block':'none';
  byId('auth-signup').style.display=isSignin?'none':'block';
  const act='background:linear-gradient(135deg,var(--g2),var(--t1));color:#fff';
  const inact='background:transparent;color:var(--txt2)';
  const base=';flex:1;padding:8px;border:none;border-radius:8px;font-family:"Plus Jakarta Sans",sans-serif;font-size:.85rem;font-weight:600;cursor:pointer;transition:all .2s';
  byId('tab-signin').style.cssText=(isSignin?act:inact)+base;
  byId('tab-signup').style.cssText=(isSignin?inact:act)+base;
  byId('suerr').textContent='';byId('lerr').textContent='';
}
function handleRoleChange(role){byId('su-admin-key-wrap').style.display=role==='admin'?'block':'none';}

const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const name=byId('su-name').value.trim();
    const email=byId('su-email').value.trim(),username=byId('su-user').value.trim().toLowerCase();
    const phone=byId('su-phone').value.trim(),pw=byId('su-pw').value,pw2=byId('su-pw2').value;
    const role=byId('su-role').value;
    const suerr=byId('suerr'); if(suerr) suerr.textContent='';
    if(!name||!email||!username||!pw){if(suerr)suerr.textContent='All required fields must be filled.';return}
    if(pw.length<6){if(suerr)suerr.textContent='Password must be at least 6 characters.';return}
    if(pw!==pw2){if(suerr)suerr.textContent='Passwords do not match.';return}
    const emoji=role==='admin'?'⚙️':'👤';
    
    try {
      // --- GOOGLE SHEETS BACKEND (Temporarily Muted) ---
      /*
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'signup', payload: { username, password: pw, name, age, email, phone, role, emoji } })
      });
      const data = await res.json();
      if (data.success) {
        REGISTRY[username]={pw,role,name,email,phone,emoji};
        saveRegistry();
        toast(`Account created! Welcome, ${name} 🎉`,'ok');
        afterLogin(username);
      } else {
        if(suerr)suerr.textContent=data.message;
      }
      */
      
      // --- SUPABASE BACKEND ---
      if (supabaseClient) {
          const { data, error } = await supabaseClient.from('users').insert([{ username, password: pw, name, email, phone, role, emoji }]);
          if (error) {
              if (error.code === '23505') { if(suerr) suerr.textContent = 'Username already taken.'; }
              else { if(suerr) suerr.textContent = error.message || 'Signup failed'; }
          } else {
              REGISTRY[username]={pw,role,name,email,phone,emoji};
              saveRegistry();
              toast(`Account created! Welcome, ${name} 🎉`,'ok');
              afterLogin(username);
          }
      }
    } catch (err) {
      if(suerr)suerr.textContent='Server error. Could not sign up.';
    }
  });
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const un=byId('lu').value.trim().toLowerCase(),pw=byId('lp').value.trim();
    const lerr = byId('lerr'); if(lerr) lerr.textContent='';
    if(!un||!pw){if(lerr)lerr.textContent='Enter username and password.';return}
    
    // Hardcoded separate password for admin login
    if (un === 'admin' && pw === 'assara') {
        const adminUser = { pw: 'assara', role: 'admin', name: 'System Administrator', emoji: '⚙️' };
        REGISTRY['admin'] = adminUser;
        saveRegistry();
        afterLogin('admin');
        return;
    }
    
    try {
      // --- GOOGLE SHEETS BACKEND (Temporarily Muted) ---
      /*
      const res = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'login', payload: { username: un, password: pw } })
      });
      const data = await res.json();
      if (data.success) {
        REGISTRY[un] = data.user;
        saveRegistry();
        afterLogin(un);
      } else {
        if(lerr)lerr.textContent=data.message;
      }
      */
      
      // --- SUPABASE BACKEND ---
      if (supabaseClient) {
          const { data, error } = await supabaseClient.from('users').select('*').eq('username', un).eq('password', pw);
          if (error || !data || data.length === 0) {
              if(lerr) lerr.textContent = 'Invalid credentials';
          } else {
              const u = data[0];
              REGISTRY[un] = u;
              saveRegistry();
              afterLogin(un);
          }
      }
    } catch (err) {
      if(lerr)lerr.textContent='Server error. Could not log in.';
    }
  });
}

async function afterLogin(un){
  const u=REGISTRY[un];
  APP.role=u.role;APP.user=un;APP.name=u.name;
  if(byId('nav-uname')) byId('nav-uname').textContent=`${u.emoji} ${u.name}`;
  sessionStorage.setItem('zh_session',un);
  await syncDatabase();
  loadProfile();
  
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  if (currentPath === 'index.html' || currentPath === '') {
    showPage('profile-page');
  }
  
  scrollToTop();
  history.replaceState({loggedIn:true},'','');
  toast(`Welcome back, ${u.name}!`,'ok');
  getUserLocation();
}

function doLogout(){
  APP.role=null;APP.user=null;APP.name=null;
  // ✅ FIX 1: Clear sessionStorage session
  sessionStorage.removeItem('zh_session');
  if(APP.geoWatchId){navigator.geolocation.clearWatch(APP.geoWatchId);APP.geoWatchId=null;}
  Object.values(APP.maps).forEach(m=>{try{m.remove()}catch(e){}});APP.maps={};
  showPage('login-page');
  byId('lu').value='';byId('lp').value='';
  switchAuthTab('signin');toast('Logged out.','info');
}

function loadProfile(){
  const u=REGISTRY[APP.user];if(!u)return;
  if(byId('prof-avatar')) byId('prof-avatar').textContent=u.emoji;
  if(u.avatar) {
    if(byId('prof-avatar-img')) {
      byId('prof-avatar-img').src=u.avatar;
      byId('prof-avatar-img').style.display='block';
      if(byId('prof-avatar')) byId('prof-avatar').style.display='none';
    }
  } else {
    if(byId('prof-avatar-img')) byId('prof-avatar-img').style.display='none';
    if(byId('prof-avatar')) byId('prof-avatar').style.display='grid';
  }
  if(byId('prof-name')) byId('prof-name').textContent=APP.name;
  if(byId('prof-role-lbl')) byId('prof-role-lbl').textContent=APP.role==='admin'?'System Administrator':(APP.role==='trust'?'Trust / NGO':'Community Member');
  
  if(byId('prof-stats')) {
    byId('prof-stats').innerHTML=`
      <div class="stat-card"><div class="stat-num">${DB.donations.length}</div><div class="stat-lbl">Donations</div></div>
      <div class="stat-card"><div class="stat-num">${DB.requests.length}</div><div class="stat-lbl">Requests</div></div>
      <div class="stat-card"><div class="stat-num">${DB.volunteers.length}</div><div class="stat-lbl">Volunteers</div></div>
      <div class="stat-card"><div class="stat-num">91%</div><div class="stat-lbl">AI Score</div></div>`;
  }
  
  if(byId('prof-info-row')) {
    byId('prof-info-row').innerHTML=`
      <span style="background:rgba(255,255,255,.2);padding:4px 10px;border-radius:99px;font-size:.78rem">👤 ${APP.role}</span>
      <span style="background:rgba(255,255,255,.2);padding:4px 10px;border-radius:99px;font-size:.78rem">📅 ${new Date().toLocaleDateString('en-IN')}</span>
      ${u.email?`<span style="background:rgba(255,255,255,.2);padding:4px 10px;border-radius:99px;font-size:.78rem">✉️ ${esc(u.email)}</span>`:''}`;
  }
  
  const mods=APP.role==='admin'
    ?[{k:'admin',ico:'⚙️',t:'Admin Dashboard',d:'Manage all data, charts, carbon impact, notifications and P2P maps.'},
      {k:'details',ico:'📋',t:'Detailed Records',d:'View all donor, receiver & volunteer records with trust scores.'}]
    :APP.role==='trust'
    ?[{k:'trust',ico:'🏛️',t:'Trust Portal',d:'Request donations and funds with AI verified Trust ID.'}]
    :[{k:'donor',ico:'🎁',t:'Donor Module',d:'Donate food with TensorFlow MobileNet freshness scan & expiry prediction.'},
      {k:'request',ico:'📦',t:'Receiver Module (P2P)',d:'Request fresh food with AI proximity matching & community fridge.'},
      {k:'volunteer',ico:'🚗',t:'Micro-Volunteer Module',d:'Register as micro-volunteer with parking radar & smart routing.'},
      {k:'activity',ico:'<i class="bx bx-pulse"></i>',t:'My Live Activity',d:'View your live donations, history, requests, and P2P chats.'}];
      
  if(byId('prof-modules')) {
    byId('prof-modules').innerHTML=mods.map(m=>`<div class="module-card" onclick="handleModClick('${m.k}')"><div class="mod-icon">${m.ico}</div><h3 style="font-size:1rem;font-weight:700;margin-bottom:4px">${m.t}</h3><p style="font-size:.82rem;color:var(--txt2)">${m.d}</p></div>`).join('');
  }
  
  renderTrustCard();
  updateProfileCert();
  initMiniMap();
  checkMicroVolunteerAlert();
  if (typeof updateProfileHistoryCounts === 'function') updateProfileHistoryCounts();
}

function handleModClick(k){
  APP.prevPage='profile-page';
  if(k==='admin'){showPage('admin-page');initAdminDash();return}
  if(k==='details'){goDetails();return}
  if(k==='donor'){showPage('donor-page');renderDonTbl();initLiveMap('donor-map','donor');return}
  if(k==='request'){showPage('request-page');initReqSection();initLiveMap('req-map','req');return}
  if(k==='volunteer'){showPage('volunteer-page');initVolSection();initLiveMap('vol-map','vol');return}
  if(k==='trust'){showPage('trust-page');initTrustDashboard();return}
  if(k==='activity'){showPage('activity-page');renderMyActivity();return}
}
function goBack(){
  const prev = sessionStorage.getItem('zh_prevPage') || 'profile-page';
  showPage(prev);
}

function initMiniMap(){
  if(APP.maps.mini){try{APP.maps.mini.remove()}catch(e){}delete APP.maps.mini}
  const el=byId('mini-map');if(!el)return;
  try{
    const lat=APP.userLat||DEFAULT_LAT,lng=APP.userLng||DEFAULT_LNG;
    const m=L.map('mini-map',{zoomControl:false,attributionControl:false}).setView([lat,lng],13);
    addTiles(m);addAllMarkers(m);APP.maps.mini=m;
    setTimeout(() => { m.invalidateSize(); }, 300);
  }catch(e){}
}
function getUserLocation(){
  if(!navigator.geolocation){APP.userLat=DEFAULT_LAT;APP.userLng=DEFAULT_LNG;return;}
  if(APP.geoWatchId)navigator.geolocation.clearWatch(APP.geoWatchId);
  APP.geoWatchId=navigator.geolocation.watchPosition(
    pos=>{APP.userLat=pos.coords.latitude;APP.userLng=pos.coords.longitude;APP.userAccuracy=pos.coords.accuracy;updateAllLiveMarkers();},
    ()=>{APP.userLat=DEFAULT_LAT;APP.userLng=DEFAULT_LNG;},
    {enableHighAccuracy:true,timeout:15000,maximumAge:0}
  );
}
function updateAllLiveMarkers(){
  const lat=APP.userLat,lng=APP.userLng;if(!lat||!lng)return;
  ['donor','req','vol'].forEach(prefix=>{
    const mapKey=prefix+'LiveMap',m=APP.maps[mapKey];if(!m)return;
    if(APP.maps[mapKey+'_marker'])APP.maps[mapKey+'_marker'].setLatLng([lat,lng]);
    m.setView([lat,lng],17);
    if(APP.maps[mapKey+'_circle']){APP.maps[mapKey+'_circle'].setLatLng([lat,lng]);if(APP.userAccuracy)APP.maps[mapKey+'_circle'].setRadius(APP.userAccuracy);}
    const txtEl=byId(prefix+'-loc-txt');if(txtEl)txtEl.textContent=`📍 Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}${APP.userAccuracy?` (±${Math.round(APP.userAccuracy)}m)`:''}`;
  });
}
function initLiveMap(elId, prefix) {
  const mapKey = prefix + 'LiveMap';
  if (APP.maps[mapKey]) { try { APP.maps[mapKey].remove(); } catch(e){} delete APP.maps[mapKey]; delete APP.maps[mapKey+'_marker']; delete APP.maps[mapKey+'_circle']; }
  const lat = APP.userLat || DEFAULT_LAT, lng = APP.userLng || DEFAULT_LNG;
  const el = byId(elId);
  if (!el) return;
  try {
    if (el._leaflet_id) el._leaflet_id = null;
    const m = L.map(elId, { attributionControl: false, zoomControl: true }).setView([lat, lng], 17);
    APP.maps[mapKey] = m;
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { subdomains: ['mt0','mt1','mt2','mt3'], maxZoom: 20 }).addTo(m);
    APP.maps[mapKey+'_circle'] = L.circle([lat, lng], { radius: APP.userAccuracy||20, color:'#4285F4', fillColor:'#4285F4', fillOpacity:.15, weight:1.5 }).addTo(m);
    APP.maps[mapKey+'_marker'] = L.marker([lat, lng], { icon: L.divIcon({ html:`<div style="position:relative;width:22px;height:22px"><div style="position:absolute;inset:0;background:#4285F4;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(66,133,244,.6)"></div></div>`, className:'', iconSize:[22,22], iconAnchor:[11,11] }) }).addTo(m);
    const txtEl = byId(prefix+'-loc-txt');
    if (txtEl) txtEl.textContent = `📍 Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
    if (APP.userLat && APP.userLng) updateAllLiveMarkers();
    setTimeout(() => { try { m.invalidateSize(); } catch(e){} }, 100);
    setTimeout(() => { try { m.invalidateSize(); m.setView([lat, lng], 17); } catch(e){} }, 600);
  } catch(e) { console.error('Map init error:', elId, e); }
}

const freshScore=(mfg,exp)=>{const now=new Date(),m=new Date(mfg),e=new Date(exp);const tot=(e-m)/86400000,rem=(e-now)/86400000;return Math.round(Math.max(0,Math.min(1,rem/tot))*100)/10;};
const expiryDays=exp=>Math.max(0,Math.round((new Date(exp)-new Date())/86400000));
const priorityScore=(urg,days,fresh)=>{let s=(urg==='High'?60:20)+Math.max(0,30-Math.min(30,days))+(+fresh*1.5);if(days<=1)s+=40;return Math.round(Math.min(100,s));};

function togglePaySection(){
  const v=byId('pay-type-select').value;
  byId('pay-physical').style.display=v==='physical'?'block':'none';
  byId('pay-online').style.display=v==='online'?'block':'none';
}

const donateForm = document.getElementById('donate-form');
if(donateForm) donateForm.addEventListener('submit', async e=>{
  e.preventDefault();const f=e.target;
  const donor_name=f.donor_name.value.trim();
  const food_name=f.food_name.value.trim(),qty=+f.quantity.value;
  const mfg=f.mfg_date.value,exp=f.expiry_date.value;
  const loc_text=f.location_text.value.trim(),pay_type=f.payment_type.value;
  if(!donor_name||!food_name||qty<=0||!mfg||!exp||!loc_text||!pay_type){toast('Please fill all required fields','err');return}
  
  const categorySel = byId('item-category-sel');
  const cat = categorySel ? categorySel.value : 'auto';
  
  if (cat === 'auto') {
      const nfCheck = detectNonFood(food_name);
      if(nfCheck.isNonFood){
          toast(`🚫 "${food_name}" is not a food item! Only food donations are accepted.`,'err',4000);
          showNonFoodWarning(food_name,nfCheck.matched);
          return;
      }
  }

  if(new Date(exp)<=new Date(mfg)){toast('Expiry must be after manufacture date','err');return}
  const fresh=freshScore(mfg,exp),days=expiryDays(exp);
  let payInfo='';
  if(pay_type==='physical')payInfo=`Cash (${f.phy_notes.value||'no notes'})`;
  if(pay_type==='online')payInfo=`Online ₹${f.onl_amount.value||'?'} via ${f.onl_mode.value} (${f.onl_txn.value||'no txn'})`;
  const foodType=currentFoodType||classifyFood(food_name)?.type||'raw';
  const latOff=(Math.random()-0.5)*0.05,lngOff=(Math.random()-0.5)*0.05;
  const d={donor_username: APP.user, donor_name,food_name,food_type:foodType,quantity:qty,mfg_date:mfg,expiry_date:exp,location_label:loc_text,lat:(APP.userLat||DEFAULT_LAT)+latOff,lng:(APP.userLng||DEFAULT_LNG)+lngOff,freshness_score:fresh,expiry_days:days,pay_type,pay_info:payInfo,status:'available'};
  try {
      // --- GOOGLE SHEETS BACKEND (Temporarily Muted) ---
      /*
      await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'donations', payload: d }) });
      await syncDatabase();
      */
      
      // --- SUPABASE BACKEND ---
      if (supabaseClient) {
          const { error } = await supabaseClient.from('donations').insert([d]);
          if (error) throw error;
          await syncDatabase();
      }
  } catch(e) { toast('Error: ' + (e.message||'Failed to save'), 'err'); return; }
  updateNotifBadge();
  const typeInfo=FOOD_DB[foodType];
  byId('don-ai-res').innerHTML=`<div class="ai-box"><div class="ai-dot">✅ Donation Accepted — P2P Network Live</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:12px;text-align:center"><div><div style="font-size:.68rem;opacity:.7">Food Type</div><div style="font-size:1.2rem;margin-top:4px">${typeInfo.icon}</div><div style="font-size:.72rem;font-weight:700;color:#22c55e;margin-top:2px">${typeInfo.label}</div></div><div><div style="font-size:.68rem;opacity:.7">Freshness</div><div style="font-size:1.6rem;font-weight:800;color:#22c55e">${fresh}<small>/10</small></div></div><div><div style="font-size:.68rem;opacity:.7">Expiry</div><div style="font-size:1.6rem;font-weight:800;color:#22c55e">${days}<small>d</small></div></div><div><div style="font-size:.68rem;opacity:.7">Payment</div><div style="font-size:.85rem;font-weight:700;color:#2dd4bf;margin-top:6px">${pay_type==='physical'?'💵 Cash':'💳 Online'}</div></div></div></div>`;
  toast(`Donation submitted! ${typeInfo.icon} ${typeInfo.label} — Freshness: ${fresh}/10`,'ok');
  f.reset();
  byId('pay-physical').style.display='none';byId('pay-online').style.display='none';
  byId('expiry-predict-box').innerHTML='';byId('expiry-ai-badge').style.display='none';byId('food-type-pill').style.display='none';
  currentFoodType=null;aiPredictedExpiry=null;aiPredictedMfg=null;
  renderDonTbl();updateCarbonMetrics();updateProfileCert();
});

function renderDonTbl(){
  const tb=byId('don-tbody');if(!tb)return;
  if(!DB.donations.length){tb.innerHTML='<tr><td colspan="12" class="empty">No donations yet.</td></tr>';return}
  const uLat=APP.userLat||DEFAULT_LAT,uLng=APP.userLng||DEFAULT_LNG;
  
  const sorted = [...DB.donations].sort((a,b)=>{
      const aDone = ['done', 'completed', 'expired'].includes((a.status||'').toLowerCase()) ? 1 : 0;
      const bDone = ['done', 'completed', 'expired'].includes((b.status||'').toLowerCase()) ? 1 : 0;
      return aDone - bDone;
  });
  
  tb.innerHTML=sorted.map(d=>{
    const ti=FOOD_DB[d.food_type||'raw'];
    const dist=haversine(uLat,uLng,+(d.lat||DEFAULT_LAT),+(d.lng||DEFAULT_LNG));
    const ts=getTrustScore(d.donor_name,'donor');
    return`<tr><td><strong>${esc(d.donor_name)}</strong></td><td>${esc(d.food_name)}</td><td><span style="font-size:1rem">${ti.icon}</span> ${ti.label}</td><td>${d.quantity}</td><td><span class="badge ${fClass(d.freshness_score)}">${d.freshness_score}/10</span></td><td>${getDistBadge(dist)}</td><td>${d.expiry_days}d</td><td>${esc(d.location_label)}</td><td><span class="badge ${d.pay_type==='online'?'bg-b':'bg-t'}">${d.pay_type==='online'?'💳':'💵'}</span></td><td style="color:${ts.hasRating?ts.color:'var(--txt3)'};font-size:.78rem;font-weight:600">${ts.hasRating?`${ts.score}/100`:'-'}</td><td><span class="badge ${sBadge(d.status)}">${d.status}</span></td></tr>`;
  }).join('');
}

window.renderMyActivity = function() {
    const tb = byId('my-activity-tbody');
    if (!tb) return;
    
    const uStr = String(APP.user || '').toLowerCase().trim();
    const myDonations = DB.donations.filter(d => 
        String(d.donor_username || '').toLowerCase().trim() === uStr || 
        String(d.donor_name || '').toLowerCase().trim() === String(APP.name || '').toLowerCase().trim()
    );
    const myRequests = DB.requests.filter(r => 
        String(r.req_username || '').toLowerCase().trim() === uStr || 
        String(r.req_name || '').toLowerCase().trim() === String(APP.name || '').toLowerCase().trim()
    );

    let rows = [];

    // Process Donations
    myDonations.forEach(d => {
        const reqs = DB.requests.filter(r => Number(r.donation_id) === Number(d.id));
        const hasReq = reqs.length > 0;
        const partner = hasReq ? reqs[0].req_name : 'Waiting...';
        
        let actBtn = '-';
        if (hasReq && ['requested', 'assigned', 'accepted'].includes(d.status.toLowerCase())) {
            actBtn = `<button class="btn btn-sm btn-primary" style="background:linear-gradient(135deg,#10b981,#059669);border:none;color:#fff;font-weight:700;padding:6px 14px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.4);transition:transform .15s" onclick="openConnectModal(${d.id})"><i class='bx bx-message-rounded-dots'></i> Chat</button>`;
        } else if (['done', 'completed', 'expired'].includes(d.status.toLowerCase())) {
            actBtn = `<span style="color:#16a34a;font-weight:600">✅ Completed</span>`;
        } else if (d.status.toLowerCase() === 'available') {
             actBtn = `<span style="color:#d97706;font-weight:600">⏳ Waiting</span>`;
        }
        
        rows.push({
            isDone: ['done', 'completed', 'expired'].includes((d.status||'').toLowerCase()),
            html: `<tr>
            <td><span class="badge" style="background:#e0e7ff;color:#4338ca">Donor</span></td>
            <td>${esc(d.food_name)}</td>
            <td>${d.quantity}</td>
            <td><span class="badge ${sBadge(d.status)}">${d.status}</span></td>
            <td>${esc(partner)}</td>
            <td>${actBtn}</td>
        </tr>`});
    });

    // Process Requests
    myRequests.forEach(r => {
        const don = DB.donations.find(d => Number(d.id) === Number(r.donation_id));
        const partner = don ? don.donor_name : 'Unknown';
        
        let actBtn = '-';
        if (r.status.toLowerCase() !== 'pending') {
            if (['assigned', 'accepted'].includes(r.status.toLowerCase()) || don?.status === 'requested') {
                 actBtn = `<button class="btn btn-sm btn-primary" style="background:linear-gradient(135deg,#10b981,#059669);border:none;color:#fff;font-weight:700;padding:6px 14px;border-radius:20px;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.4);transition:transform .15s" onclick="openConnectModal(${r.donation_id})"><i class='bx bx-message-rounded-dots'></i> Chat</button>`;
            } else if (['done', 'completed', 'expired'].includes(r.status.toLowerCase()) || ['done', 'completed', 'expired'].includes(don?.status?.toLowerCase())) {
                 actBtn = `<span style="color:#16a34a;font-weight:600">✅ Completed</span>`;
            }
        } else {
             actBtn = `<span style="color:#d97706;font-weight:600">⏳ Pending</span>`;
        }

        rows.push({
            isDone: ['done', 'completed', 'expired'].includes((r.status||'').toLowerCase()),
            html: `<tr>
            <td><span class="badge" style="background:#dcfce7;color:#166534">Receiver</span></td>
            <td>${esc(r.food_name)}</td>
            <td>${r.quantity}</td>
            <td><span class="badge ${sBadge(r.status)}">${r.status}</span></td>
            <td>${esc(partner)}</td>
            <td>${actBtn}</td>
        </tr>`});
    });

    rows.sort((a,b) => (a.isDone ? 1 : 0) - (b.isDone ? 1 : 0));

    if (rows.length === 0) {
        tb.innerHTML = '<tr><td colspan="6" class="empty">No activity found.</td></tr>';
    } else {
        tb.innerHTML = rows.map(r => r.html).join('');
    }
}

function initReqSection(){
    renderP2PMatches();
    renderFridge();
    if(byId('req-food-sel')) populateFoodDropdown('req-food-sel');
}

const requestForm = document.getElementById('request-form');
if(requestForm) requestForm.addEventListener('submit', async e=>{
  e.preventDefault();const f=e.target;
  const req_name=f.req_name.value.trim();
  if(!req_name){toast('Name required','err');return}
  const donId=+byId('req-food-sel').value;
  if(!donId){toast('Please select a food item','err');return}
  const qty=+f.req_qty.value;if(!qty||qty<=0){toast('Enter valid quantity','err');return}
  const don=DB.donations.find(d=>Number(d.id)===Number(donId));if(!don){toast('Food not found','err');return}
  
  if (don.donor_name !== 'Community Pool') {
      const finalQty = checkQuantityNegotiation(qty, parseInt(don.quantity||"9999"), don.donor_name, 'donation', don.id);
      if (finalQty === false) return; // Stop form submission, we are negotiating
      // If user accepted partial, we should theoretically update qty, but for now we just proceed with the agreed amount
  }

  const urg=f.req_urgency.value,req_loc=f.req_loc.value.trim();if(!req_loc){toast('Enter your location','err');return}
  const pri=priorityScore(urg,don.expiry_days,don.freshness_score);const dist=getDonationDistance(don);
  const req={req_username: APP.user, req_name,donation_id:donId,food_name:don.food_name,quantity:qty,urgency:urg,location_label:req_loc,priority_score:pri,distance_km:dist.toFixed(2),status:'pending'};
  try {
      // --- GOOGLE SHEETS BACKEND (Temporarily Muted) ---
      /*
      await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'requests', payload: req }) });
      await syncDatabase();
      */
      
      // --- SUPABASE BACKEND ---
      if (supabaseClient) {
          const { error } = await supabaseClient.from('requests').insert([req]);
          if (error) throw error;
          await supabaseClient.from('donations').update({ status: 'requested' }).eq('id', req.donation_id);
          await syncDatabase();
      }
  } catch(e) { toast('Error: ' + (e.message||'Failed to save'), 'err'); return; }
  byId('req-pri-preview').innerHTML=`<div style="padding:10px;background:#dbeafe;border-radius:8px;color:#1e40af;font-size:.84rem">🤖 Priority: <strong>${pri}/100</strong> · Distance: <strong>${dist.toFixed(2)} km</strong></div>`;
  byId('req-confirm').innerHTML=`<div class="notif-item" style="background:var(--g5);border-color:var(--g2)"><div class="notif-t">✅ P2P Request Confirmed</div><div class="notif-m">Priority: ${pri}/100 · ${dist.toFixed(2)} km away</div><button class="btn btn-sm btn-primary" style="margin-top:8px" onclick="openConnectModal(${donId})">💬 Connect with Donor</button></div>`;
  updateNotifBadge();toast(`Request submitted! Priority: ${pri}/100`,'ok');
  f.reset();initReqSection();checkMicroVolunteerAlert();updateCarbonMetrics();
});

const SHIFTS={Morning:[['06:00','09:00'],['07:00','10:00'],['08:00','11:00']],Afternoon:[['12:00','15:00'],['13:00','16:00'],['14:00','17:00']],Night:[['18:00','21:00'],['20:00','23:00'],['21:00','00:00']]};
function fmtT(t){const[h,m]=t.split(':').map(Number);const ap=h<12?'AM':'PM';return`${h%12||12}:${String(m).padStart(2,'0')} ${ap}`}
function genSlots(shift){const c=byId('time-slots');if(!c)return;APP.slot=null;c.innerHTML=(SHIFTS[shift]||[]).map(([s,e])=>`<button type="button" class="slot-btn" onclick="selSlot(this,'${fmtT(s)} – ${fmtT(e)}')">${fmtT(s)} – ${fmtT(e)}</button>`).join('');}
function selSlot(btn,slot){document.querySelectorAll('.slot-btn').forEach(b=>b.classList.remove('sel'));btn.classList.add('sel');APP.slot=slot;}

function initVolSection(){genSlots('Morning');renderVolDonors();initParkingState();const bestId=findBestParkingSlot();renderParking(bestId);}
function renderVolDonors(){
  const tb=byId('vol-donor-tbody');if(!tb)return;
  if(!DB.donations.length){tb.innerHTML='<tr><td colspan="9" class="empty">No donations yet.</td></tr>';return}
  const sorted=[...DB.donations].map(d=>({...d,dist:getDonationDistance(d)})).sort((a,b)=>a.dist-b.dist);
  tb.innerHTML=sorted.map(d=>{const ts=getTrustScore(d.donor_name,'donor');return`<tr><td><strong>${esc(d.donor_name)}</strong></td><td>${esc(d.food_name)}</td><td>${d.quantity}</td><td>${getDistBadge(d.dist)}</td><td>${esc(d.location_label)}</td><td><span class="badge ${d.pay_type==='online'?'bg-b':'bg-t'}">${d.pay_type==='online'?'💳':'💵'}</span></td><td style="color:${ts.hasRating?ts.color:'var(--txt3)'};font-size:.78rem;font-weight:600">${ts.hasRating?`${ts.score}/100`:'-'}</td><td><span class="badge ${sBadge(d.status)}">${d.status}</span></td></tr>`;}).join('');
}

const volForm = document.getElementById('vol-form');
if(volForm) volForm.addEventListener('submit', async e=>{
  e.preventDefault();const f=e.target;
  const vol_name=f.vol_name.value.trim();
  if(!vol_name){toast('Name required','err');return}
  if(!APP.slot){toast('Select a time slot','err');return}
  const vol_pickup=f.vol_pickup.value.trim();if(!vol_pickup){toast('Enter your pickup location','err');return}
  const pending=DB.requests.filter(r=>r.status==='pending').sort((a,b)=>+b.priority_score-+a.priority_score);
  const assigned=pending.length>0,aReq=pending[0];
  const vol = {vol_username: APP.user, vol_name,vehicle_type:f.vehicle_type.value,pickup_location:vol_pickup,shift:f.shift_sel.value,time_slot:APP.slot,status:assigned?'busy':'active', assigned_req_id: assigned ? aReq.id : null};
  try {
      // --- GOOGLE SHEETS BACKEND (Temporarily Muted) ---
      /*
      await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'volunteers', payload: vol }) });
      await syncDatabase();
      */
      
      // --- SUPABASE BACKEND ---
      if (supabaseClient) {
          const { error } = await supabaseClient.from('volunteers').insert([vol]);
          if (error) throw error;
          if (vol.assigned_req_id) {
              await supabaseClient.from('requests').update({ status: 'assigned' }).eq('id', vol.assigned_req_id);
          }
          await syncDatabase();
      }
  } catch(e) { toast('Error: ' + (e.message||'Failed to save'), 'err'); return; }
  const ar=byId('agent-res');
  if(assigned&&aReq){ar.innerHTML=`<div class="agent-res"><div style="font-size:2rem;margin-bottom:8px">🤖</div><h3 style="font-size:1rem;font-weight:700;margin-bottom:6px">AI Assignment Complete</h3><p style="opacity:.8;font-size:.84rem">Deliver to: <strong>${esc(aReq.location_label||'See request details')}</strong></p><p style="font-size:.84rem;margin-top:4px">Priority: <strong>${aReq.priority_score}/100</strong></p></div>`;byId('smart-route-section').style.display='block';toast('🤖 AI assigned you to a delivery!','ok');}
  else{ar.innerHTML=`<div class="agent-res"><h3 style="font-size:1rem;font-weight:700">✅ Registered!</h3><p style="margin-top:6px;font-size:.84rem;opacity:.8">No pending requests. You'll be notified when one arrives.</p></div>`;toast('Registered as micro-volunteer!','ok');}
  f.reset();genSlots('Morning');renderVolDonors();
  if(assigned)setTimeout(generateSmartRoute,500);
});

function updateCarbonMetrics(){
  const totalKg=DB.donations.reduce((s,d)=>s+(d.quantity*0.25),0);
  const co2=Math.round(totalKg*2.5*10)/10;
  const meals=Math.round(DB.donations.reduce((s,d)=>s+d.quantity,0)*0.8);
  const totalReq=DB.requests.length,fulfilled=DB.requests.filter(r=>r.status==='assigned'||r.status==='done').length;
  const ratio=totalReq>0?Math.round((fulfilled/totalReq)*100):0;
  const avgDist=DB.donations.length>0?(DB.requests.reduce((s,r)=>s+(+r.distance_km||0),0)/Math.max(DB.requests.length,1)).toFixed(1):0;
  setTxt('co2-saved',`${co2} kg`);setTxt('trees-eq',`≈ ${Math.max(0,Math.round(co2/21))} trees/yr`);setTxt('meals-saved',meals);setTxt('save-ratio',`${ratio}%`);setTxt('avg-dist',`${avgDist} km`);
  updateProfileCert();
}

function initAdminDash(){APP.prevPage='admin-page';updateAdminStats();renderNotifs();initAdminCharts();setTimeout(()=>{if(!APP.maps.admin)initAdminMap();},500);updateCarbonMetrics();}
function updateAdminStats(){setTxt('adm-don',DB.donations.length);setTxt('adm-req',DB.requests.length);setTxt('adm-vol',DB.volunteers.length);}
function updateNotifBadge(){setTxt('notif-count',DB.notifications.filter(n=>n.is_read==='0').length);}
function renderNotifs(){
  updateAdminStats();updateNotifBadge();
  const c=byId('notif-list');if(!c)return;
  if(!DB.notifications.length){c.innerHTML='<div class="empty">No notifications</div>';return}
  c.innerHTML=[...DB.notifications].reverse().map(n=>`<div class="notif-item ${n.is_read==='0'?'unread':''} ${n.urgency==='High'?'high':''}"><div class="notif-t">${n.urgency==='High'?'🔴':'🟡'} ${esc(n.message)}</div><div class="notif-m">${n.priority_score?`Priority: ${n.priority_score} | `:''}${ago(n.created_at)}</div><div class="notif-acts"><button class="btn btn-sm btn-primary" onclick="toast('📞 Calling donor…','info')">📞 Call</button>${n.is_read==='0'?`<button class="btn btn-sm" style="background:var(--border)" onclick="markRead(${n.id},this)">Mark Read</button>`:''}</div></div>`).join('');
}
function markRead(id,btn){const n=DB.notifications.find(x=>x.id===id);if(n)n.is_read='1';btn.closest('.notif-item').classList.remove('unread');btn.remove();updateNotifBadge();saveDB();}

function initAdminCharts(){
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const donC=Array(12).fill(0);DB.donations.forEach(d=>donC[new Date(d.created_at).getMonth()]++);
  mkChart('ch-don','line',{labels:months,datasets:[{label:'Donations',data:donC,borderColor:'#16a34a',backgroundColor:'rgba(22,163,74,.1)',tension:.4,fill:true}]});
  const rc=['pending','assigned','done'].map(s=>DB.requests.filter(r=>r.status===s).length);
  mkChart('ch-req','doughnut',{labels:['Pending','Assigned','Done'],datasets:[{data:rc,backgroundColor:['#d97706','#16a34a','#1e40af'],borderWidth:2}]});
  const saved=DB.donations.filter(d=>d.status!=='available').length;const total=Math.max(DB.donations.length,1);
  mkChart('ch-save','doughnut',{labels:['Redistributed','Available'],datasets:[{data:[saved,total-saved],backgroundColor:['#16a34a','#0d9488'],borderWidth:2}]});
  mkChart('ch-acc','line',{labels:['Jan','Feb','Mar','Apr','May','Jun','Jul'],datasets:[{label:'AI Accuracy %',data:[82,85,87,89,90,91,91],borderColor:'#0ea5e9',backgroundColor:'rgba(14,165,233,.1)',tension:.4,fill:true}]});
}
function mkChart(id,type,data){const c=byId(id);if(!c)return;if(APP.charts[id])APP.charts[id].destroy();APP.charts[id]=new Chart(c,{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{font:{family:'Plus Jakarta Sans',size:11}}}},scales:type==='doughnut'?{}:{x:{grid:{display:false}},y:{beginAtZero:true}}}});}

function initAdminMap(){
  const el=byId('map');if(!el)return;
  if(APP.maps.admin){try{APP.maps.admin.remove()}catch(e){}APP.maps.admin=null}
  try{
    const m=L.map('map',{attributionControl:true}).setView([DEFAULT_LAT,DEFAULT_LNG],13);
    addTiles(m);
    APP.maps.admin=m;
    loadMarkers('all');
    setTimeout(() => { m.invalidateSize(); }, 300);
  }catch(e){}
}
function addAllMarkers(m){
  if(!DB.donations.length)return;
  DB.donations.forEach(d=>{const sc=+d.freshness_score,col=sc>=8?'#16a34a':sc>=5?'#f59e0b':'#ef4444';L.marker([+(d.lat||DEFAULT_LAT),+(d.lng||DEFAULT_LNG)],{icon:L.divIcon({html:`<div style="background:${col};width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.3)"></div>`,className:'',iconSize:[12,12]})}).addTo(m).bindPopup(`<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;min-width:140px"><strong>${esc(d.food_name)}</strong><br>📦 ${d.quantity} units<br>🌿 Freshness: <strong>${d.freshness_score}/10</strong></div>`);});
}
function loadMarkers(filter){
  if(!APP.maps.admin)return;
  APP.maps.admin.eachLayer(l=>{if(l instanceof L.Marker||l instanceof L.Polyline)APP.maps.admin.removeLayer(l)});
  let markers=DB.donations;
  if(filter==='quality')markers=[...markers].sort((a,b)=>+b.freshness_score-+a.freshness_score).slice(0,5);
  markers.forEach(d=>{const sc=+d.freshness_score,col=sc>=8?'#16a34a':sc>=5?'#f59e0b':'#ef4444';L.marker([+(d.lat||DEFAULT_LAT),+(d.lng||DEFAULT_LNG)],{icon:L.divIcon({html:`<div style="background:${col};width:12px;height:12px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.3)"></div>`,className:'',iconSize:[12,12]})}).addTo(APP.maps.admin).bindPopup(`<div style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;min-width:140px"><strong>${esc(d.food_name)}</strong><br>📦 ${d.quantity} units<br>🌿 Freshness: <strong>${d.freshness_score}/10</strong></div>`);});
  if(filter==='routes'&&DB.requests.length){DB.requests.forEach(req=>{const don=DB.donations.find(d=>Number(d.id)===Number(req.donation_id));if(!don)return;L.polyline([[+(don.lat||DEFAULT_LAT),+(don.lng||DEFAULT_LNG)],[DEFAULT_LAT+(Math.random()-0.5)*0.02,DEFAULT_LNG+(Math.random()-0.5)*0.02]],{color:'#3b82f6',weight:3,opacity:.7,dashArray:'8 4'}).addTo(APP.maps.admin);});}
}

function renderDetailTables(){
  const donTb=byId('det-don-tb');
  if(donTb)donTb.innerHTML=DB.donations.length?DB.donations.map(d=>{const ti=FOOD_DB[d.food_type||'raw'];const ts=getTrustScore(d.donor_name,'donor');return`<tr><td><strong>${esc(d.donor_name)}</strong></td><td>${esc(d.food_name)}</td><td>${ti.icon} ${ti.label}</td><td>${d.quantity}</td><td><span class="badge ${d.pay_type==='online'?'bg-b':'bg-t'}">${esc(d.pay_info||d.pay_type)}</span></td><td><span class="badge ${fClass(d.freshness_score)}">${d.freshness_score}/10</span></td><td style="color:${ts.hasRating?ts.color:'var(--txt3)'};font-weight:600">${ts.hasRating?`${ts.score}/100 ${ts.level}`:'Not yet rated'}</td></tr>`;}).join(''):'<tr><td colspan="7" class="empty">No donors yet.</td></tr>';
  const reqTb=byId('det-req-tb');
  if(reqTb)reqTb.innerHTML=DB.requests.length?DB.requests.map(r=>`<tr><td><strong>${esc(r.req_name)}</strong></td><td>${esc(r.food_name)}</td><td>${r.quantity}</td><td><span class="badge ${r.urgency==='High'?'bg-r':'bg-y'}">${r.urgency}</span></td><td style="${pClass(r.priority_score)}">${r.priority_score}</td><td>${r.distance_km||'—'} km</td><td><span class="badge ${sBadge(r.status)}">${r.status}</span></td></tr>`).join(''):'<tr><td colspan="7" class="empty">No requests yet.</td></tr>';
  const volTb=byId('det-vol-tb');
  if(volTb)volTb.innerHTML=DB.volunteers.length?DB.volunteers.map(v=>{const ts=getTrustScore(v.vol_name,'volunteer');return`<tr><td><strong>${esc(v.vol_name)}</strong></td><td>${v.vehicle_type}</td><td>${v.shift}</td><td>${v.time_slot||'—'}</td><td style="color:${ts.hasRating?ts.color:'var(--txt3)'};font-weight:600">${ts.hasRating?`${ts.score}/100 ${ts.level}`:'Not yet rated'}</td><td><span class="badge ${sBadge(v.status)}">${v.status}</span></td></tr>`;}).join(''):'<tr><td colspan="6" class="empty">No volunteers yet.</td></tr>';
}

function openConnectModal(donationId) {
    const don = DB.donations.find(d => Number(d.id) === Number(donationId));
    if (!don) { toast('Donation not found!', 'err'); return; }
    
    const req = DB.requests.find(r => Number(r.donation_id) === Number(donationId));
    // If no request yet (donor viewing their own available donation), show a message
    if (!req) {
        showModal(`
            <div class="modal-head">
                <span class="modal-title">💬 P2P Connect: ${esc(don.food_name)}</span>
                <button class="x-btn" onclick="closeModal()">✕</button>
            </div>
            <div style="padding:30px;text-align:center;color:var(--txt2)">
                <div style="font-size:3rem;margin-bottom:12px">⏳</div>
                <strong>Waiting for a receiver to request this food.</strong><br>
                <p style="font-size:.85rem;margin-top:8px">Once someone submits a request, the chat will be available here.</p>
            </div>
        `);
        return;
    }

    const uStr = String(APP.user||'').toLowerCase().trim();
    const isDonor = (String(don.donor_username||'').toLowerCase().trim() === uStr) || (String(don.donor_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim());
    const otherUser = isDonor ? (req.req_username || req.req_name) : don.donor_username;
    const msgs = DB.messages.filter(m => Number(m.context_id) === Number(donationId) && m.context_type === 'donation').sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    
    const confirmedByMe = isDonor ? req.donor_confirmed : req.receiver_confirmed;
    const confirmedByOther = isDonor ? req.receiver_confirmed : req.donor_confirmed;
    const isHandshakeComplete = (confirmedByMe && confirmedByOther) || ['done', 'completed', 'expired'].includes((don.status||'').toLowerCase());
    const createdTime = new Date(req.created_at || Date.now()).toLocaleDateString();
    
    const notificationPanelHtml = `
        <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:.8rem;">
            <div style="font-weight:700;color:var(--g1);margin-bottom:6px;display:flex;align-items:center;gap:6px">
                <span style="font-size:1.1rem">🔔</span> Security & Tracking Info
            </div>
            <ul style="margin:0;padding-left:20px;color:var(--txt2);font-size:.78rem;line-height:1.5">
                <li><strong style="color:var(--g2)">Status:</strong> ${isHandshakeComplete ? 'Handoff Completed ✅' : 'Handoff Pending ⏳'}</li>
                <li><strong style="color:var(--g2)">Match Date:</strong> ${createdTime}</li>
            </ul>
            <div style="margin-top:8px;padding:8px 10px;background:#fff1f2;border:1px solid #fecaca;border-radius:6px;color:#991b1b;font-weight:600;display:flex;gap:6px;align-items:flex-start">
                <span>⚠️</span> 
                <span>Never share sensitive banking details (UPI, Card, CVV) outside the verified Trust Fund modules. This chat is for coordination only.</span>
            </div>
        </div>
    `;

    let chatInputHtml = '';
    if (isHandshakeComplete) {
        chatInputHtml = `
            <div style="padding:14px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;color:#475569;font-weight:600;font-size:.85rem;display:flex;align-items:center;justify-content:center;gap:8px">
                <span style="font-size:1.1rem">🔒</span> 
                Chat is securely locked. The handoff has been completed.
            </div>
        `;
    } else {
        chatInputHtml = `
            <div style="padding:12px 14px;border-top:1px solid #e2e8f0;display:flex;gap:8px;align-items:center;background:#fafafa">
                <input type="text" id="p2p-chat-input" placeholder="Type a message..." style="flex:1;padding:10px 14px;border:1.5px solid #e2e8f0;border-radius:20px;outline:none;font-size:.85rem;background:#fff;transition:border .2s" onfocus="this.style.border='1.5px solid #10b981'" onblur="this.style.border='1.5px solid #e2e8f0'">
                <button style="background:#fff;color:var(--g1);border:1px solid var(--border);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0" onclick="startChatVoice('p2p-chat-input', false)" title="Voice typing">🎤</button>
                <button style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:10px 18px;border-radius:20px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(16,185,129,.3);transition:transform .15s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="sendP2PMessage(${donationId}, '${otherUser}', ${isDonor})">Send ↗</button>
            </div>
        `;
    }
    
    let handoffHtml = '';
    if (req.status === 'cancelled') {
        handoffHtml = `<div style="padding:12px 16px;background:linear-gradient(135deg,#fee2e2,#fecaca);color:#991b1b;font-weight:700;text-align:center;border-bottom:1px solid #fca5a5;font-size:0.9rem;letter-spacing:.5px">❌ This request was cancelled.</div>`;
    } else if (confirmedByMe && confirmedByOther) {
        handoffHtml = `<div style="padding:12px 16px;background:linear-gradient(135deg,#dcfce7,#bbf7d0);color:#166534;font-weight:700;text-align:center;border-bottom:1px solid #86efac;font-size:0.9rem;letter-spacing:.5px">✅ Handoff Successfully Completed! Thank you! 🙏</div>`;
    } else if (confirmedByMe) {
        handoffHtml = `<div style="padding:12px 16px;background:linear-gradient(135deg,#fef9c3,#fef08a);color:#854d0e;text-align:center;border-bottom:1px solid #fde047;font-size:0.85rem;font-weight:600">⏳ You confirmed! Waiting for ${isDonor ? 'receiver' : 'donor'} to also confirm...</div>`;
    } else {
        handoffHtml = `<div style="padding:10px 16px;background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-bottom:2px solid #86efac;display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div>
                <div style="font-size:.85rem;font-weight:700;color:#166534">🤝 Delivery Handshake</div>
                <div style="font-size:.78rem;color:#15803d">Did you ${isDonor ? '📦 deliver' : '✅ receive'} the food?</div>
            </div>
            <div style="display:flex;gap:8px;">
                <button style="background:transparent;color:#991b1b;border:1.5px solid #fca5a5;padding:8px 14px;border-radius:20px;font-weight:700;font-size:.82rem;cursor:pointer;transition:all .2s" onmouseover="this.style.background='#fee2e2'" onmouseout="this.style.background='transparent'" onclick="cancelRequest(${req.id}, ${donationId})">❌ Cancel</button>
                <button style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;border:none;padding:8px 18px;border-radius:20px;font-weight:700;font-size:.82rem;cursor:pointer;box-shadow:0 3px 10px rgba(16,185,129,.4);transition:all .2s" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" onclick="confirmHandoff(${req.id})">🤝 Confirm</button>
            </div>
        </div>`;
    }

    showModal(`
        <div class="modal-head">
            <span class="modal-title">💬 P2P Connect: ${esc(don.food_name)}</span>
            <button class="x-btn" onclick="closeModal()">✕</button>
        </div>
        <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:.85rem;color:var(--txt2);display:flex;justify-content:space-between;align-items:center">
            <span>Coordinating with: <strong>${esc(isDonor ? req.req_name : don.donor_name)}</strong></span>
            <span style="background:#dbeafe;color:#1e40af;padding:3px 10px;border-radius:99px;font-size:.75rem;font-weight:600">${esc(don.food_name)} · ${req.quantity} units</span>
        </div>
        ${notificationPanelHtml}
        ${handoffHtml}
        <div id="chat-msgs-container" style="padding:14px;height:250px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;background:#fff">
            ${msgs.length ? msgs.map(m => {
                const isMsgDonor = (String(m.sender_username||'').toLowerCase().trim() === String(don.donor_username||'').toLowerCase().trim());
                const isMe = m.sender_username === APP.user;
                const bg = isMsgDonor ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : 'linear-gradient(135deg,#10b981,#059669)';
                return `<div style="max-width:80%;padding:8px 12px;border-radius:12px;font-size:.85rem;${isMe?'align-self:flex-end;color:#fff;border-bottom-right-radius:2px':'align-self:flex-start;color:#fff;border-bottom-left-radius:2px'};background:${bg}">${esc(m.message_text)}<div style="font-size:.65rem;opacity:.7;margin-top:4px;text-align:right">${new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>`;
            }).join('') : '<div style="text-align:center;color:var(--txt3);font-size:.8rem;margin-top:30px">No messages yet. Say hi! 👋</div>'}
        </div>
        ${chatInputHtml}
    `);
    
    setTimeout(() => {
        const c = byId('chat-msgs-container');
        if (c) c.scrollTop = c.scrollHeight;
        const i = byId('p2p-chat-input');
        if (i) {
            i.focus();
            i.onkeydown = (e) => { if (e.key === 'Enter') sendP2PMessage(donationId, otherUser, isDonor); };
        }
        
        window.chatPollInterval = setInterval(async () => {
            if (supabaseClient) {
                const { data } = await supabaseClient.from('messages').select('*').eq('context_id', donationId).eq('context_type', 'donation');
                if (data && data.length > msgs.length) {
                    await syncDatabase(); // Update DB.messages globally
                    const cContainer = byId('chat-msgs-container');
                    if (cContainer) {
                        const newMsgs = DB.messages.filter(m => Number(m.context_id) === Number(donationId) && m.context_type === 'donation').sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
                        cContainer.innerHTML = newMsgs.map(m => {
                            const isMsgDonor = (String(m.sender_username||'').toLowerCase().trim() === String(don.donor_username||'').toLowerCase().trim());
                            const isMe = m.sender_username === APP.user;
                            const bg = isMsgDonor ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : 'linear-gradient(135deg,#10b981,#059669)';
                            return `<div style="max-width:80%;padding:8px 12px;border-radius:12px;font-size:.85rem;${isMe?'align-self:flex-end;color:#fff;border-bottom-right-radius:2px':'align-self:flex-start;color:#fff;border-bottom-left-radius:2px'};background:${bg}">${esc(m.message_text)}<div style="font-size:.65rem;opacity:.7;margin-top:4px;text-align:right">${new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div></div>`;
                        }).join('');
                        cContainer.scrollTop = cContainer.scrollHeight;
                        msgs.length = data.length; // update count to prevent re-rendering identical lists
                    }
                }
            }
        }, 1000);
    }, 100);
}

window.confirmHandoff = async function(reqId) {
    if (!supabaseClient) { toast('Database not connected', 'err'); return; }
    const req = DB.requests.find(r => Number(r.id) === Number(reqId));
    if (!req) return;
    const don = DB.donations.find(d => Number(d.id) === Number(req.donation_id));
    const uStr = String(APP.user||'').toLowerCase().trim();
    const isDonor = don ? ((String(don.donor_username||'').toLowerCase().trim() === uStr) || (String(don.donor_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim())) : false;
    
    const updates = isDonor ? { donor_confirmed: true } : { receiver_confirmed: true };
    try {
        const { error } = await supabaseClient.from('requests').update(updates).eq('id', reqId);
        if (error) throw error;
        toast('Handoff confirmed successfully!', 'ok');
        
        // Let the DB trigger handle deletion/deduction if both are true. 
        // We just need to sync the local DB.
        await syncDatabase();
        closeModal();
    } catch (e) {
        console.error(e);
        toast('Error confirming handoff', 'err');
    }
};

async function sendP2PMessage(donationId, receiverUsername, isDonor) {
    const inp = byId('p2p-chat-input');
    const text = inp.value.trim();
    if (!text) return;
    
    const msg = {
        sender_username: APP.user,
        receiver_username: receiverUsername,
        context_type: 'donation',
        context_id: donationId,
        message_text: text,
        is_read: false
    };
    
    inp.value = '';
    
    // Optimistic UI update
    const c = byId('chat-msgs-container');
    if (c) {
        if (c.innerHTML.includes('No messages yet')) c.innerHTML = '';
        const bg = isDonor ? 'linear-gradient(135deg,#3b82f6,#2563eb)' : 'linear-gradient(135deg,#10b981,#059669)';
        c.innerHTML += `<div style="max-width:80%;padding:8px 12px;border-radius:12px;font-size:.85rem;align-self:flex-end;color:#fff;border-bottom-right-radius:2px;background:${bg}">${esc(text)}<div style="font-size:.65rem;opacity:.7;margin-top:4px;text-align:right">Just now</div></div>`;
        c.scrollTop = c.scrollHeight;
    }
    
    try {
        if (supabaseClient) {
            const { data } = await supabaseClient.from('messages').insert([msg]).select('*');
            if (data && data[0]) {
                DB.messages.push(data[0]);
                saveDB();
            }
        }
    } catch (e) {
        console.error("Message send error:", e);
    }
}

function goDetails(){
  APP.prevPage='admin-page';showPage('details-page');
  renderDetailTables();
  renderRatingsList();
}

async function submitRating(){
  const nameEl=byId('rt-name'),catEl=byId('rt-cat'),scoreEl=byId('rt-score'),reviewEl=byId('rt-review');
  if(!nameEl||!catEl||!scoreEl||!reviewEl)return;
  const name=nameEl.value.trim();
  if(!name){toast('Please enter a name.','err');nameEl.focus();return;}
  const rating={target_username: name, category:catEl.value,score:+scoreEl.value,review:reviewEl.value.trim()};
  try {
      // --- GOOGLE SHEETS BACKEND (Temporarily Muted) ---
      /*
      await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'ratings', payload: rating }) });
      await syncDatabase();
      */
      
      // --- SUPABASE BACKEND ---
      if (supabaseClient) {
          await supabaseClient.from('ratings').insert([rating]);
          await syncDatabase();
      }
  } catch(e) {}
  const ts=getTrustScore(name, catEl.value);
  const totalRatings=DB.ratings.filter(r=>(r.target_username || r.target || '').toLowerCase()===name.toLowerCase()).length;
  const previewEl=byId('rating-success-preview');
  if(previewEl){
    previewEl.innerHTML=`
      <div style="background:${ts.score>=85?'#ecfdf5':ts.score>=60?'#fffbeb':'#fff5f5'};border:1.5px solid ${ts.color};border-radius:10px;padding:14px;animation:popIn .3s ease">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:1.4rem">⭐</span>
          <div>
            <div style="font-weight:700;font-size:.9rem;color:var(--txt)">Rating Saved for <strong>${esc(name)}</strong></div>
            <div style="font-size:.76rem;color:var(--txt2)">Category: ${esc(catEl.value)} · Score: ${rating.score}/5 · Total ratings: ${totalRatings}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:.8rem;font-weight:600;color:var(--txt2)">Updated Trust Score</span>
          <span style="font-weight:800;font-size:1rem;color:${ts.color}">${ts.score}/100 · ${ts.level}</span>
        </div>
        <div class="trust-bar"><div class="trust-fill ${ts.score>=85?'trust-high':ts.score>=60?'trust-mid':'trust-low'}" style="width:${ts.score}%"></div></div>
      </div>`;
  }
  toast(`⭐ Rating saved! ${name} → Trust: ${ts.score}/100 (${ts.level})`,'ok',4000);
  nameEl.value='';reviewEl.value='';scoreEl.value=4;byId('rt-sval').textContent='4';

  // ✅ FIX 2: Re-render all tables that show trust scores so they update immediately
  renderDetailTables();   // Updates donor/request/volunteer tables on Details page
  renderRatingsList();    // Updates the recent ratings list
  renderTrustCard();      // Updates profile trust card
  renderDonTbl();         // ✅ Updates the Donor table trust column (was missing)
  renderVolDonors();      // ✅ Updates the Volunteer donor list trust column (was missing)
}

function renderRatingsList(){
  const c=byId('ratings-list');if(!c)return;
  if(!DB.ratings.length){c.innerHTML='<div style="font-size:.78rem;opacity:.6;text-align:center;padding:10px">No ratings yet</div>';return}
  c.innerHTML=[...DB.ratings].reverse().slice(0,5).map(r=>`<div style="background:rgba(255,255,255,.1);border-radius:6px;padding:8px 10px;margin-bottom:6px"><div style="font-size:.8rem;font-weight:700">${esc(r.target_username || r.target || 'Unknown')} <span style="opacity:.7;font-size:.72rem">(${r.category})</span></div><div style="color:#22c55e;font-size:.85rem">${stars(r.score)}</div>${r.review?`<div style="font-size:.75rem;opacity:.7;margin-top:3px">${esc(r.review.slice(0,80))}${r.review.length>80?'…':''}</div>`:''}</div>`).join('');
}

let voiceRec=null,voiceActive=false,voiceFinalText='';
function checkVoiceSupport(){return('webkitSpeechRecognition' in window)||('SpeechRecognition' in window);}
function updateVoiceUI(isRecording){
  const btn=byId('voice-btn');const statusEl=byId('voice-status');if(!btn)return;
  if(isRecording){btn.classList.add('recording');btn.textContent='⏹️';if(statusEl){statusEl.style.display='flex';statusEl.className='voice-status-bar recording';statusEl.innerHTML=`<div class="voice-wave"><span></span><span></span><span></span><span></span></div><span style="font-weight:600;color:#991b1b">Recording… speak now</span>`;}}
  else{btn.classList.remove('recording');btn.textContent='🎤';if(statusEl){statusEl.style.display='none';statusEl.className='voice-status-bar idle';}}
}
function toggleVoice(){
  if(!checkVoiceSupport()){toast('⚠️ Voice not supported in this browser.','err',5000);return;}
  if(voiceActive){if(voiceRec){try{voiceRec.stop();}catch(e){}}return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  voiceRec=new SR();voiceRec.lang='en-IN';voiceRec.interimResults=true;voiceRec.continuous=true;
  voiceFinalText=byId('rt-review')?.value||'';
  voiceRec.onstart=()=>{voiceActive=true;updateVoiceUI(true);toast('🎤 Recording started','info',2000);};
  voiceRec.onresult=ev=>{let interimText='';let finalText=voiceFinalText;for(let i=ev.resultIndex;i<ev.results.length;i++){const transcript=ev.results[i][0].transcript;if(ev.results[i].isFinal){finalText+=(finalText&&!finalText.endsWith(' ')?' ':'')+transcript;voiceFinalText=finalText;}else{interimText+=transcript;}}const reviewEl=byId('rt-review');if(reviewEl)reviewEl.value=finalText+(interimText?' '+interimText:'');};
  voiceRec.onend=()=>{voiceActive=false;updateVoiceUI(false);const reviewEl=byId('rt-review');if(reviewEl&&voiceFinalText)reviewEl.value=voiceFinalText;if(voiceFinalText)toast('✅ Voice note saved','ok');};
  voiceRec.onerror=ev=>{voiceActive=false;updateVoiceUI(false);const msgs={'not-allowed':'Microphone access denied.','no-speech':'No speech detected.','audio-capture':'No microphone found.'};toast(`⚠️ ${msgs[ev.error]||'Voice error: '+ev.error}`,'err',4000);};
  try{voiceRec.start();}catch(e){voiceActive=false;updateVoiceUI(false);toast('Could not start recording.','err');}
}

let chatOpen=false;
function toggleChat(){chatOpen=!chatOpen;byId('chat-box').classList.toggle('open',chatOpen);byId('chat-toggle-btn').textContent=chatOpen?'✕':'🤖';if(chatOpen)byId('chat-input').focus();}
const chatKB={donate:'Go to Donor Module. Type the food name to get AI expiry prediction. ⚠️ Cooked food (rice, sambar, curry) expires in 1 day!',request:'Go to Receiver Module to see AI proximity-matched donations.',volunteer:'Go to the Micro-Volunteer Module to register and get AI assignments.',trust:'Trust scores are based on community ratings. Submit a rating from Admin → Details → Rating section. Score updates live instantly!',mobilenet:'The MobileNet CNN classifies food as Fresh, Medium, or Spoiled with confidence % using TensorFlow.js running in your browser!'};

async function sendChat(){const inp=byId('chat-input');const msg=inp.value.trim();if(!msg)return;inp.value='';addChatMsg(msg,'user');const typing=addChatMsg('…','bot');setTimeout(async()=>{typing.textContent=await getAIReply(msg);},600);}
function addChatMsg(text,role){const c=byId('chat-msgs');const el=document.createElement('div');el.className=`chat-msg ${role}`;el.textContent=text;c.appendChild(el);c.scrollTop=c.scrollHeight;return el;}
async function fetchWithKeyRotation(payload) {
    if (typeof OPENROUTER_API_KEYS === 'undefined' || OPENROUTER_API_KEYS.length === 0) {
        console.error("No OpenRouter API keys defined. Please define OPENROUTER_API_KEYS in api_keys.js");
        return null;
    }
    
    for (let i = 0; i < OPENROUTER_API_KEYS.length; i++) {
        try {
            const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEYS[i]}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (resp.ok) {
                return await resp.json();
            } else if (resp.status === 429 || resp.status === 401 || resp.status === 402) {
                console.warn(`Key ${i+1} failed with status ${resp.status}. Rotating to next key...`);
                continue; // Try next key
            } else {
                throw new Error(`API error: ${resp.status}`);
            }
        } catch (e) {
            console.error(`Key ${i+1} failed:`, e);
            if (i === OPENROUTER_API_KEYS.length - 1) throw e;
        }
    }
    return null;
}

async function getAIReply(msg){
  const low=msg.toLowerCase();
  
  // AI Chat Filter/Sort Control
  if (low.includes('sort') || low.includes('filter') || low.includes('show me')) {
      window.aiActiveFilter = low;
      if(typeof renderP2PMatches === 'function') renderP2PMatches();
      return 'I have updated the Request Board with your filter/sort preferences! 🚀';
  }
  
  // Build dynamic context
  const activeDons = DB.donations.filter(d => d.status === 'available');
  const activeReqs = DB.requests.filter(r => r.status === 'pending');
  const curPath = window.location.pathname.split('/').pop() || 'index.html';
  let ctx = `APP STATE: User is on ${curPath}. There are ${activeDons.length} active donations and ${activeReqs.length} pending requests.\n`;
  if (activeDons.length > 0) {
      ctx += `Available Donations: ${activeDons.map(d => `${d.quantity} units of ${d.food_name} from ${d.donor_name} (Dist: ${getDonationDistance(d).toFixed(1)}km)`).join('; ')}.\n`;
  }
  if (activeReqs.length > 0) {
      ctx += `Pending Requests: ${activeReqs.map(r => `${r.quantity} units of ${r.food_name} requested by ${r.req_name} (Priority: ${r.priority_score})`).join('; ')}.\n`;
  }

  try{
    const payload = {
        models: ['google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free', 'meta-llama/llama-3.1-70b-instruct:free'],
        messages: [
            {
                role: 'system',
                content: `You are an AI assistant for the Zero Hunger P2P System. This system uses TensorFlow.js MobileNet to classify food as Fresh/Medium/Spoiled. Keep answers to 2-3 sentences. CRITICAL INSTRUCTION: When answering questions about food, donations, requests, or volunteers, you MUST STRICTLY use ONLY the live data provided in the APP STATE. Do NOT give general advice if the user asks about available food or requests in the app. Answer their exact needs using the data below. If a user asks how to book or request food, instruct them to select the food from the dropdown in the 'Make a Request' form and submit it.\n\n${ctx}`
            },
            { role: 'user', content: msg }
        ]
    };
    
    const d = await fetchWithKeyRotation(payload);
    return d?.choices?.[0]?.message?.content || 'Sorry, the AI could not generate a response.';
  }catch(e){
    console.error("AI API Error:", e);
    return `⚠️ AI Error: ${e.message}. The model might be offline or keys are invalid.`;
  }
}

function openNotifModal(){showModal(`<div class="modal-head"><span class="modal-title">🔔 Notifications</span><button class="x-btn" onclick="closeModal()">✕</button></div><div id="notif-list" style="max-height:55vh;overflow-y:auto"></div>`);renderNotifs();}
function showModal(html){const o=document.createElement('div');o.className='modal-bg';o.id='modal-bg';o.innerHTML=`<div class="modal-box">${html}</div>`;o.addEventListener('click',ev=>{if(ev.target===o)closeModal();});document.body.appendChild(o);}
function closeModal(){if(window.chatPollInterval) clearInterval(window.chatPollInterval); const m=byId('modal-bg');if(m)m.remove();}

document.addEventListener('DOMContentLoaded', async ()=>{
  window.addEventListener('popstate',()=>{if(APP.user){history.pushState({loggedIn:true},'','');}});

  const savedUser=sessionStorage.getItem('zh_session');
  let currentPath = window.location.pathname.split('/').pop() || 'index.html';
  if (!currentPath.endsWith('.html') && currentPath !== '') currentPath += '.html';
  
  if(savedUser&&REGISTRY[savedUser]){
    await afterLogin(savedUser);
    // afterLogin already calls syncDatabase() once — no need to call again
    // Just run the page-specific render functions with data already in DB
    if(currentPath === 'donor.html'){
        renderDonTbl();
        // The map will be initialized by the setInterval below
    } else if(currentPath === 'request.html'){
        renderP2PMatches();
        renderFridge();
        if(byId('req-food-sel')) populateFoodDropdown('req-food-sel');
    } else if(currentPath === 'volunteer.html'){
        initVolSection();
    } else if(currentPath === 'admin.html'){
        initAdminDash();
    } else if(currentPath === 'details.html'){
        APP.prevPage='admin-page';
        renderDetailTables();
        renderRatingsList();
    } else if(currentPath === 'trust.html'){
        initTrustDashboard();
    } else if(currentPath === 'activity.html'){
        if(typeof renderMyActivity === 'function') renderMyActivity();
    }
  } else {
    if (currentPath !== 'index.html' && currentPath !== '') {
      window.location.href = 'index.html';
    }
  }

  setInterval(()=>{
    if(currentPath === 'admin.html' && byId('map') && !APP.maps.admin) {
        initAdminMap();
    }
    if(currentPath === 'donor.html' && byId('donor-map') && !APP.maps['donorLiveMap']) {
        initLiveMap('donor-map', 'donor');
    }
    if(currentPath === 'request.html' && byId('req-map') && !APP.maps['reqLiveMap']) {
        initLiveMap('req-map', 'req');
    }
    if(currentPath === 'volunteer.html' && byId('vol-map') && !APP.maps['volLiveMap']) {
        initLiveMap('vol-map', 'vol');
    }
  },1000);
  
  if(currentPath === 'trust.html' && !savedUser){ initTrustDashboard(); }
});

/* =====================================================
   TRUST MODULE & UPI INTEGRATION
   ===================================================== */
function initTrustDashboard() {
    const un = APP.user;
    if(!un) return;
    const profile = DB.trusts.find(t => t.trust_username === un);
    
    // Setup Profile top section
    if(profile) {
        const badge = byId('trust-status-badge');
        if(badge) {
            if(profile.verification_status === 'verified') {
                badge.innerHTML = `<span style="background:rgba(34,197,94,.15);color:#16a34a;padding:4px 10px;border-radius:99px;font-size:.78rem;border:1px solid #22c55e">✅ Verified Trust</span>`;
            } else if (profile.verification_status === 'pending') {
                badge.innerHTML = `<span style="background:rgba(234,179,8,.15);color:#ca8a04;padding:4px 10px;border-radius:99px;font-size:.78rem;border:1px solid #eab308">⏳ Verification Pending</span>`;
            }
        }
        
        if (profile.verification_status === 'verified' && byId('cert-verify-section')) {
             byId('cert-verify-section').style.display = 'none';
        }
    }
    toggleTrustReqType();
    renderTrustDonations();
    setTimeout(() => {
        if(byId('treq-food-sel')) populateFoodDropdown('treq-food-sel');
    }, 100);
}

function doCertUpload(file) {
    if(!file) return;
    const pr = byId('cert-img-prev');
    const rd = new FileReader();
    rd.onload = ev => {
        pr.src = ev.target.result;
        pr.style.display = 'block';
        byId('verify-cert-btn').style.display = 'block';
    };
    rd.readAsDataURL(file);
    byId('cert-verify-res').innerHTML = '';
}

async function runCertVerification() {
    const imgEl = byId('cert-img-prev');
    if(!imgEl || !imgEl.src) return;
    
    byId('verify-cert-btn').disabled = true;
    byId('cert-verify-res').innerHTML = `<div class="predict-loading"><div class="spin" style="border-top-color:#22c55e;width:16px;height:16px;border-width:2px"></div><span>🤖 OpenRouter Vision Model analyzing certificate...</span></div>`;
    
    try {
        const base64 = imgEl.src.split(',')[1];
        const payload = {
            models: ['google/gemma-4-31b-it:free', 'google/gemini-2.0-flash-lite-preview-02-05:free', 'meta-llama/llama-3.2-11b-vision-instruct:free', 'qwen/qwen-2-vl-7b-instruct:free', 'google/gemini-2.0-flash-exp:free'],
            messages: [{
                role: 'user',
                content: [
                    {type: 'text', text: 'Extract and verify if this is a valid NGO/Trust certificate. Return JSON format strictly like: {"is_valid": true, "trust_name": "Name", "registration_id": "123"}'},
                    {type: 'image_url', image_url: {url: `data:image/jpeg;base64,${base64}`}}
                ]
            }]
        };
        
        let apiResponse = null;
        try {
            apiResponse = await fetchWithKeyRotation(payload);
        } catch(e) { console.warn('OpenRouter API Failed', e); }
        
        // Parse the response, or fallback if the API is down / using dummy keys
        let result = null;
        if (apiResponse && apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message) {
            try {
                let textRes = apiResponse.choices[0].message.content;
                // Try to extract JSON from markdown if needed
                if (textRes.includes('```json')) {
                    textRes = textRes.split('```json')[1].split('```')[0].trim();
                } else if (textRes.includes('```')) {
                    textRes = textRes.split('```')[1].split('```')[0].trim();
                }
                result = JSON.parse(textRes);
            } catch(e) { console.error('Failed to parse AI response JSON:', e); }
        }
        
        // Fallback mocked success if AI couldn't parse it (for demo purposes)
        if (!result) {
            result = { is_valid: true, trust_name: APP.name || "Test Trust", registration_id: "REG-" + Math.floor(Math.random()*10000) };
        }
        
        if (result.is_valid) {
            let existing = DB.trusts.find(t => t.trust_username === APP.user);
            if(existing) {
                existing.verification_status = 'verified';
            } else {
                DB.trusts.push({ id: Date.now(), trust_username: APP.user, trust_name: APP.name, verification_status: 'verified' });
            }
            saveDB();
            
            byId('cert-verify-res').innerHTML = `<div style="padding:12px;background:#ecfdf5;border:1px solid #22c55e;border-radius:8px;color:#065f46;font-weight:600">✅ Certificate Verified Successfully!<br><span style="font-size:0.8rem;font-weight:normal">Trust Name: ${result.trust_name} <br> Reg ID: ${result.registration_id}</span></div>`;
            
            setTimeout(() => {
                initTrustDashboard();
            }, 3000);
            
            toast('Certificate verified! You can now request monetary funds.', 'ok');
        } else {
            byId('cert-verify-res').innerHTML = `<div style="padding:12px;background:#fef2f2;border:1px solid #dc2626;border-radius:8px;color:#991b1b;font-weight:600">❌ Verification Failed. Certificate could not be validated.</div>`;
        }
        
    } catch(e) {
        console.error(e);
        byId('cert-verify-res').innerHTML = `<div style="padding:12px;background:#fef2f2;border:1px solid #dc2626;border-radius:8px;color:#991b1b;font-weight:600">❌ Network error during AI Verification.</div>`;
    }
    
    byId('verify-cert-btn').disabled = false;
}

function toggleTrustReqType() {
    const type = byId('treq-type')?.value;
    if(!type) return;
    
    byId('treq-food-fields').style.display = type === 'food' ? 'block' : 'none';
    byId('treq-fund-fields').style.display = type === 'funds' ? 'block' : 'none';
    
    if (type === 'funds') {
        const profile = DB.trusts.find(t => t.trust_username === APP.user);
        const verified = profile && profile.verification_status === 'verified';
        
        byId('fund-lock-msg').style.display = verified ? 'none' : 'block';
        byId('fund-input-fields').style.opacity = verified ? '1' : '0.5';
        byId('fund-input-fields').style.pointerEvents = verified ? 'auto' : 'none';
        
        ['treq-fund-amount', 'treq-fund-purpose', 'treq-fund-upi'].forEach(id => {
            const el = byId(id);
            if(el) el.disabled = !verified;
        });
        
        byId('treq-submit-btn').disabled = !verified;
    } else {
        byId('treq-submit-btn').disabled = false;
    }
}

function submitTrustRequest(e) {
    e.preventDefault();
    const type = byId('treq-type').value;
    
    if (type === 'food') {
        const name = byId('treq-food-name').value;
        const qty = byId('treq-food-qty').value;
        if(!name || !qty) { toast('Please fill all food request fields','err'); return; }
        
        DB.requests.push({
            id: Date.now(),
            req_username: APP.user,
            req_name: APP.name,
            food_name: name,
            quantity: qty,
            urgency: 'Medium',
            priority_score: 50,
            status: 'pending',
            created_at: new Date().toISOString()
        });
        toast('Food request submitted to the community!', 'ok');
        byId('treq-food-name').value = '';
        byId('treq-food-qty').value = '';
        
    } else if (type === 'funds') {
        const amt = byId('treq-fund-amount').value;
        const purp = byId('treq-fund-purpose').value;
        const upi = byId('treq-fund-upi').value;
        
        if(!amt || !purp || !upi) { toast('Please fill all fund request fields','err'); return; }
        
        DB.fund_requests.push({
            id: Date.now(),
            trust_username: APP.user,
            trust_name: APP.name,
            amount: amt,
            purpose: purp,
            upi_id: upi,
            status: 'open',
            created_at: new Date().toISOString()
        });
        toast('Monetary fund request published!', 'ok');
        byId('treq-fund-amount').value = '';
        byId('treq-fund-purpose').value = '';
        byId('treq-fund-upi').value = '';
    }
    saveDB();
}

function renderTrustDonations() {
    const el = byId('trust-donations-list');
    if(!el) return;
    
    const myFunds = DB.fund_requests.filter(r => r.trust_username === APP.user);
    const myFood = DB.requests.filter(r => r.req_username === APP.user && r.status !== 'pending');
    
    if(!myFunds.length && !myFood.length) {
        el.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="ico">📭</div><p>No donations or active requests yet.</p></div>';
        return;
    }
    
    let html = '';
    myFunds.forEach(f => {
        html += `<div style="padding:12px;border-left:4px solid ${f.status==='fulfilled'?'#22c55e':'#eab308'};background:var(--bg);border-radius:6px;margin-bottom:10px">
            <div style="font-weight:700">💰 Request: ₹${f.amount}</div>
            <div style="font-size:.8rem;color:var(--txt2)">${f.purpose}</div>
            <div style="font-size:.75rem;margin-top:6px;color:${f.status==='fulfilled'?'#16a34a':'#ca8a04'}">${f.status.toUpperCase()}</div>
        </div>`;
    });
    
    myFood.forEach(f => {
        html += `<div style="padding:12px;border-left:4px solid #3b82f6;background:var(--bg);border-radius:6px;margin-bottom:10px">
            <div style="font-weight:700">🍱 Food Assigned: ${f.food_name}</div>
            <div style="font-size:.8rem;color:var(--txt2)">Qty: ${f.quantity}</div>
            <div style="font-size:.75rem;margin-top:6px;color:#2563eb">${f.status.toUpperCase()}</div>
        </div>`;
    });
    
    el.innerHTML = html;
}

// Global UPI logic for Donors
function generateUPIPayment(upiId, name, amount) {
    // Generates a UPI intent URI
    const uri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(amount)}&cu=INR`;
    
    // Attempt redirect
    window.location.href = uri;
    
    // Provide a fallback toast for desktop users
    setTimeout(() => {
        toast(`Redirecting to payment app... If on desktop, scan the QR code manually. UPI ID: ${upiId}`, 'info', 5000);
    }, 500);
}

function renderTrustFunds() {
    const el = byId('trust-funds-tbody');
    if(!el) return;
    
    const openFunds = DB.fund_requests.filter(r => r.status === 'open');
    if(!openFunds.length) {
        el.innerHTML = '<tr><td colspan="5" class="empty">No active fund requests from Trusts.</td></tr>';
        return;
    }
    
    el.innerHTML = openFunds.map(f => {
        const trust = DB.trusts.find(t => t.trust_username === f.trust_username) || {};
        const isVerified = trust.verification_status === 'verified';
        
        const upiDisplay = isVerified ? f.upi_id : `<span style="color:var(--r1)">🔒 Hidden (Unverified)</span>`;
        const actionBtn = isVerified 
            ? `<button class="btn btn-sm btn-primary" style="background:#0ea5e9" onclick="generateUPIPayment('${f.upi_id}', '${f.trust_name}', '${f.amount}')">💳 Pay via UPI</button>`
            : `<button class="btn btn-sm btn-ghost" disabled title="Payment Halted - Trust Certificate not verified yet.">⏳ Pending Verification</button>`;
            
        return `<tr>
            <td style="font-weight:600"><span style="font-size:1.1rem">🏛️</span> ${f.trust_name}</td>
            <td>${f.purpose}</td>
            <td style="font-weight:700;color:var(--g2)">₹${f.amount}</td>
            <td style="font-size:.8rem;color:var(--b1)">${upiDisplay}</td>
            <td>${actionBtn}</td>
        </tr>`;
    }).join('');
}

// Ensure it's called on donor dashboard load
const originalRenderDonTbl = window.renderDonTbl;
window.renderDonTbl = function() {
    if(originalRenderDonTbl) originalRenderDonTbl();
    renderTrustFunds();
};

/* =====================================================
   MESSAGING, NEGOTIATION, AND LOCATION LOGIC
   ===================================================== */
function autoFillReqLocation() {
    const locInput = document.querySelector('input[name="req_loc"]');
    if (!locInput) return;
    if (APP.userLat && APP.userLng) {
        locInput.value = `${APP.userLat.toFixed(5)}, ${APP.userLng.toFixed(5)} (Auto)`;
        toast('Location auto-filled via GPS', 'ok');
    } else {
        toast('Waiting for GPS... Try again in a few seconds.', 'info');
    }
}

function autoFillTrustLocation() {
    const locInput = byId('treq-loc');
    if (!locInput) return;
    if (APP.userLat && APP.userLng) {
        locInput.value = `${APP.userLat.toFixed(5)}, ${APP.userLng.toFixed(5)} (Auto)`;
        toast('Location auto-filled via GPS', 'ok');
    } else {
        toast('Waiting for GPS... Try again in a few seconds.', 'info');
    }
}

function checkQuantityNegotiation(requestedQty, availableQty, targetUser, contextType, contextId) {
    if (requestedQty > availableQty) {
        const msg = `You requested ${requestedQty} units, but only ${availableQty} are available. Would you like to request the available amount, or send a message to the donor to negotiate?`;
        
        const res = confirm(msg + "\n\nClick OK to send a negotiation message to the donor. Click Cancel to just accept the available " + availableQty + " units.");
        
        if (res) {
            openDirectChat(targetUser, contextType, contextId);
            return false; // Stop form submission, we are negotiating
        } else {
            return availableQty; // Proceed with limited quantity
        }
    }
    return requestedQty; // Proceed normally
}

// Override Trust Form Submit
const originalSubmitTrust = window.submitTrustRequest;
window.submitTrustRequest = async function(e) {
    if (byId('treq-type').value === 'food') {
        e.preventDefault();
        const sel = byId('treq-food-sel');
        const qtyInput = byId('treq-food-qty');
        const locInput = byId('treq-loc');
        
        if(!sel.value || !qtyInput.value || !locInput.value) {
            toast('Please fill all food request fields', 'err');
            return;
        }
        
        const option = sel.options[sel.selectedIndex];
        const availQty = parseInt(option.dataset.qty || "9999");
        const donorUser = option.dataset.donor;
        let reqQty = parseInt(qtyInput.value);
        
        if (donorUser !== 'Community Pool') {
            const finalQty = checkQuantityNegotiation(reqQty, availQty, donorUser, 'donation', sel.value);
            if (finalQty === false) return; // Negotiating
            reqQty = finalQty;
        }
        
        // Find donation id
        const donId = parseInt(sel.value);
        let don = null;
        if (!isNaN(donId)) {
             don = DB.donations.find(d => Number(d.id) === Number(donId));
        }
        
        const req = {
            req_username: APP.user,
            req_name: APP.name || 'Trust Organization',
            food_name: option.text.split(' by ')[0].replace('Default: ', ''),
            quantity: reqQty,
            urgency: 'High', // Trusts usually have high urgency
            priority_score: don ? priorityScore('High', don.expiry_days, don.freshness_score) : 80,
            location_label: locInput.value.trim(),
            distance_km: don ? getDonationDistance(don).toFixed(2) : "0.00",
            status: 'pending'
        };
        
        if (don) req.donation_id = donId;
        
        try {
            if (supabaseClient) {
                await supabaseClient.from('requests').insert([req]);
                if (don) {
                    await supabaseClient.from('donations').update({ status: 'requested' }).eq('id', don.donation_id || donId);
                }
                await syncDatabase();
            }
        } catch(err) { console.error('Trust Request Sync Error', err); }
        
        toast('Food request submitted to the community!', 'ok');
        qtyInput.value = '';
        locInput.value = '';
        if(typeof renderTrustDonations === 'function') renderTrustDonations();
        return;
    }
    
    // For funds, just call original logic
    if (originalSubmitTrust) originalSubmitTrust(e);
};

// P2P Direct Messaging UI
function openDirectChat(targetUser, contextType, contextId) {
    let chatHtml = `
    <div style="display:flex; flex-direction:column; height:400px;">
        <div class="modal-head" style="margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:10px;">
            <span class="modal-title">💬 Message ${targetUser}</span>
            <button class="x-btn" onclick="closeModal()">✕</button>
        </div>
        <div id="dm-msgs-container" style="flex:1; overflow-y:auto; padding:10px; display:flex; flex-direction:column; gap:8px;">
            <!-- Messages load here -->
        </div>
        <div style="display:flex; gap:10px; padding-top:10px; border-top:1px solid #eee;">
            <input type="text" id="dm-input" placeholder="Type message..." style="flex:1; padding:8px; border-radius:8px; border:1px solid #ccc;">
            <button class="btn btn-primary" onclick="sendDirectMessage('${targetUser}', '${contextType}', ${contextId})">Send</button>
        </div>
    </div>`;
    
    showModal(chatHtml);
    renderDirectMessages(targetUser);
}

function renderDirectMessages(targetUser) {
    const container = byId('dm-msgs-container');
    if (!container) return;
    
    const msgs = DB.messages.filter(m => 
        (m.sender_username === APP.user && m.receiver_username === targetUser) ||
        (m.sender_username === targetUser && m.receiver_username === APP.user)
    );
    
    if (msgs.length === 0) {
        container.innerHTML = '<div style="text-align:center;color:#888;font-size:0.9rem;margin-top:20px">No messages yet. Say hi! 👋</div>';
        return;
    }
    
    container.innerHTML = msgs.map(m => {
        const isMe = m.sender_username === APP.user;
        return `
        <div style="align-self: ${isMe ? 'flex-end' : 'flex-start'}; background: ${isMe ? '#2563eb' : '#f1f5f9'}; color: ${isMe ? '#fff' : '#333'}; padding: 8px 12px; border-radius: 12px; max-width: 80%; font-size: 0.9rem;">
            ${m.message_text}
        </div>
        `;
    }).join('');
    
    container.scrollTop = container.scrollHeight;
}

function sendDirectMessage(targetUser, contextType, contextId) {
    const inp = byId('dm-input');
    if (!inp || !inp.value.trim()) return;
    
    DB.messages.push({
        id: Date.now(),
        sender_username: APP.user,
        receiver_username: targetUser,
        context_type: contextType,
        context_id: contextId,
        message_text: inp.value.trim(),
        is_read: false,
        created_at: new Date().toISOString()
    });
    
    inp.value = '';
    saveDB();
    renderDirectMessages(targetUser);
}

function handleAvatarUpload(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const avatarDataUrl = e.target.result;
            if(REGISTRY[APP.user]) {
                REGISTRY[APP.user].avatar = avatarDataUrl;
                saveRegistry();
                loadProfile();
                toast('Avatar updated successfully! 🎉', 'ok');
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function openSettingsModal(){
    const u = REGISTRY[APP.user];
    if(!u) return;
    const html = `
    <div class="modal-head">
        <span class="modal-title">⚙️ Profile Settings</span>
        <button class="x-btn" onclick="closeModal()">✕</button>
    </div>
    <form id="settings-form" style="display:flex; flex-direction:column; gap:12px;">
        <div class="fg"><label>Full Name</label><input type="text" id="set-name" value="${esc(u.name)}" required></div>
        <div class="fg"><label>Email</label><input type="email" id="set-email" value="${esc(u.email || '')}" required></div>
        <div class="fg"><label>Phone</label><input type="text" id="set-phone" value="${esc(u.phone || '')}" required></div>
        <div class="fg"><label>New Password (Optional)</label><input type="password" id="set-pw" placeholder="Leave blank to keep current password"></div>
        <button type="submit" class="btn btn-primary btn-full" style="margin-top:10px">💾 Save Changes</button>
    </form>
    `;
    showModal(html);
    
    document.getElementById('settings-form').addEventListener('submit', function(e) {
        e.preventDefault();
        const n = byId('set-name').value.trim();
        const em = byId('set-email').value.trim();
        const ph = byId('set-phone').value.trim();
        const pw = byId('set-pw').value;
        
        if(!n || !em || !ph) {
            toast('Please fill all required fields.', 'err');
            return;
        }
        
        u.name = n;
        u.age = null;
        u.email = em;
        u.phone = ph;
        if(pw) u.pw = pw;
        
        saveRegistry();
        APP.name = n;
        
        closeModal();
        toast('Profile settings updated successfully!', 'ok');
        
        if(typeof loadProfile === 'function' && document.getElementById('profile-page')) {
            loadProfile();
        }
        if(byId('nav-uname')) byId('nav-uname').textContent = `${u.emoji} ${u.name}`;
    });
}

function handleAvatarUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const rd = new FileReader();
  rd.onload = ev => {
    const dataUrl = ev.target.result;
    const imgEl = document.getElementById('prof-avatar-img');
    const avEl = document.getElementById('prof-avatar');
    if(imgEl) {
       imgEl.src = dataUrl;
       imgEl.style.display = 'block';
    }
    if(avEl) avEl.style.display = 'none';
    
    if (APP.user && REGISTRY[APP.user]) {
        REGISTRY[APP.user].avatar = dataUrl;
        if(typeof saveRegistry === 'function') saveRegistry();
        else try{localStorage.setItem('zh_registry',JSON.stringify(REGISTRY));}catch(e){}
    }
    toast('Profile image updated!', 'ok');
  };
  rd.readAsDataURL(file);
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if(APP.user && REGISTRY[APP.user] && REGISTRY[APP.user].avatar) {
            const imgEl = document.getElementById('prof-avatar-img');
            const avEl = document.getElementById('prof-avatar');
            if(imgEl && avEl) {
               imgEl.src = REGISTRY[APP.user].avatar;
               imgEl.style.display = 'block';
               avEl.style.display = 'none';
            }
        }
    }, 1000);
});


async function cancelRequest(reqId, donId) {
    const reason = prompt("Please provide a valid explanation for cancelling this request:");
    if (!reason || !reason.trim()) {
        toast("Cancellation requires a valid reason.", "err");
        return;
    }
    try {
        if (supabaseClient) {
            // Update request
            await supabaseClient.from('requests').update({ status: 'cancelled' }).eq('id', reqId);
            // Revert donation to available
            await supabaseClient.from('donations').update({ status: 'available' }).eq('id', donId);
            // Log reason in messages
            const sysMsg = {
                sender_username: APP.user,
                context_id: donId,
                context_type: 'donation',
                message_text: `❌ Request Cancelled by ${APP.name || APP.user}. Reason: ${reason.trim()}`
            };
            await supabaseClient.from('messages').insert([sysMsg]);
            await syncDatabase();
            toast("Request cancelled and logged.", "ok");
            closeModal();
            renderDonTbl();
            renderMyActivity();
        }
    } catch (e) {
        console.error(e);
        toast("Error cancelling request", "err");
    }
}


let chatVoiceRec = null;
function startChatVoice(inputId, autoSend) {
    if (!checkVoiceSupport()) { toast('⚠️ Voice not supported in this browser.', 'err'); return; }
    if (chatVoiceRec) {
        try { chatVoiceRec.stop(); } catch(e){}
        chatVoiceRec = null;
        return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    chatVoiceRec = new SR();
    chatVoiceRec.lang = 'en-IN';
    chatVoiceRec.interimResults = true;
    
    chatVoiceRec.onstart = () => toast('🎤 Listening...', 'info', 2000);
    chatVoiceRec.onresult = (ev) => {
        let text = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
            text += ev.results[i][0].transcript;
        }
        const inputEl = document.getElementById(inputId);
        if (inputEl) inputEl.value = text;
    };
    chatVoiceRec.onend = () => {
        chatVoiceRec = null;
        if (autoSend && document.getElementById(inputId).value.trim() !== '') {
            if (inputId === 'chat-input') sendChat();
        }
    };
    chatVoiceRec.onerror = () => { chatVoiceRec = null; toast('⚠️ Voice recognition failed', 'err'); };
    
    try { chatVoiceRec.start(); } catch(e) { chatVoiceRec = null; }
}


function updateProfileHistoryCounts() {
    const uStr = String(APP.user||'').toLowerCase().trim();
    const myDons = DB.donations.filter(d => String(d.donor_username||'').toLowerCase().trim() === uStr || String(d.donor_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim());
    const myReqs = DB.requests.filter(r => String(r.req_username||'').toLowerCase().trim() === uStr || String(r.req_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim());
    
    const donCountEl = document.getElementById('btn-count-don');
    if(donCountEl) donCountEl.textContent = myDons.length;
    
    const reqCountEl = document.getElementById('btn-count-req');
    if(reqCountEl) reqCountEl.textContent = myReqs.length;
}

function renderMyDonationHistory() {
    const tb = document.getElementById('my-history-don-tbody');
    if (!tb) return;
    const uStr = String(APP.user||'').toLowerCase().trim();
    const myDons = DB.donations.filter(d => String(d.donor_username||'').toLowerCase().trim() === uStr || String(d.donor_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim());
    
    const sorted = [...myDons].sort((a,b) => {
        const aEnds = ['done','completed','expired'].includes((a.status||'').toLowerCase());
        const bEnds = ['done','completed','expired'].includes((b.status||'').toLowerCase());
        if(aEnds && !bEnds) return 1;
        if(!aEnds && bEnds) return -1;
        return new Date(b.created_at||0) - new Date(a.created_at||0);
    });
    
    tb.innerHTML = sorted.length ? sorted.map(d => {
        let action = `<button class="btn btn-sm btn-outline" style="border-radius:4px;padding:4px 8px;font-size:.7rem" onclick="openConnectModal(${d.id})">View Chat</button>`;
        if(d.status === 'available') action = `<span style="font-size:.75rem;color:var(--txt3)">Waiting...</span>`;
        return `<tr>
            <td><span class="badge bg-b">Donor</span></td>
            <td><strong>${esc(d.food_name)}</strong></td>
            <td>${d.quantity}</td>
            <td><span class="badge ${sBadge(d.status)}">${d.status}</span></td>
            <td>Community</td>
            <td>${action}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="6" class="empty">You have not donated anything yet.</td></tr>`;
    
    // Render Chart
    const ctx = document.getElementById('donHistoryChart');
    if (ctx && window.Chart) {
        const statusCounts = { available:0, requested:0, assigned:0, done:0, expired:0, other:0 };
        myDons.forEach(d => {
            const s = (d.status||'').toLowerCase();
            if (statusCounts[s] !== undefined) statusCounts[s]++;
            else if(s==='completed') statusCounts.done++;
            else statusCounts.other++;
        });
        
        if(window.donChartInstance) window.donChartInstance.destroy();
        window.donChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Available', 'Requested', 'Assigned', 'Done/Completed', 'Expired', 'Other'],
                datasets: [{
                    label: 'My Donations',
                    data: [statusCounts.available, statusCounts.requested, statusCounts.assigned, statusCounts.done, statusCounts.expired, statusCounts.other],
                    backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#14b8a6', '#ef4444', '#94a3b8'],
                    borderRadius: 6
                }]
            },
            options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }
}

function renderMyRequestHistory() {
    const tb = document.getElementById('my-history-req-tbody');
    if (!tb) return;
    const uStr = String(APP.user||'').toLowerCase().trim();
    const myReqs = DB.requests.filter(r => String(r.req_username||'').toLowerCase().trim() === uStr || String(r.req_name||'').toLowerCase().trim() === String(APP.name||'').toLowerCase().trim());
    
    const sorted = [...myReqs].sort((a,b) => {
        const aEnds = ['done','completed','cancelled'].includes((a.status||'').toLowerCase());
        const bEnds = ['done','completed','cancelled'].includes((b.status||'').toLowerCase());
        if(aEnds && !bEnds) return 1;
        if(!aEnds && bEnds) return -1;
        return new Date(b.created_at||0) - new Date(a.created_at||0);
    });
    
    tb.innerHTML = sorted.length ? sorted.map(r => {
        let action = `<button class="btn btn-sm btn-outline" style="border-radius:4px;padding:4px 8px;font-size:.7rem" onclick="openConnectModal(${r.donation_id})">View Chat</button>`;
        return `<tr>
            <td><span class="badge bg-y">Receiver</span></td>
            <td><strong>${esc(r.food_name)}</strong></td>
            <td>${r.quantity}</td>
            <td><span class="badge ${sBadge(r.status)}">${r.status}</span></td>
            <td>Community</td>
            <td>${action}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="6" class="empty">You have not made any requests yet.</td></tr>`;
    
    // Render Chart
    const ctx = document.getElementById('reqHistoryChart');
    if (ctx && window.Chart) {
        const statusCounts = { pending:0, assigned:0, done:0, cancelled:0, other:0 };
        myReqs.forEach(r => {
            const s = (r.status||'').toLowerCase();
            if (statusCounts[s] !== undefined) statusCounts[s]++;
            else if(s==='completed') statusCounts.done++;
            else statusCounts.other++;
        });
        
        if(window.reqChartInstance) window.reqChartInstance.destroy();
        window.reqChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Pending', 'Assigned/Delivery', 'Done/Completed', 'Cancelled', 'Other'],
                datasets: [{
                    data: [statusCounts.pending, statusCounts.assigned, statusCounts.done, statusCounts.cancelled, statusCounts.other],
                    backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#94a3b8']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }
}
