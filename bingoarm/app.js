(() => {
  "use strict";

  const STORAGE_KEY = "arm-wrestling-chain.local.v1";
  const THEME_KEY = "arm-wrestling-chain.theme";
  const config = Object.assign({
    siteName: "Arm Wrestling Chain",
    submitMode: "download",
    submissionEndpoint: "",
    globalGraphUrl: "global-graph.json"
  }, window.ARM_GRAPH_CONFIG || {});

  const emptyGlobal = {
    schemaVersion: 1,
    graphVersion: "unavailable-empty",
    updatedAt: new Date(0).toISOString(),
    people: [],
    matches: []
  };

  const state = {
    global: emptyGlobal,
    local: loadLocalData(),
    cy: null,
    selectedPersonId: null,
    direction: "TB",
    loadedFromFallback: false,
    analysis: null
  };

  const el = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheElements();
    document.title = config.siteName;
    applySavedTheme();
    bindEvents();

    if (typeof window.cytoscape !== "function") {
      showGraphMessage("The graph library could not load. Check your internet connection or host a local copy of Cytoscape.js.", true);
      return;
    }

    await loadGlobalGraph();
    createGraph();
    renderAll(true);
  }

  function cacheElements() {
    [
      "themeButton", "helpButton", "helpDialog", "confirmDialog", "confirmResetButton",
      "searchInput", "fitButton", "layoutButton", "directionButton", "showGlobal", "showLocal",
      "peopleCount", "matchCount", "localCount", "cycleCount", "matchForm", "winnerInput",
      "loserInput", "dateInput", "contextInput", "noteInput", "peopleList", "swapButton",
      "formStatus", "exportButton", "submitButton", "resetButton", "graphMessage", "cy",
      "emptyDetails", "personDetails", "detailName", "detailSource", "detailWins", "detailLosses",
      "detailReach", "detailTier", "addWinButton", "addLossButton", "winsList", "lossesList",
      "submissionFiles", "mergeButton", "globalFile", "adminStatus", "versionText"
    ].forEach(id => { el[id] = document.getElementById(id); });
  }

  function bindEvents() {
    el.matchForm.addEventListener("submit", addMatchFromForm);
    el.swapButton.addEventListener("click", () => {
      const currentWinner = el.winnerInput.value;
      el.winnerInput.value = el.loserInput.value;
      el.loserInput.value = currentWinner;
    });

    el.fitButton.addEventListener("click", () => state.cy && state.cy.fit(undefined, 48));
    el.layoutButton.addEventListener("click", runLayout);
    el.directionButton.addEventListener("click", () => {
      state.direction = state.direction === "TB" ? "LR" : "TB";
      el.directionButton.dataset.direction = state.direction;
      el.directionButton.textContent = state.direction === "TB" ? "Top → bottom" : "Left → right";
      runLayout();
    });

    el.showGlobal.addEventListener("change", () => renderAll(true));
    el.showLocal.addEventListener("change", () => renderAll(true));
    el.searchInput.addEventListener("input", handleSearch);
    el.searchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        focusFirstSearchResult();
      }
    });

    el.exportButton.addEventListener("click", () => exportSubmission(true));
    el.submitButton.addEventListener("click", submitForReview);
    el.resetButton.addEventListener("click", () => el.confirmDialog.showModal());
    el.confirmResetButton.addEventListener("click", () => {
      state.local = emptyLocalData();
      saveLocalData();
      state.selectedPersonId = null;
      renderAll(true);
      setStatus(el.formStatus, "Local additions deleted.");
    });

    el.addWinButton.addEventListener("click", () => prepareQuickAdd("win"));
    el.addLossButton.addEventListener("click", () => prepareQuickAdd("loss"));

    el.helpButton.addEventListener("click", () => el.helpDialog.showModal());
    el.themeButton.addEventListener("click", toggleTheme);

    el.mergeButton.addEventListener("click", mergeSubmissionsAndDownload);
    el.globalFile.addEventListener("change", previewGlobalFile);
  }

  async function loadGlobalGraph() {
    try {
      const response = await fetch(config.globalGraphUrl, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.global = normalizeGlobalGraph(data);
      state.loadedFromFallback = false;
    } catch (error) {
      state.global = normalizeGlobalGraph(emptyGlobal);
      state.loadedFromFallback = true;
      setStatus(el.formStatus, "Could not load global-graph.json. The graph is empty until the site is served over HTTP or the file path is fixed.", true);
    }
  }

  function createGraph() {
    state.cy = window.cytoscape({
      container: el.cy,
      elements: [],
      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.16,
      boxSelectionEnabled: false,
      selectionType: "single",
      style: graphStyles()
    });

    state.cy.on("tap", "node", event => selectPerson(event.target.id()));
    state.cy.on("tap", "edge", event => {
      const match = event.target.data("match");
      if (!match) return;
      const graph = getCombinedGraph();
      const people = mapPeople(graph.people);
      const winner = people.get(match.winnerId)?.name || "Unknown";
      const loser = people.get(match.loserId)?.name || "Unknown";
      const extra = [match.date, match.context, match.note].filter(Boolean).join(" · ");
      setStatus(el.formStatus, `${winner} beat ${loser}${extra ? ` — ${extra}` : ""}.`);
    });
    state.cy.on("tap", event => {
      if (event.target === state.cy) clearSelection();
    });
  }

  function renderAll(shouldLayout = false) {
    const graph = getVisibleGraph();
    state.analysis = analyzeGraph(graph);
    renderDatalist(getCombinedGraph().people);
    renderSummary(graph, state.analysis);
    renderGraph(graph, state.analysis, shouldLayout);
    renderSelectedPerson();
    renderVersion();
  }

  function getCombinedGraph() {
    return combineGraphs(state.global, state.local);
  }

  function getVisibleGraph() {
    const showGlobal = el.showGlobal.checked;
    const showLocal = el.showLocal.checked;
    const combined = getCombinedGraph();

    const matches = combined.matches.filter(match =>
      (match.source === "global" && showGlobal) || (match.source === "local" && showLocal)
    );

    const linkedIds = new Set();
    matches.forEach(match => {
      linkedIds.add(match.winnerId);
      linkedIds.add(match.loserId);
    });

    const people = combined.people.filter(person => {
      if (linkedIds.has(person.id)) return true;
      return (person.source === "global" && showGlobal) || (person.source === "local" && showLocal);
    });

    return { people, matches };
  }

  function combineGraphs(globalGraph, localGraph) {
    const people = [];
    const seenPeople = new Set();

    globalGraph.people.forEach(person => {
      people.push({ ...person, source: "global" });
      seenPeople.add(person.id);
    });

    localGraph.people.forEach(person => {
      if (!seenPeople.has(person.id)) people.push({ ...person, source: "local" });
    });

    const matches = [
      ...globalGraph.matches.map(match => ({ ...match, source: "global" })),
      ...localGraph.matches.map(match => ({ ...match, source: "local" }))
    ];

    return { people, matches };
  }

  function renderGraph(graph, analysis, shouldLayout) {
    if (!state.cy) return;
    const peopleById = mapPeople(graph.people);
    const elements = [];

    graph.people.forEach(person => {
      const metrics = analysis.metrics.get(person.id) || { wins: 0, losses: 0, reach: 0, tier: 1 };
      elements.push({
        group: "nodes",
        data: {
          id: person.id,
          label: person.name,
          source: person.source,
          wins: metrics.wins,
          losses: metrics.losses,
          reach: metrics.reach,
          tier: metrics.tier,
          nodeSize: Math.min(72, 42 + Math.sqrt(metrics.reach + metrics.wins) * 5)
        },
        classes: person.source === "local" ? "local-node" : "global-node"
      });
    });

    graph.matches.forEach(match => {
      if (!peopleById.has(match.winnerId) || !peopleById.has(match.loserId)) return;
      const isCycle = analysis.cycleEdgeIds.has(match.id);
      elements.push({
        group: "edges",
        data: {
          id: match.id,
          source: match.winnerId,
          target: match.loserId,
          match,
          edgeSource: match.source
        },
        classes: `${match.source === "local" ? "local-edge" : "global-edge"}${isCycle ? " cycle-edge" : ""}`
      });
    });

    state.cy.batch(() => {
      state.cy.elements().remove();
      state.cy.add(elements);
      state.cy.style(graphStyles());
    });

    if (state.selectedPersonId && state.cy.getElementById(state.selectedPersonId).length) {
      state.cy.getElementById(state.selectedPersonId).addClass("selected-person");
    }

    showGraphMessage(elements.length ? "" : "No records are visible.");
    if (shouldLayout && elements.length) runLayout();
  }

  function graphStyles() {
    const css = getComputedStyle(document.body);
    const surface = css.getPropertyValue("--surface").trim();
    const surface2 = css.getPropertyValue("--surface-2").trim();
    const ink = css.getPropertyValue("--ink").trim();
    const muted = css.getPropertyValue("--muted").trim();
    const accent = css.getPropertyValue("--accent").trim();
    const green = css.getPropertyValue("--green").trim();
    const greenSoft = css.getPropertyValue("--green-soft").trim();

    return [
      {
        selector: "node",
        style: {
          "label": "data(label)",
          "width": "data(nodeSize)",
          "height": "data(nodeSize)",
          "background-color": surface2,
          "border-width": 2,
          "border-color": ink,
          "color": ink,
          "font-size": 11,
          "font-weight": 700,
          "text-wrap": "wrap",
          "text-max-width": 92,
          "text-valign": "center",
          "text-halign": "center",
          "overlay-opacity": 0,
          "transition-property": "border-width, border-color, background-color, opacity",
          "transition-duration": "120ms"
        }
      },
      {
        selector: "node.local-node",
        style: {
          "background-color": greenSoft,
          "border-color": green,
          "border-style": "double",
          "border-width": 4
        }
      },
      {
        selector: "node:selected, node.selected-person",
        style: {
          "border-color": accent,
          "border-width": 5,
          "background-color": surface
        }
      },
      {
        selector: "node.search-dim",
        style: { "opacity": 0.15 }
      },
      {
        selector: "node.search-hit",
        style: { "border-color": accent, "border-width": 5 }
      },
      {
        selector: "edge",
        style: {
          "width": 2.2,
          "line-color": muted,
          "target-arrow-color": muted,
          "target-arrow-shape": "triangle",
          "arrow-scale": 1.05,
          "curve-style": "bezier",
          "opacity": 0.72,
          "overlay-opacity": 0
        }
      },
      {
        selector: "edge.local-edge",
        style: {
          "line-color": green,
          "target-arrow-color": green,
          "width": 3
        }
      },
      {
        selector: "edge.cycle-edge",
        style: {
          "line-color": accent,
          "target-arrow-color": accent,
          "line-style": "dashed",
          "width": 3.4,
          "opacity": 1
        }
      },
      {
        selector: "edge.search-dim",
        style: { "opacity": 0.07 }
      },
      {
        selector: "edge:selected",
        style: { "line-color": accent, "target-arrow-color": accent, "width": 4 }
      }
    ];
  }

  function runLayout() {
    if (!state.cy || !state.cy.nodes().length) return;
    const options = {
      name: "dagre",
      rankDir: state.direction,
      rankSep: state.direction === "TB" ? 100 : 130,
      nodeSep: 48,
      edgeSep: 24,
      padding: 50,
      animate: state.cy.nodes().length < 90,
      animationDuration: 450,
      fit: true
    };

    try {
      state.cy.layout(options).run();
    } catch (error) {
      state.cy.layout({
        name: "cose",
        animate: false,
        fit: true,
        padding: 50,
        nodeRepulsion: 8000,
        idealEdgeLength: 100
      }).run();
      setStatus(el.formStatus, "DAG layout could not resolve this graph, so a force layout was used.", true);
    }
  }

  function renderSummary(graph, analysis) {
    el.peopleCount.textContent = String(graph.people.length);
    el.matchCount.textContent = String(graph.matches.length);
    el.localCount.textContent = String(state.local.matches.length);
    el.cycleCount.textContent = String(analysis.cycleComponents.length);
  }

  function renderDatalist(people) {
    const fragment = document.createDocumentFragment();
    [...people].sort((a, b) => a.name.localeCompare(b.name)).forEach(person => {
      const option = document.createElement("option");
      option.value = person.name;
      fragment.appendChild(option);
    });
    el.peopleList.replaceChildren(fragment);
  }

  function selectPerson(personId) {
    state.selectedPersonId = personId;
    if (state.cy) {
      state.cy.nodes().removeClass("selected-person");
      state.cy.getElementById(personId).addClass("selected-person");
    }
    renderSelectedPerson();
  }

  function clearSelection() {
    state.selectedPersonId = null;
    if (state.cy) state.cy.nodes().removeClass("selected-person");
    renderSelectedPerson();
  }

  function renderSelectedPerson() {
    const graph = getVisibleGraph();
    const person = graph.people.find(item => item.id === state.selectedPersonId);
    if (!person) {
      el.emptyDetails.hidden = false;
      el.personDetails.hidden = true;
      return;
    }

    const metrics = state.analysis?.metrics.get(person.id) || { wins: 0, losses: 0, reach: 0, tier: 1 };
    el.emptyDetails.hidden = true;
    el.personDetails.hidden = false;
    el.detailName.textContent = person.name;
    el.detailSource.textContent = person.source === "local" ? "Local person" : "Global person";
    el.detailSource.className = `source-badge ${person.source === "local" ? "local" : "global"}`;
    el.detailWins.textContent = metrics.wins;
    el.detailLosses.textContent = metrics.losses;
    el.detailReach.textContent = metrics.reach;
    el.detailTier.textContent = metrics.tier;

    const peopleById = mapPeople(graph.people);
    const wins = graph.matches.filter(match => match.winnerId === person.id);
    const losses = graph.matches.filter(match => match.loserId === person.id);
    renderRecordList(el.winsList, wins, match => peopleById.get(match.loserId), "No recorded wins in the current view.");
    renderRecordList(el.lossesList, losses, match => peopleById.get(match.winnerId), "No recorded losses in the current view.");
  }

  function renderRecordList(listElement, matches, getOtherPerson, emptyText) {
    if (!matches.length) {
      const item = document.createElement("li");
      item.className = "empty-record";
      item.textContent = emptyText;
      listElement.replaceChildren(item);
      return;
    }

    const fragment = document.createDocumentFragment();
    matches.sort((a, b) => (getOtherPerson(a)?.name || "").localeCompare(getOtherPerson(b)?.name || ""));
    matches.forEach(match => {
      const other = getOtherPerson(match);
      const item = document.createElement("li");
      item.className = "record-item";

      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = other?.name || "Unknown person";
      info.appendChild(name);

      const metaText = [match.date, match.context, match.note].filter(Boolean).join(" · ");
      if (metaText) {
        const meta = document.createElement("span");
        meta.className = "record-meta";
        meta.textContent = metaText;
        info.appendChild(meta);
      }
      item.appendChild(info);

      if (match.source === "local") {
        const remove = document.createElement("button");
        remove.type = "button";
        remove.title = "Remove this local match";
        remove.setAttribute("aria-label", "Remove this local match");
        remove.textContent = "×";
        remove.addEventListener("click", () => removeLocalMatch(match.id));
        item.appendChild(remove);
      }

      fragment.appendChild(item);
    });
    listElement.replaceChildren(fragment);
  }

  function addMatchFromForm(event) {
    event.preventDefault();
    const winnerName = cleanName(el.winnerInput.value);
    const loserName = cleanName(el.loserInput.value);

    if (!winnerName || !loserName) {
      setStatus(el.formStatus, "Enter both a winner and a loser.", true);
      return;
    }
    if (normalizeName(winnerName) === normalizeName(loserName)) {
      setStatus(el.formStatus, "A person cannot beat themselves.", true);
      return;
    }

    const combined = getCombinedGraph();
    const winner = findOrCreatePerson(winnerName, combined.people);
    const loser = findOrCreatePerson(loserName, getCombinedGraph().people);

    const duplicate = getCombinedGraph().matches.some(match => match.winnerId === winner.id && match.loserId === loser.id);
    if (duplicate) {
      setStatus(el.formStatus, `${winner.name} → ${loser.name} is already recorded.`, true);
      return;
    }

    state.local.matches.push({
      id: `local-match-${makeId()}`,
      winnerId: winner.id,
      loserId: loser.id,
      date: el.dateInput.value || "",
      context: el.contextInput.value.trim(),
      note: el.noteInput.value.trim(),
      createdAt: new Date().toISOString()
    });
    saveLocalData();

    el.matchForm.reset();
    setStatus(el.formStatus, `Added: ${winner.name} beat ${loser.name}.`);
    state.selectedPersonId = winner.id;
    renderAll(true);
  }

  function findOrCreatePerson(name, people) {
    const existing = people.find(person => normalizeName(person.name) === normalizeName(name));
    if (existing) return existing;

    const person = {
      id: `local-${slugify(name)}-${makeId().slice(0, 6)}`,
      name,
      createdAt: new Date().toISOString()
    };
    state.local.people.push(person);
    return person;
  }

  function removeLocalMatch(matchId) {
    state.local.matches = state.local.matches.filter(match => match.id !== matchId);
    pruneUnusedLocalPeople();
    saveLocalData();
    renderAll(true);
    setStatus(el.formStatus, "Local match removed.");
  }

  function pruneUnusedLocalPeople() {
    const usedIds = new Set();
    state.local.matches.forEach(match => {
      usedIds.add(match.winnerId);
      usedIds.add(match.loserId);
    });
    state.local.people = state.local.people.filter(person => usedIds.has(person.id));
  }

  function prepareQuickAdd(mode) {
    const graph = getCombinedGraph();
    const person = graph.people.find(item => item.id === state.selectedPersonId);
    if (!person) return;

    if (mode === "win") {
      el.winnerInput.value = person.name;
      el.loserInput.value = "";
      el.loserInput.focus();
    } else {
      el.loserInput.value = person.name;
      el.winnerInput.value = "";
      el.winnerInput.focus();
    }
    document.querySelector(".add-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSearch() {
    if (!state.cy) return;
    const query = normalizeName(el.searchInput.value);
    state.cy.elements().removeClass("search-hit search-dim");
    if (!query) return;

    const hits = state.cy.nodes().filter(node => normalizeName(node.data("label")).includes(query));
    if (!hits.length) {
      state.cy.elements().addClass("search-dim");
      return;
    }

    state.cy.elements().addClass("search-dim");
    hits.removeClass("search-dim").addClass("search-hit");
    hits.connectedEdges().removeClass("search-dim");
  }

  function focusFirstSearchResult() {
    if (!state.cy) return;
    const hit = state.cy.nodes(".search-hit").first();
    if (!hit.length) return;
    state.cy.animate({ center: { eles: hit }, zoom: Math.max(state.cy.zoom(), 1.25) }, { duration: 300 });
    selectPerson(hit.id());
  }

  function analyzeGraph(graph) {
    const ids = graph.people.map(person => person.id);
    const adjacency = new Map(ids.map(id => [id, []]));
    const reverse = new Map(ids.map(id => [id, []]));
    const edgeLookup = new Map();

    graph.matches.forEach(match => {
      if (!adjacency.has(match.winnerId) || !adjacency.has(match.loserId)) return;
      adjacency.get(match.winnerId).push(match.loserId);
      reverse.get(match.loserId).push(match.winnerId);
      edgeLookup.set(`${match.winnerId}\u0000${match.loserId}`, match.id);
    });

    const sccs = tarjan(ids, adjacency);
    const componentByNode = new Map();
    sccs.forEach((component, index) => component.forEach(id => componentByNode.set(id, index)));

    const cycleComponents = sccs.filter(component => component.length > 1 || adjacency.get(component[0])?.includes(component[0]));
    const cycleComponentIds = new Set();
    cycleComponents.forEach(component => component.forEach(id => cycleComponentIds.add(componentByNode.get(id))));

    const cycleEdgeIds = new Set();
    graph.matches.forEach(match => {
      const sourceComponent = componentByNode.get(match.winnerId);
      const targetComponent = componentByNode.get(match.loserId);
      if (sourceComponent === targetComponent && cycleComponentIds.has(sourceComponent)) cycleEdgeIds.add(match.id);
    });

    const componentAdj = new Map(sccs.map((_, index) => [index, new Set()]));
    const indegree = new Map(sccs.map((_, index) => [index, 0]));
    graph.matches.forEach(match => {
      const from = componentByNode.get(match.winnerId);
      const to = componentByNode.get(match.loserId);
      if (from === undefined || to === undefined || from === to || componentAdj.get(from).has(to)) return;
      componentAdj.get(from).add(to);
      indegree.set(to, indegree.get(to) + 1);
    });

    const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id);
    const tierByComponent = new Map(sccs.map((_, index) => [index, 1]));
    while (queue.length) {
      const current = queue.shift();
      componentAdj.get(current).forEach(next => {
        tierByComponent.set(next, Math.max(tierByComponent.get(next), tierByComponent.get(current) + 1));
        indegree.set(next, indegree.get(next) - 1);
        if (indegree.get(next) === 0) queue.push(next);
      });
    }

    const metrics = new Map();
    ids.forEach(id => {
      metrics.set(id, {
        wins: adjacency.get(id).length,
        losses: reverse.get(id).length,
        reach: countReach(id, adjacency),
        tier: tierByComponent.get(componentByNode.get(id)) || 1
      });
    });

    return { metrics, cycleComponents, cycleEdgeIds };
  }

  function countReach(start, adjacency) {
    const visited = new Set([start]);
    const stack = [...(adjacency.get(start) || [])];
    while (stack.length) {
      const current = stack.pop();
      if (visited.has(current)) continue;
      visited.add(current);
      (adjacency.get(current) || []).forEach(next => stack.push(next));
    }
    return Math.max(0, visited.size - 1);
  }

  function tarjan(nodes, adjacency) {
    let index = 0;
    const stack = [];
    const onStack = new Set();
    const indices = new Map();
    const lowLink = new Map();
    const components = [];

    function strongConnect(node) {
      indices.set(node, index);
      lowLink.set(node, index);
      index += 1;
      stack.push(node);
      onStack.add(node);

      (adjacency.get(node) || []).forEach(next => {
        if (!indices.has(next)) {
          strongConnect(next);
          lowLink.set(node, Math.min(lowLink.get(node), lowLink.get(next)));
        } else if (onStack.has(next)) {
          lowLink.set(node, Math.min(lowLink.get(node), indices.get(next)));
        }
      });

      if (lowLink.get(node) === indices.get(node)) {
        const component = [];
        let current;
        do {
          current = stack.pop();
          onStack.delete(current);
          component.push(current);
        } while (current !== node);
        components.push(component);
      }
    }

    nodes.forEach(node => {
      if (!indices.has(node)) strongConnect(node);
    });
    return components;
  }

  function exportSubmission(download = true) {
    const payload = buildSubmissionPayload();
    if (!state.local.matches.length) {
      setStatus(el.formStatus, "There are no local changes to export.", true);
      return payload;
    }
    if (download) {
      downloadJson(payload, `arm-wrestling-submission-${dateStamp()}.json`);
      setStatus(el.formStatus, "Your local changes were exported.");
    }
    return payload;
  }

  function buildSubmissionPayload() {
    return {
      schemaVersion: 1,
      type: "arm-wrestling-graph-submission",
      baseGraphVersion: state.global.graphVersion,
      exportedAt: new Date().toISOString(),
      people: state.local.people,
      matches: state.local.matches
    };
  }

  async function submitForReview() {
    const payload = exportSubmission(false);
    if (!payload.matches.length) {
      setStatus(el.formStatus, "There are no local changes to submit.", true);
      return;
    }

    if (config.submitMode !== "endpoint" || !config.submissionEndpoint) {
      downloadJson(payload, `arm-wrestling-submission-${dateStamp()}.json`);
      setStatus(el.formStatus, "Submission file downloaded. Send it to the site owner for review.");
      return;
    }

    el.submitButton.disabled = true;
    el.submitButton.textContent = "Sending…";
    try {
      const response = await fetch(config.submissionEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setStatus(el.formStatus, "Changes sent for global review.");
    } catch (error) {
      downloadJson(payload, `arm-wrestling-submission-${dateStamp()}.json`);
      setStatus(el.formStatus, "The submission endpoint failed, so a JSON file was downloaded instead.", true);
    } finally {
      el.submitButton.disabled = false;
      el.submitButton.textContent = "Send for global review";
    }
  }

  async function mergeSubmissionsAndDownload() {
    const files = [...el.submissionFiles.files];
    if (!files.length) {
      setStatus(el.adminStatus, "Choose at least one exported submission file.", true);
      return;
    }

    try {
      const submissions = await Promise.all(files.map(readJsonFile));
      const merged = mergeIntoGlobal(state.global, submissions);
      downloadJson(merged, "global-graph.json");
      setStatus(el.adminStatus, `Merged ${files.length} submission file${files.length === 1 ? "" : "s"}: ${merged.people.length} people and ${merged.matches.length} matches.`);
    } catch (error) {
      setStatus(el.adminStatus, `Merge failed: ${error.message}`, true);
    }
  }

  function mergeIntoGlobal(baseGlobal, submissions) {
    const result = normalizeGlobalGraph(structuredClone(baseGlobal));
    const canonicalToId = new Map(result.people.map(person => [normalizeName(person.name), person.id]));
    const existingEdges = new Set(result.matches.map(match => `${match.winnerId}\u0000${match.loserId}`));
    const usedIds = new Set(result.people.map(person => person.id));

    submissions.forEach(raw => {
      const submission = normalizeSubmission(raw);
      const idMap = new Map();

      submission.people.forEach(person => {
        const canonical = normalizeName(person.name);
        let globalId = canonicalToId.get(canonical);
        if (!globalId) {
          globalId = uniqueGlobalId(slugify(person.name), usedIds);
          usedIds.add(globalId);
          canonicalToId.set(canonical, globalId);
          result.people.push({ id: globalId, name: cleanName(person.name) });
        }
        idMap.set(person.id, globalId);
      });

      submission.matches.forEach(match => {
        const winnerId = idMap.get(match.winnerId) || match.winnerId;
        const loserId = idMap.get(match.loserId) || match.loserId;
        if (!usedIds.has(winnerId) || !usedIds.has(loserId) || winnerId === loserId) return;
        const key = `${winnerId}\u0000${loserId}`;
        if (existingEdges.has(key)) return;
        existingEdges.add(key);
        result.matches.push({
          id: uniqueMatchId(winnerId, loserId, result.matches),
          winnerId,
          loserId,
          date: match.date || "",
          context: match.context || "",
          note: match.note || ""
        });
      });
    });

    result.people.sort((a, b) => a.name.localeCompare(b.name));
    result.graphVersion = `global-${dateStamp()}-${result.matches.length}`;
    result.updatedAt = new Date().toISOString();
    return result;
  }

  async function previewGlobalFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      state.global = normalizeGlobalGraph(await readJsonFile(file));
      state.selectedPersonId = null;
      renderAll(true);
      setStatus(el.adminStatus, `Previewing ${file.name}. This does not upload or overwrite anything.`);
    } catch (error) {
      setStatus(el.adminStatus, `Could not load that graph: ${error.message}`, true);
    }
  }

  function normalizeGlobalGraph(raw) {
    if (!raw || !Array.isArray(raw.people) || !Array.isArray(raw.matches)) throw new Error("Invalid global graph format");
    const people = raw.people
      .filter(person => person && person.id && cleanName(person.name))
      .map(person => ({ id: String(person.id), name: cleanName(person.name) }));
    const validIds = new Set(people.map(person => person.id));
    const matches = raw.matches
      .filter(match => match && match.id && validIds.has(String(match.winnerId)) && validIds.has(String(match.loserId)) && match.winnerId !== match.loserId)
      .map(match => ({
        id: String(match.id),
        winnerId: String(match.winnerId),
        loserId: String(match.loserId),
        date: String(match.date || ""),
        context: String(match.context || ""),
        note: String(match.note || "")
      }));
    return {
      schemaVersion: 1,
      graphVersion: String(raw.graphVersion || "unversioned"),
      updatedAt: String(raw.updatedAt || ""),
      people,
      matches
    };
  }

  function normalizeSubmission(raw) {
    if (!raw || !Array.isArray(raw.people) || !Array.isArray(raw.matches)) throw new Error("A submission file has the wrong format");
    return {
      people: raw.people.map(person => ({ id: String(person.id), name: cleanName(person.name) })).filter(person => person.id && person.name),
      matches: raw.matches.map(match => ({
        winnerId: String(match.winnerId),
        loserId: String(match.loserId),
        date: String(match.date || ""),
        context: String(match.context || ""),
        note: String(match.note || "")
      }))
    };
  }

  function loadLocalData() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!raw || !Array.isArray(raw.people) || !Array.isArray(raw.matches)) return emptyLocalData();
      return {
        schemaVersion: 1,
        createdAt: raw.createdAt || new Date().toISOString(),
        people: raw.people,
        matches: raw.matches
      };
    } catch (error) {
      return emptyLocalData();
    }
  }

  function emptyLocalData() {
    return { schemaVersion: 1, createdAt: new Date().toISOString(), people: [], matches: [] };
  }

  function saveLocalData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.local));
  }

  function applySavedTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const dark = saved === "dark" || (!saved && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.body.classList.toggle("dark", dark);
    el.themeButton.textContent = dark ? "Light mode" : "Dark mode";
  }

  function toggleTheme() {
    const dark = document.body.classList.toggle("dark");
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
    el.themeButton.textContent = dark ? "Light mode" : "Dark mode";
    if (state.cy) state.cy.style(graphStyles());
  }

  function renderVersion() {
    const updated = state.global.updatedAt ? new Date(state.global.updatedAt).toLocaleDateString() : "unknown date";
    el.versionText.textContent = `Global graph ${state.global.graphVersion} · updated ${updated}${state.loadedFromFallback ? " · embedded fallback" : ""}`;
  }

  function showGraphMessage(message, isError = false) {
    el.graphMessage.textContent = message;
    el.graphMessage.hidden = !message;
    el.graphMessage.style.color = isError ? "var(--accent)" : "var(--muted)";
  }

  function setStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("error", isError);
  }

  function cleanName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function normalizeName(value) {
    return cleanName(value).toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  }

  function slugify(value) {
    return normalizeName(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "person";
  }

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function uniqueGlobalId(base, usedIds) {
    let candidate = base || "person";
    let suffix = 2;
    while (usedIds.has(candidate)) candidate = `${base}-${suffix++}`;
    return candidate;
  }

  function uniqueMatchId(winnerId, loserId, matches) {
    const base = `m-${winnerId}-${loserId}`;
    const used = new Set(matches.map(match => match.id));
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) candidate = `${base}-${suffix++}`;
    return candidate;
  }

  function mapPeople(people) {
    return new Map(people.map(person => [person.id, person]));
  }

  function dateStamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function readJsonFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try { resolve(JSON.parse(reader.result)); }
        catch (error) { reject(new Error(`${file.name} is not valid JSON`)); }
      };
      reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
      reader.readAsText(file);
    });
  }
})();
