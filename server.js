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

fetchScores();
setInterval(fetchScores, 2 * 60 * 1000);

app.get('/api/results', function (req, res) {
  res.json(results);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
  console.log("Server running on port " + PORT);
});
