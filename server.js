const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const MATCHES = {
  "0-0": ["Germany", "Paraguay"],
  "0-1": ["France", "Sweden"],
  "0-2": ["Canada", "South Africa"],
  "0-3": ["Netherlands", "Morocco"],
  "0-4": ["Portugal", "Croatia"],
  "0-5": ["Spain", "Austria"],
  "0-6": ["United States", "Bosnia"],
  "0-7": ["Belgium", "Senegal"],
  "0-8": ["Brazil", "Japan"],
  "0-9": ["Ivory Coast", "Norway"],
  "0-10": ["Mexico", "Ecuador"],
  "0-11": ["England", "Congo"],
  "0-12": ["Argentina", "Cape Verde"],
  "0-13": ["Australia", "Egypt"],
  "0-14": ["Switzerland", "Algeria"],
  "0-15": ["Colombia", "Ghana"]
};

let results = {};
let scorers = [];

async function fetchScores() {
  try {
    const url = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200&dates=20260611-20260719";
    const r = await fetch(url);
    const data = await r.json();
    const allEvents = [];
    (data.events || []).forEach(function (ev) {
      const comp = ev.competitions[0];
      const cs = comp.competitors;
      if (cs.length < 2) return;
      allEvents.push({
        t1: cs[0].team.displayName,
        s1: Number(cs[0].score),
        p1: cs[0].shootoutScore != null ? Number(cs[0].shootoutScore) : null,
        t2: cs[1].team.displayName,
        s2: Number(cs[1].score),
        p2: cs[1].shootoutScore != null ? Number(cs[1].shootoutScore) : null,
        state: comp.status.type.state,
        completed: comp.status.type.completed
      });
    });

    const newResults = {};
    Object.keys(MATCHES).forEach(function (key) {
      const teamA = MATCHES[key][0];
      const teamB = MATCHES[key][1];
      const match = allEvents.find(function (ev) {
        const t1 = ev.t1.toLowerCase();
        const t2 = ev.t2.toLowerCase();
        const a = teamA.toLowerCase();
        const b = teamB.toLowerCase();
        return (t1.indexOf(a) !== -1 && t2.indexOf(b) !== -1) || (t1.indexOf(b) !== -1 && t2.indexOf(a) !== -1);
      });
      if (!match) return;
      const aIsT1 = match.t1.toLowerCase().indexOf(teamA.toLowerCase()) !== -1;
      const aGoals = aIsT1 ? match.s1 : match.s2;
      const bGoals = aIsT1 ? match.s2 : match.s1;
      const aPens = aIsT1 ? match.p1 : match.p2;
      const bPens = aIsT1 ? match.p2 : match.p1;
      const entry = {
        a: aGoals,
        b: bGoals,
        status: match.completed ? "finished" : (match.state === "in" ? "live" : "upcoming")
      };
      if (aPens != null && bPens != null) {
        entry.pens = true;
        entry.winner = aPens > bPens ? 0 : 1;
      }
      newResults[key] = entry;
    });

    results = newResults;
    console.log("Updated " + Object.keys(newResults).length + " matches at " + new Date().toISOString());
  } catch (err) {
    console.error("Fetch scores failed:", err.message);
  }
}

// ---- Top scorers (Golden Boot) ----
async function fetchScorers() {
  try {
    // The leaders endpoint returns categories; we want the goals category.
    const leadersUrl = "https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/seasons/2026/types/3/leaders?limit=50";
    let r = await fetch(leadersUrl);
    let data = await r.json();

    // Find the goals category (try common names)
    let cat = null;
    if (data && Array.isArray(data.categories)) {
      cat = data.categories.find(function (c) {
        const n = (c.name || "").toLowerCase();
        const dn = (c.displayName || "").toLowerCase();
        return n.indexOf("goal") !== -1 || dn.indexOf("goal") !== -1;
      }) || data.categories[0];
    }
    if (!cat || !Array.isArray(cat.leaders)) {
      console.log("Scorers: no goals category found");
      return;
    }

    // Each leader has a value (goals) and an athlete $ref we must fetch for the name/photo
    const top = cat.leaders.slice(0, 5);
    const resolved = [];
    for (let i = 0; i < top.length; i++) {
      const ld = top[i];
      const goals = Number(ld.value);
      let name = "", country = "", photo = "", athleteId = "";
      try {
        if (ld.athlete && ld.athlete.$ref) {
          const ar = await fetch(ld.athlete.$ref);
          const ad = await ar.json();
          name = ad.displayName || ad.fullName || ad.name || "";
          athleteId = ad.id || "";
          photo = (ad.headshot && ad.headshot.href) ? ad.headshot.href
                  : (athleteId ? "https://a.espncdn.com/i/headshots/soccer/players/full/" + athleteId + ".png" : "");
          // country: try team ref
          if (ad.team && ad.team.$ref) {
            try { const tr = await fetch(ad.team.$ref); const td = await tr.json(); country = td.displayName || td.name || ""; } catch (e) {}
          }
        }
      } catch (e) {}
      resolved.push({ rank: i + 1, name: name, country: country, goals: goals, photo: photo });
    }
    scorers = resolved;
    console.log("Updated " + resolved.length + " scorers");
  } catch (err) {
    console.error("Fetch scorers failed:", err.message);
  }
}

fetchScores();
fetchScorers();
setInterval(fetchScores, 2 * 60 * 1000);
setInterval(fetchScorers, 5 * 60 * 1000);

app.get('/api/results', function (req, res) {
  res.json(results);
});

app.get('/api/scorers', function (req, res) {
  res.json(scorers);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log("Server running on port " + PORT);
});
