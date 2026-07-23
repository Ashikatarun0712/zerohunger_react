import * as mobilenet from '@tensorflow-models/mobilenet';
import { OPENROUTER_API_KEYS } from './api_keys';
export const NON_FOOD_ITEMS = [
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

export const FOOD_DB = {
  cooked:{keywords:['rice','sambar','dal','curry','kootu','rasam','idli','dosa','pongal','upma','chapati','roti','paratha','sabzi','biryani','pulao','fried rice','soup','stew','gravy','masala','fry','roast','boiled','steamed','cooked','khichdi','porridge','kanji','congee','poori','puri','vada','pakoda','bajji','bonda','kuzhambu','poriyal','thoran','aviyal','fish curry','chicken curry','mutton','egg curry','omelette','noodles cooked','pasta cooked','payasam','kheer','halwa','ladoo','sweets','mithai','prepared','leftover','meal','dish'],
    days:1,label:'Cooked Food',icon:'🍚',cssClass:'cooked',
    warning:'⚠️ Cooked food spoils fast! Must be distributed within 24 hours (1 day).',color:'#92400e'},
  packaged:{keywords:['biscuit','biscuits','cookies','chips','wafer','namkeen','mixture','murukku','chocolate','candy','toffee','jam','pickle','achar','sauce','ketchup','noodles packet','maggi','pasta dry','macaroni','vermicelli','semiya','bread packet','rusk','toast','malt','horlicks','bournvita','boost','milk powder','formula','baby food','cereal','cornflakes','oats packet','sugar','salt','oil','ghee','butter','cheese','paneer packaged','canned','tin','bottled','sealed','packaged','processed','instant','tinned','preserved','jaggery','honey','syrup','squash','juice packet','coconut milk tin','condensed milk','evaporated'],
    days:90,label:'Packaged / Preserved',icon:'📦',cssClass:'packaged',
    warning:'📦 Packaged food — check label. AI estimate: 30–180 days.',color:'#1e40af'},
  raw:{keywords:[],days:20,label:'Raw / Uncooked Food',icon:'🥕',cssClass:'raw',
    warning:'🌿 Raw food — refrigerate when possible. Best distributed within 20 days.',color:'#065f46'}
};

export const FOOD_OVERRIDES = {'idli':1,'dosa':1,'pongal':1,'upma':1,'sambar':1,'rasam':1,'kootu':1,'payasam':1,'kheer':1,'soup':1,'porridge':1,'kanji':1,'congee':1,'rice':1,'dal':1,'curry':1,'biryani':1,'pulao':1,'roti':1,'chapati':1,'gravy':1,'stew':1,'khichdi':1,'vada':1,'pakoda':1,'bajji':1,'bonda':1,'kuzhambu':1,'poriyal':1,'thoran':1,'aviyal':1,'fish curry':1,'chicken curry':1,'egg curry':1,'omelette':1,'fried rice':1,'leafy greens':5,'spinach':5,'palak':5,'methi':5,'keerai':5,'lettuce':3,'mushroom':7,'mushrooms':7,'tomato':10,'tomatoes':10,'banana':7,'bananas':7,'papaya':7,'mango':10,'mangoes':10,'carrot':20,'potato':20,'onion':30,'garlic':30,'ginger':20,'apple':25,'apples':25,'orange':20,'grapes':14,'biscuit':120,'biscuits':120,'chips':90,'chocolate':180,'jam':180,'pickle':365,'ghee':180,'oil':360,'sugar':720,'salt':720};

export function detectNonFood(name) {
  if (!name || name.trim().length < 2) return { isNonFood: false };
  const lower = name.toLowerCase().trim();
  
  const onlyAlpha = lower.replace(/[^a-z]/g, '');
  if (onlyAlpha.length > 0 && !/[aeiouy]/.test(onlyAlpha)) return { isNonFood: true, matched: 'Random/Gibberish input' };
  if (/(.)\1{3,}/.test(lower)) return { isNonFood: true, matched: 'Random/Gibberish input' };
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(onlyAlpha)) return { isNonFood: true, matched: 'Random/Gibberish input' };
  if (/^[\d\s\W]+$/.test(lower)) return { isNonFood: true, matched: 'Numeric/Invalid input' };
  
  const smashes = ['asdf', 'qwer', 'zxcv', 'hjkl', 'uiop', 'tyui'];
  for (const sm of smashes) if (lower.includes(sm)) return { isNonFood: true, matched: 'Random/Gibberish input' };

  const words = lower.split(/\s+/);
  for (const item of NON_FOOD_ITEMS) {
    const itemL = item.toLowerCase();
    if (lower === itemL) return { isNonFood: true, matched: item };
    if (words[0] === itemL && itemL.length >= 4) return { isNonFood: true, matched: item };
    if (lower.includes(itemL) && itemL.length >= 5) return { isNonFood: true, matched: item };
  }
  return { isNonFood: false };
}

export function classifyFood(name) {
  if (!name || name.trim().length < 2) return null;
  const lower = name.toLowerCase().trim();
  for (const [key, days] of Object.entries(FOOD_OVERRIDES)) {
    if (lower.includes(key)) {
      const type = days <= 1 ? 'cooked' : days >= 30 ? 'packaged' : 'raw';
      return { type, days, name: lower };
    }
  }
  for (const kw of FOOD_DB.cooked.keywords) if (lower.includes(kw)) return { type: 'cooked', days: 1, name: lower };
  for (const kw of FOOD_DB.packaged.keywords) if (lower.includes(kw)) return { type: 'packaged', days: 90, name: lower };
  return { type: 'raw', days: 20, name: lower };
}

export function runExpiryPredictionLogic(foodName, cat = 'auto') {
  let result = null;
  if (cat === 'auto') {
    const nfCheck = detectNonFood(foodName);
    if (nfCheck.isNonFood) {
      return { error: `⚠️ "${foodName}" is not a food item! Detected as: ${nfCheck.matched}` };
    }
    result = classifyFood(foodName);
  } else {
    const typeInfo = FOOD_DB[cat];
    if (typeInfo) {
      result = { type: cat, days: typeInfo.days, name: foodName.toLowerCase() };
    }
  }

  if (!result) return null;

  const now = new Date(); 
  const expDate = new Date(now);
  expDate.setDate(expDate.getDate() + result.days);
  
  const mfgStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const expStr = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}-${String(expDate.getDate()).padStart(2, '0')}`;
  
  return {
    ...result,
    mfgStr,
    expStr,
    typeInfo: FOOD_DB[result.type]
  };
}

let loadedModel = null;
let isLoadingModel = false;

export async function loadMobileNet() {
  if (loadedModel) return loadedModel;
  if (isLoadingModel) return null;
  isLoadingModel = true;
  try {
    const model = await mobilenet.load({ version: 2, alpha: 1.0 });
    loadedModel = model;
    isLoadingModel = false;
    return model;
  } catch (e) {
    isLoadingModel = false;
    console.error('MobileNet load failed:', e);
    return null;
  }
}

export function mapMobileNetToFreshness(predictions, foodHint) {
  const FRESH_CLASSES = ['Granny Smith','lemon','orange','banana','pineapple','strawberry','fig','pomegranate','artichoke','cucumber','zucchini','acorn squash','butternut squash','mashed potato','cauliflower','broccoli','cabbage','bell pepper','head cabbage','spaghetti squash','green bean'];
  const MEDIUM_CLASSES = ['mushroom','French loaf','pretzel','bagel','pizza','cheeseburger','hot dog','corn','ear','maize','corn on the cob','mango','papaya'];
  const SPOILED_CLASSES = ['slime mold','stinkhorn','earthstar','gyromitra','agaric','coral fungus','hen-of-the-woods','bolete','web cap'];
  
  let freshScore = 0, mediumScore = 0, spoiledScore = 0;
  for (const p of predictions) {
    const cls = (p.className || '').toLowerCase(); 
    const prob = p.probability || 0;
    if (SPOILED_CLASSES.some(s => cls.includes(s.toLowerCase()))) { spoiledScore += prob * 2; continue; }
    if (FRESH_CLASSES.some(s => cls.includes(s.toLowerCase()))) { freshScore += prob; continue; }
    if (MEDIUM_CLASSES.some(s => cls.includes(s.toLowerCase()))) { mediumScore += prob * 0.5; continue; }
    if (prob > 0.4) freshScore += 0.3; 
    else if (prob > 0.15) freshScore += 0.15; 
    else mediumScore += 0.1;
  }
  
  const hint = (foodHint || '').toLowerCase();
  const isCookedHint = ['rice','sambar','curry','idli','dosa','dal','biryani','soup','cooked'].some(k => hint.includes(k));
  if (isCookedHint) { freshScore *= 0.5; mediumScore += 0.3; }
  
  const top1Conf = predictions[0]?.probability || 0;
  if (top1Conf > 0.5) freshScore += 0.5; 
  else if (top1Conf > 0.25) freshScore += 0.2; 
  else if (top1Conf < 0.1) spoiledScore += 0.3;
  
  const total = freshScore + mediumScore + spoiledScore || 1;
  const fN = freshScore / total, mN = mediumScore / total, sN = spoiledScore / total;
  
  if (fN >= mN && fN >= sN) return { label: 'Fresh', cssClass: 'fresh-food', icon: '✅', confidence: Math.round(fN * 100), freshScore: Math.min(10, 6 + fN * 4), emoji: '🟢' };
  if (mN >= sN) return { label: 'Medium', cssClass: 'medium-food', icon: '⚠️', confidence: Math.round(mN * 100), freshScore: Math.min(7, 4 + mN * 3), emoji: '🟡' };
  return { label: 'Spoiled', cssClass: 'spoiled-food', icon: '❌', confidence: Math.round(sN * 100), freshScore: 0, emoji: '🔴' };
}

let openRouterKeyIndex = 0;

export async function runOpenRouterFallback(base64Image, foodHint) {
  const apiKey = OPENROUTER_API_KEYS[openRouterKeyIndex % OPENROUTER_API_KEYS.length];
  openRouterKeyIndex++;

  const prompt = `You are a food freshness classifier. Look at this food image${foodHint ? ` (hint: "${foodHint}")` : ''}.
Classify as EXACTLY one of: Fresh, Medium, or Spoiled.
Respond ONLY with valid JSON (no markdown):
{"label":"Fresh|Medium|Spoiled","confidence":<70-99>,"freshness_score":<1.0-10.0>,"reason":"<one sentence>"}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'stepfun/step-1v-8k',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: base64Image } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    // Safely extract JSON using regex in case LLM outputs conversational padding
    const match = content.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : '{}';
    const parsed = JSON.parse(jsonStr);

    const labelMap = { 
      'Fresh': { cssClass: 'fresh-food', icon: '✅', emoji: '🟢' }, 
      'Medium': { cssClass: 'medium-food', icon: '⚠️', emoji: '🟡' }, 
      'Spoiled': { cssClass: 'spoiled-food', icon: '❌', emoji: '🔴' } 
    };

    const lm = labelMap[parsed.label] || labelMap['Medium'];
    
    return {
      result: {
        label: parsed.label || 'Medium',
        cssClass: lm.cssClass,
        icon: lm.icon,
        emoji: lm.emoji,
        confidence: parsed.confidence || 85,
        freshScore: parsed.freshness_score || 7
      },
      predictions: [{ className: parsed.reason || 'AI analyzed via OpenRouter', probability: (parsed.confidence || 85) / 100 }]
    };
  } catch (error) {
    console.error('OpenRouter Fallback error:', error);
    return null;
  }
}

export async function analyzeCertificate(base64Image) {
  const apiKey = OPENROUTER_API_KEYS[openRouterKeyIndex % OPENROUTER_API_KEYS.length];
  openRouterKeyIndex++;

  const prompt = `Extract and verify if this is a valid NGO/Trust certificate. Return JSON format strictly like: {"is_valid": true, "trust_name": "Name", "registration_id": "123"}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-lite-preview-02-05:free',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: base64Image } }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    
    const match = content.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : '{}';
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Certificate Fallback error:', error);
    return null;
  }
}
