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

// ---- Top scorers (Golden Boot) — aggregated from per-game leaders ----
async function fetchScorers() {
  try {
    // The CDN scoreboard bundles per-game "leaders" with goal scorers.
    const url = "https://cdn.espn.com/core/soccer/scoreboard?xhr=1&league=fifa.world&limit=300&dates=20260611-20260719";
    const r = await fetch(url);
    const data = await r.json();

    // The CDN nests events; try the known paths defensively.
    let events = [];
    if (data && data.content && data.content.sbData && Array.isArray(data.content.sbData.events)) {
      events = data.content.sbData.events;
    } else if (data && data.content && Array.isArray(data.content.events)) {
      events = data.content.events;
    } else if (data && Array.isArray(data.events)) {
      events = data.events;
    } else if (data && data.scoreboard && Array.isArray(data.scoreboard.events)) {
      events = data.scoreboard.events;
    }
    console.log("Scorers: scanning " + events.length + " events");

    // Aggregate goals per player id across all games
    const tally = {}; // id -> { name, goals, team, jersey }
    events.forEach(function (ev) {
      const comps = ev.competitions || [];
      comps.forEach(function (comp) {
        const competitors = comp.competitors || [];
        competitors.forEach(function (c) {
          const teamName = (c.team && (c.team.displayName || c.team.name)) || "";
          const leaders = c.leaders || [];
          leaders.forEach(function (cat) {
            const catName = (cat.name || "").toLowerCase();
            if (catName !== "goals") return;
            (cat.leaders || []).forEach(function (entry) {
              const ath = entry.athlete;
              if (!ath) return;
              const id = String(ath.id || "");
              const val = Number(entry.value) || 0;
              if (!id || val <= 0) return;
              if (!tally[id]) {
                tally[id] = {
                  id: id,
                  name: ath.fullName || ath.displayName || ath.shortName || "",
                  goals: 0,
                  team: teamName,
                  jersey: ath.jersey || ""
                };
              }
              // value is this player's goals IN THIS GAME; sum across games
              tally[id].goals += val;
              if (!tally[id].team && teamName) tally[id].team = teamName;
            });
          });
        });
      });
    });

    // Sort by goals desc, take top 5
    const arr = Object.keys(tally).map(function (k) { return tally[k]; });
    arr.sort(function (a, b) { return b.goals - a.goals; });
    const top = arr.slice(0, 5).map(function (p, i) {
      return {
        rank: i + 1,
        name: p.name,
        country: p.team,
        goals: p.goals,
        photo: "https://a.espncdn.com/i/headshots/soccer/players/full/" + p.id + ".png"
      };
    });

    if (top.length) {
      scorers = top;
      console.log("Updated " + top.length + " scorers (top: " + top[0].name + " " + top[0].goals + ")");
    } else {
      console.log("Scorers: no goal data found in events");
    }
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
