(async function(){
  const KEY = "capability-frontier-state";
  const ZONES = {
    outside: {title:"Outside", def:"Working with AI makes results on these tasks worse, even though they look similar to tasks AI handles well.", q:"What do employees need to do work by themselves and spot AI limitations?"},
    inside: {title:"Inside", def:"Working with AI makes results on these tasks better and faster.", q:"What must employees keep so they can still judge and correct if needed?"}
  };
  // [code, label, key in library.json]
  const CATS = [["K","Knowledge","knowledge"],["S","Skills","skills"],["A","Abilities","abilities"]];
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const uid = () => Math.random().toString(36).slice(2,9);

  /* ---------- library ---------- */
  let LIB;
  try{
    const res = await fetch("library.json", {cache:"no-store"});
    if(!res.ok) throw new Error(res.status);
    LIB = await res.json();
  }catch(e){
    $("zones").innerHTML = `<div class="banner"><p><strong>library.json could not be loaded.</strong> Open the page through a local web server (see README) rather than directly from the file system, and check that library.json is valid JSON.</p></div>`;
    return;
  }
  // Shuffle library items once per page load, so the order in library.json does not suggest a ranking.
  const shuffle = a => { for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  ["tasks", ...CATS.map(c => c[2])].forEach(k => { if(Array.isArray(LIB[k])) shuffle(LIB[k]); });
  // Library items get stable ids derived from their text, so placements survive edits to library.json.
  const libTasks = () => (LIB.tasks || []).map(text => ({id:"T|" + text, text, zone:null}));
  const libCaps = () => CATS.flatMap(([c,,k]) => (LIB[k] || []).map(name => ({id:c + "|" + name, cat:c, name})));

  function fresh(){
    return {tasks:libTasks(), caps:libCaps(), zoneCaps:{inside:[], outside:[]}, pending:null, log:[], open:{T:true}};
  }
  // Merge saved work with the current library: library items first, then items added in the app.
  function load(){
    let s = null;
    try{ s = JSON.parse(localStorage.getItem(KEY)); }catch(e){}
    const st = fresh();
    if(!s || !s.tasks || !s.zoneCaps) return st;
    const zoneOf = new Map(s.tasks.map(t => [t.id, t.zone]));
    st.tasks.forEach(t => { if(zoneOf.has(t.id)) t.zone = zoneOf.get(t.id); });
    const tNames = new Set(st.tasks.map(t => t.text)), cNames = new Set(st.caps.map(c => c.cat + "|" + c.name));
    st.tasks.push(...s.tasks.filter(t => t.custom && !tNames.has(t.text)));
    st.caps.push(...(s.caps || []).filter(c => c.custom && !cNames.has(c.cat + "|" + c.name)));
    const capIds = new Set(st.caps.map(c => c.id)), taskIds = new Set(st.tasks.map(t => t.id));
    ["inside","outside"].forEach(z => st.zoneCaps[z] = (s.zoneCaps[z] || []).filter(id => capIds.has(id)));
    if(s.pending){
      s.pending.moved = s.pending.moved.filter(m => taskIds.has(m.id));
      st.pending = s.pending.moved.length ? s.pending : null;
    }
    st.log = s.log || [];
    st.open = s.open || {T:true};
    return st;
  }
  let state = load();
  const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} };
  const cap = id => state.caps.find(c => c.id === id);
  const task = id => state.tasks.find(t => t.id === id);
  const other = z => z === "inside" ? "outside" : "inside";
  const toast = m => { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 1800); };

  /* ---------- render ---------- */
  function capTag(c, zone){
    const both = zone && state.zoneCaps[other(zone)].includes(c.id);
    return `<span class="tag ${c.cat}${both ? " both" : ""}" data-drag="cap" data-id="${esc(c.id)}"${zone ? ` data-from="${zone}"` : ""}${both ? ' title="Also needed on the other side"' : ""}>
      <span class="letter">${c.cat}</span><span class="t">${esc(c.name)}</span>${zone ? `<button class="x" data-remove="${esc(c.id)}" data-zone="${zone}" aria-label="Remove ${esc(c.name)}">×</button>` : ""}</span>`;
  }
  // A library bubble for a capability already placed in one zone: dimmed, with a dot for that zone.
  function libUsedTag(c, zone){
    const where = zone === "outside" ? "outside" : "inside";
    return `<span class="tag ${c.cat} used" data-drag="cap" data-id="${esc(c.id)}" title="Placed ${where} the frontier. Drag it to the other side if it is needed there too.">
      <i class="dot ${zone === "outside" ? "o" : "i"}" aria-label="placed ${where}"></i><span class="t">${esc(c.name)}</span></span>`;
  }
  function taskTag(t){
    const moved = state.pending && state.pending.moved.some(m => m.id === t.id);
    return `<span class="tag task${moved ? " moved" : ""}" data-drag="task" data-id="${esc(t.id)}"><span class="t">${esc(t.text)}</span></span>`;
  }

  function render(){
    $("zones").innerHTML = ["outside","inside"].map((z, i) => {
      const tasks = state.tasks.filter(t => t.zone === z);
      const ksa = CATS.map(([c,label]) => {
        const list = state.zoneCaps[z].map(cap).filter(x => x && x.cat === c);
        return `<div class="box" data-drop="caps" data-zone="${z}" data-cat="${c}"><h3>${label}</h3><div class="items">${list.length ? list.map(x => capTag(x, z)).join("") : `<span class="drop-hint">Drop ${label.toLowerCase()} here</span>`}</div></div>`;
      }).join("");
      return (i ? `<div class="frontier">frontier</div>` : "") + `
        <div class="zone ${z}">
          <div class="zone-head"><strong>${ZONES[z].title}</strong><span>${ZONES[z].def}</span></div>
          <div class="zone-body">
            <div class="box" data-drop="tasks" data-zone="${z}"><h3>Tasks</h3><div class="items">${tasks.length ? tasks.map(taskTag).join("") : `<span class="drop-hint">Drop tasks here</span>`}</div></div>
            <div class="question ${z}"><p>${ZONES[z].q}</p></div>
            <div class="branch ${z}" aria-hidden="true"><span></span><span></span><span></span></div>
            <div class="ksa">${ksa}</div>
          </div>
        </div>`;
    }).join("");

    const p = state.pending;
    $("banner").hidden = !p;
    if(p){
      const names = p.moved.map(m => `“${esc(task(m.id) ? task(m.id).text : m.text)}” moved ${m.to}`).join(", ");
      $("banner-text").innerHTML = `${names}. Check whether the knowledge, skills and abilities on both sides still fit, then mark the change as reviewed.`;
    }

    const free = state.tasks.filter(t => !t.zone);
    const sec = (key, label, count, inner, cls, ph) => `
      <details data-key="${key}"${state.open[key] ? " open" : ""}>
        <summary>${label}<span class="count">${count}</span></summary>
        <div class="lib-list ${cls}">${inner}</div>
        <div class="addrow"><input data-add="${key}" placeholder="${ph}" aria-label="${ph}"><button class="btn" data-addbtn="${key}">Add</button></div>
      </details>`;
    let html = sec("T","Tasks", free.length ? free.length + " left" : "all placed",
      free.length ? free.map(taskTag).join("") : `<span class="lib-empty">All tasks are placed. Drag one back here to take it off the frontier.</span>`, "tasks", "Add a task");
    // Unplaced items first, items placed on one side dimmed at the end, items placed on both sides hidden.
    CATS.forEach(([c,label]) => {
      const rows = state.caps.filter(x => x.cat === c)
        .map(x => ({x, o:state.zoneCaps.outside.includes(x.id), i:state.zoneCaps.inside.includes(x.id)}))
        .filter(r => !(r.o && r.i));
      const open = rows.filter(r => !r.o && !r.i), used = rows.filter(r => r.o || r.i);
      const left = open.length ? open.length + " left" : "all placed";
      const inner = open.map(r => capTag(r.x)).join("") + used.map(r => libUsedTag(r.x, r.o ? "outside" : "inside")).join("")
        || `<span class="lib-empty">All ${label.toLowerCase()} are placed on both sides.</span>`;
      html += sec(c, label, left, inner, "", "Add your own");
    });
    $("lib").innerHTML = html;
    renderSummary();
    renderLog();
  }

  function renderSummary(){
    $("summary").innerHTML = CATS.map(([c,label]) => {
      const items = state.caps.filter(x => x.cat === c).map(x => ({x, o:state.zoneCaps.outside.includes(x.id), i:state.zoneCaps.inside.includes(x.id)}))
        .filter(r => r.o || r.i)
        .sort((a,b) => ((b.o && b.i) - (a.o && a.i)) || (b.o - a.o));
      return `<div class="sum-col"><h3>${label} <span>${items.length}</span></h3>` +
        (items.length ? `<ul>${items.map(r => `<li><i class="dot ${r.o && r.i ? "b" : r.o ? "o" : "i"}" aria-label="${r.o && r.i ? "both sides" : r.o ? "outside" : "inside"}"></i>${esc(r.x.name)}</li>`).join("")}</ul>`
          : `<p class="hint" style="margin:0">None placed yet.</p>`) + `</div>`;
    }).join("");
  }

  function renderLog(){
    if(!state.log.length){ $("log").innerHTML = `<p class="hint">No reviews yet. Drag a task from one zone to the other, adjust the capabilities and mark the change as reviewed.</p>`; return; }
    const names = list => list.map(n => `<li>${esc(n)}</li>`).join("");
    $("log").innerHTML = state.log.slice().reverse().map(e => {
      const blocks = [];
      ["outside","inside"].forEach(z => {
        if(e.added[z].length) blocks.push(`<div><h4>Added ${z}</h4><ul>${names(e.added[z])}</ul></div>`);
        if(e.removed[z].length) blocks.push(`<div><h4>Removed ${z}</h4><ul>${names(e.removed[z])}</ul></div>`);
      });
      return `<article class="entry"><div class="when">${new Date(e.date).toLocaleString()}</div>
        <h3>${e.moved.map(m => `${esc(m.text)} moved ${m.to}`).join("<br>")}</h3>
        ${e.note ? `<p class="hint" style="margin:0">${esc(e.note)}</p>` : ""}
        ${blocks.length ? `<div class="changes">${blocks.join("")}</div>` : `<p class="hint" style="margin:6px 0 0">No changes to the capabilities were needed.</p>`}</article>`;
    }).join("");
  }

  /* ---------- actions ---------- */
  function placeTask(id, zone){
    const t = task(id); if(!t || t.zone === zone) return;
    const from = t.zone; t.zone = zone;
    if(from && zone){
      if(!state.pending) state.pending = {before:{inside:state.zoneCaps.inside.slice(), outside:state.zoneCaps.outside.slice()}, moved:[]};
      state.pending.moved = state.pending.moved.filter(m => m.id !== id);
      state.pending.moved.push({id, text:t.text, from, to:zone});
    }
    save(); render();
  }
  function addCap(cid, zone, fromZone){
    if(fromZone && fromZone !== zone) state.zoneCaps[fromZone] = state.zoneCaps[fromZone].filter(x => x !== cid);
    if(!state.zoneCaps[zone].includes(cid)) state.zoneCaps[zone].push(cid);
    save(); render();
  }
  function removeCap(cid, zone){ state.zoneCaps[zone] = state.zoneCaps[zone].filter(x => x !== cid); save(); render(); }

  $("btn-reviewed").addEventListener("click", () => {
    const p = state.pending; if(!p) return;
    // The log stores names, not ids, so it stays readable after library.json changes.
    const nameOf = id => { const c = cap(id); return c ? c.name : null; };
    const added = {}, removed = {};
    ["inside","outside"].forEach(z => {
      added[z] = state.zoneCaps[z].filter(x => !p.before[z].includes(x)).map(nameOf).filter(Boolean);
      removed[z] = p.before[z].filter(x => !state.zoneCaps[z].includes(x)).map(nameOf).filter(Boolean);
    });
    state.log.push({date:new Date().toISOString(), moved:p.moved.map(m => ({text:m.text, from:m.from, to:m.to})), added, removed, note:$("banner-note").value.trim()});
    state.pending = null; $("banner-note").value = ""; save(); render(); toast("Saved to review log");
  });

  /* ---------- drag and drop (mouse and touch) ---------- */
  let drag = null;
  document.addEventListener("pointerdown", e => {
    if(e.button !== undefined && e.button !== 0) return;
    if(e.target.closest(".x")) return;
    const el = e.target.closest("[data-drag]"); if(!el) return;
    drag = {el, kind:el.dataset.drag, id:el.dataset.id, from:el.dataset.from || null, x:e.clientX, y:e.clientY, started:false};
  });
  document.addEventListener("pointermove", e => {
    if(!drag) return;
    if(!drag.started){
      if(Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return;
      drag.started = true;
      const r = drag.el.getBoundingClientRect();
      drag.dx = drag.x - r.left; drag.dy = drag.y - r.top;
      drag.ghost = drag.el.cloneNode(true); drag.ghost.classList.add("ghost"); drag.ghost.style.width = r.width + "px";
      document.body.appendChild(drag.ghost); drag.el.classList.add("dragging");
    }
    e.preventDefault();
    drag.ghost.style.left = (e.clientX - drag.dx) + "px";
    drag.ghost.style.top = (e.clientY - drag.dy) + "px";
    const t = findTarget(e.clientX, e.clientY);
    if(t !== drag.over){ if(drag.over) drag.over.classList.remove("over"); drag.over = t; if(t) t.classList.add("over"); }
  }, {passive:false});
  function findTarget(x, y){
    const el = document.elementFromPoint(x, y); if(!el) return null;
    const lib = el.closest('[data-drop="library"]');
    if(drag.kind === "task") return el.closest('[data-drop="tasks"]') || lib;
    const box = el.closest('[data-drop="caps"]');
    if(box){
      const c = cap(drag.id);
      return box.dataset.cat === c.cat ? box : box.closest(".ksa").querySelector(`[data-cat="${c.cat}"]`);
    }
    return drag.from ? lib : null;
  }
  function endDrag(cancelled){
    if(!drag) return;
    const d = drag; drag = null;
    if(!d.started) return;
    d.ghost.remove(); d.el.classList.remove("dragging");
    if(d.over) d.over.classList.remove("over");
    if(cancelled || !d.over) return;
    const t = d.over;
    if(d.kind === "task") placeTask(d.id, t.dataset.drop === "library" ? null : t.dataset.zone);
    else if(t.dataset.drop === "caps") addCap(d.id, t.dataset.zone, d.from);
    else if(t.dataset.drop === "library" && d.from) removeCap(d.id, d.from);
  }
  document.addEventListener("pointerup", () => endDrag(false));
  document.addEventListener("pointercancel", () => endDrag(true));

  /* ---------- adding items in the app ---------- */
  document.addEventListener("click", e => {
    const x = e.target.closest("[data-remove]"); if(x){ removeCap(x.dataset.remove, x.dataset.zone); return; }
    const ab = e.target.closest("[data-addbtn]"); if(ab) addItem(ab.dataset.addbtn);
  });
  document.addEventListener("keydown", e => { if(e.key === "Enter" && e.target.matches("[data-add]")) addItem(e.target.dataset.add); });
  document.addEventListener("toggle", e => { const d = e.target; if(d.matches && d.matches("details[data-key]")){ state.open[d.dataset.key] = d.open; save(); } }, true);
  function addItem(key){
    const input = document.querySelector(`[data-add="${key}"]`); const v = input.value.trim(); if(!v) return;
    state.open[key] = true;
    if(key === "T") state.tasks.push({id:"custom|" + uid(), text:v, zone:null, custom:true});
    else state.caps.push({id:"custom|" + uid(), cat:key, name:v, custom:true});
    save(); render(); toast("Added");
    const again = document.querySelector(`[data-add="${key}"]`); if(again) again.focus();
  }

  /* ---------- toolbar ---------- */
  $("btn-reset").addEventListener("click", () => { if(confirm("Start over? All placements, added items and reviews will be cleared.")){ state = fresh(); save(); render(); } });
  $("btn-example").addEventListener("click", () => {
    if(!confirm("Load the worked example? Your current work will be replaced.")) return;
    state = fresh();
    const ex = LIB.example || {};
    ["inside","outside"].forEach(z => {
      const e = ex[z] || {};
      (e.tasks || []).forEach(text => { const t = state.tasks.find(x => x.text === text); if(t) t.zone = z; });
      CATS.forEach(([c,,k]) => (e[k] || []).forEach(name => {
        const x = state.caps.find(y => y.cat === c && y.name === name);
        if(x) state.zoneCaps[z].push(x.id);
      }));
    });
    save(); render(); toast("Example loaded");
  });
  $("btn-copy").addEventListener("click", async () => {
    const out = [];
    ["outside","inside"].forEach(z => {
      out.push(ZONES[z].title.toUpperCase() + " (" + ZONES[z].def + ")");
      out.push("Tasks: " + (state.tasks.filter(t => t.zone === z).map(t => t.text).join("; ") || "none"));
      CATS.forEach(([c,l]) => out.push(`${l}: ` + (state.zoneCaps[z].map(cap).filter(x => x && x.cat === c).map(x => x.name).join(", ") || "none")));
      out.push("");
    });
    try{ await navigator.clipboard.writeText(out.join("\n")); toast("Summary copied"); }catch(e){ toast("Copying is not available in this browser"); }
  });
  function tab(w){
    $("tab-map").setAttribute("aria-selected", w === "map"); $("tab-log").setAttribute("aria-selected", w === "log");
    $("view-map").hidden = w !== "map"; $("view-log").hidden = w !== "log";
  }
  $("tab-map").addEventListener("click", () => tab("map"));
  $("tab-log").addEventListener("click", () => tab("log"));

  save();
  render();
})();
