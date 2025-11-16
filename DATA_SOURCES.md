# SC2 Data Sources Guide

How to populate `sc2units.json` with comprehensive StarCraft 2 unit data.

---

## 🎯 Quick Start

### **Option 1: Use the Template (Fastest)**
```bash
# Copy the pre-filled template
cp scripts/sc2_data_template.json sc2units.json

# Or download it from the repo
./start.sh
# Then drag-and-drop sc2units.json into browser
```

This template includes:
- ✅ All Protoss units (18 units)
- ✅ All Protoss buildings (14 buildings)
- ✅ Common upgrades
- ✅ All Terran units (13 units)
- ✅ All Terran buildings
- ✅ All Zerg units (9 units)
- ✅ All Zerg buildings

---

## 📚 Data Sources

### **1. Liquipedia (Recommended)**
**Website:** https://liquipedia.net/starcraft2/

**Advantages:**
- ✅ Most comprehensive and up-to-date
- ✅ Community-maintained
- ✅ Includes all balance patches
- ✅ Has exact stats

**How to use:**
```bash
# Install dependencies
pip install requests beautifulsoup4

# Run scraper
python scripts/scrape_sc2_data.py
```

**Manual extraction:**
Visit these pages and copy data:
- https://liquipedia.net/starcraft2/Protoss_Units
- https://liquipedia.net/starcraft2/Terran_Units
- https://liquipedia.net/starcraft2/Zerg_Units

---

### **2. StarCraft II Wiki**
**Website:** https://starcraft.fandom.com/wiki/StarCraft_II

**Data available:**
- Unit stats
- Build times
- Tech requirements
- Ability details

---

### **3. sc2unitsdb (API)**
**GitHub:** https://github.com/andrewkatson/sc2unitsdb

```bash
# Install
npm install sc2unitsdb

# Use in Node.js
const sc2units = require('sc2unitsdb');
console.log(sc2units.protoss.units.zealot);
```

---

### **4. Blizzard's Game Files**
If you have SC2 installed:

**Location (Windows):**
```
C:\Program Files (x86)\StarCraft II\SC2Data\
```

**Location (Mac):**
```
/Applications/StarCraft II/SC2Data/
```

**Tools to extract:**
- MPQ Editor: https://www.zezula.net/en/mpq/download.html
- SC2 Editor (Built-in)

---

### **5. Community APIs**

#### **Spawning Tool API**
https://spawningtool.com/api/

```bash
# Get build orders
curl https://spawningtool.com/api/builds/

# Get specific build
curl https://spawningtool.com/api/builds/12345/
```

#### **Rankedftw API**
https://www.rankedftw.com/api/

```bash
# Get ladder data
curl https://www.rankedftw.com/api/team/1234567/
```

---

## 🛠️ Manual Data Entry Guide

### **Step 1: Find Unit Stats**
Visit Liquipedia: https://liquipedia.net/starcraft2/Zealot

**Extract:**
- Name: Zealot
- Cost: 100 minerals, 0 gas
- Supply: 2
- Build time: 38 seconds
- Built from: Gateway

### **Step 2: Add to JSON**
```json
{
  "protoss": {
    "units": {
      "zealot": {
        "name": "Zealot",
        "cost": { "mineral": 100, "gas": 0 },
        "supply": { "required": 2 },
        "time": 38,
        "tech_tree": { "requires": ["Gateway"] }
      }
    }
  }
}
```

### **Step 3: Repeat for All Units**
- Protoss: 18 units, 14 buildings, ~20 upgrades
- Terran: 13 units, 15 buildings, ~15 upgrades
- Zerg: 17 units, 12 buildings, ~20 upgrades

**Total:** ~150 entries

---

## 🤖 Automated Scraping

### **Python Scraper (Included)**
```bash
cd /home/user/sc2
python scripts/scrape_sc2_data.py
```

**Features:**
- Scrapes all three races
- Extracts unit stats automatically
- Generates valid JSON
- Handles errors gracefully

### **Node.js Scraper**
```javascript
// scrape.js
const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeUnits(race) {
  const url = `https://liquipedia.net/starcraft2/${race}_Units`;
  const { data } = await axios.get(url);
  const $ = cheerio.load(data);

  const units = {};

  $('.infobox-wrapper').each((i, elem) => {
    const name = $(elem).find('.infobox-header').text().trim();
    const mineral = $(elem).find('th:contains("Minerals")').next().text();
    const gas = $(elem).find('th:contains("Gas")').next().text();

    units[name.toLowerCase()] = {
      name,
      cost: { mineral: parseInt(mineral), gas: parseInt(gas) }
    };
  });

  return units;
}

scrapeUnits('Protoss').then(console.log);
```

---

## 📊 Data Structure Reference

### **Complete Unit Entry**
```json
{
  "zealot": {
    "name": "Zealot",
    "cost": {
      "mineral": 100,
      "gas": 0
    },
    "supply": {
      "required": 2,
      "provided": 0
    },
    "time": 38,
    "tech_tree": {
      "requires": ["Gateway"]
    },
    "stats": {
      "health": 100,
      "shields": 50,
      "armor": 1,
      "damage": 8
    },
    "image": "assets/protoss/zealot.png",
    "description": "Powerful melee warrior"
  }
}
```

### **Complete Building Entry**
```json
{
  "gateway": {
    "name": "Gateway",
    "cost": {
      "mineral": 150,
      "gas": 0
    },
    "supply": {
      "provided": 0
    },
    "time": 65,
    "tech_tree": {
      "requires": ["Pylon"]
    },
    "trains": ["Zealot", "Stalker", "Sentry", "Adept"]
  }
}
```

### **Complete Upgrade Entry**
```json
{
  "charge": {
    "name": "Charge",
    "cost": {
      "mineral": 200,
      "gas": 200
    },
    "time": 140,
    "tech_tree": {
      "requires": ["Twilight Council"]
    },
    "affects": "Zealot",
    "effect": "Increases movement speed and enables charge ability"
  }
}
```

---

## 🔄 Keeping Data Updated

### **Balance Patches**
Blizzard releases patches regularly. Update your data:

1. **Check patch notes:**
   https://starcraft2.com/en-us/news/patch-notes

2. **Update affected units:**
   ```json
   {
     "zealot": {
       "cost": { "mineral": 100, "gas": 0 }  // Was 100, now 90
     }
   }
   ```

3. **Re-run scraper:**
   ```bash
   python scripts/scrape_sc2_data.py
   ```

### **Versioning**
Track versions in your JSON:

```json
{
  "_meta": {
    "version": "5.0.11",
    "patch": "Balance Update 2024",
    "date": "2024-03-15"
  },
  "protoss": { ... }
}
```

---

## 📦 Pre-made Datasets

### **Community Resources**

1. **SC2 ReplayStats**
   - https://www.sc2replaystats.com/
   - Download build order data

2. **Spawning Tool Database**
   - https://spawningtool.com/
   - 10,000+ build orders

3. **GitHub Repositories**
   ```bash
   # Clone community data
   git clone https://github.com/aiarena/sc2-unit-data
   ```

---

## 🎮 Example: Full Protoss Data

See `scripts/sc2_data_template.json` for complete example with:
- ✅ 18 Protoss units
- ✅ 14 Protoss buildings
- ✅ 6 Protoss upgrades
- ✅ 13 Terran units
- ✅ 9 Terran buildings
- ✅ 9 Zerg units
- ✅ 7 Zerg buildings

---

## 🚀 Quick Commands

```bash
# Use template
cp scripts/sc2_data_template.json sc2units.json

# Scrape from web
python scripts/scrape_sc2_data.py

# Validate JSON
cat sc2units.json | jq '.'

# Count units
cat sc2units.json | jq '.protoss.units | length'

# View specific unit
cat sc2units.json | jq '.protoss.units.zealot'
```

---

## 🔍 Validation

After updating, validate your data:

```bash
# Check JSON syntax
jq '.' sc2units.json

# Verify structure
node -e "
const data = require('./sc2units.json');
console.log('Protoss units:', Object.keys(data.protoss.units).length);
console.log('Terran units:', Object.keys(data.terran.units).length);
console.log('Zerg units:', Object.keys(data.zerg.units).length);
"
```

---

## 📝 Contribution

If you create comprehensive data, consider sharing:

1. Fork the repo
2. Update `sc2units.json`
3. Submit PR

Or share on:
- r/starcraft subreddit
- TeamLiquid forums
- SC2 Discord servers

---

## 📧 Data Sources

**Official:**
- Blizzard Patch Notes: https://starcraft2.com/en-us/news/patch-notes
- Battle.net API: https://develop.battle.net/

**Community:**
- Liquipedia: https://liquipedia.net/starcraft2/
- SC2 Wiki: https://starcraft.fandom.com/
- Team Liquid: https://tl.net/

**Tools:**
- MPQ Editor: https://www.zezula.net/en/mpq/download.html
- SC2 Editor: Included with game

---

**Need help?** Check the included template: `scripts/sc2_data_template.json`
