// ==================== Global Variables ====================
let rawData = [];              //full dataset loaded from CSV
let filteredData = [];         //full dataset loaded from CSV
let geocodeCache = {};         //store mapping from location names to coordinates
let map, markerClusterGroup;   //Leaflet map and clustering layer
let outcomeChart, breedChart;  //interactive charts in sidebar

// Chart.js instances for initial analysis
let chartAnnualIntake, chartMovementDistribution, chartTopBreeds, chartCityAvgStay;

// ==================== Initialization on Page Load ====================
document.addEventListener("DOMContentLoaded", () => {
  initInitialCharts();     // Prepare empty initial charts
  initMap();               // Set up Leaflet map
  initInteractiveCharts(); // Prepare empty interactive sidebar charts
  loadCSVAndRender();      // Load data and render everything

  // Attach filter event listeners
  document
    .getElementById("yearSlider")
    .addEventListener("input", onFilterChange);
  document
    .getElementById("speciesSelect")
    .addEventListener("change", onFilterChange);
  document
    .getElementById("outcomeSelect")
    .addEventListener("change", onFilterChange);
});

// ==================== Load CSV and Trigger Initial Rendering ====================
function loadCSVAndRender() {
  Papa.parse("stray_animals_data.csv", {
    header: true,
    download: true,
    skipEmptyLines: true,
    complete: ({ data, errors }) => {
      if (errors.length > 0) {
        console.error("CSV parsing error:", errors);
        return;
      }
      // Filter out records missing required fields
      rawData = data.filter(
        d =>
          d.intakedate &&
          d.movementdate &&
          d.movementtype &&
          d.breedname &&
          d.location
      );
      updateInitialCharts();   // Populate initial charts with data
      onFilterChange();        // Apply default filters (year=2017 etc.)
    },
  });
}

// ==================== Initialize Empty Initial Analysis Charts ====================
function initInitialCharts() {
  // Annual Intake Line Chart
  const ctxAnnual = document
    .getElementById("chartAnnualIntake")
    .getContext("2d");
  chartAnnualIntake = new Chart(ctxAnnual, {
    type: "line",
    data: {
      labels: [], // years
      datasets: [
        {
          label: "Intake quantity",  // series label
          data: [],                  // counts per year
          borderColor: "#4a90e2",
          backgroundColor: "rgba(74, 144, 226, 0.2)",
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          title: { display: true, text: "Year" },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Intake quantity" },
        },
      },
    },
  });

  // Movement Type Distribution Pie Chart
  const ctxMove = document
    .getElementById("chartMovementDistribution")
    .getContext("2d");
  chartMovementDistribution = new Chart(ctxMove, {
    type: "pie",
    data: {
      labels: [],    // movement types
      datasets: [
        {
          data: [],
          backgroundColor: [
            "rgba(75,192,192,0.7)",
            "rgba(255,206,86,0.7)",
            "rgba(255,99,132,0.7)",
            "rgba(54,162,235,0.7)",
            "rgba(153,102,255,0.7)",
            "rgba(201,203,207,0.7)",
          ],
          borderColor: [
            "#4bc0c0",
            "#ffce56",
            "#ff6384",
            "#36a2eb",
            "#9966ff",
            "#c9cbcf",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            // Custom tooltip label to show valuev
            label: (ctx) => {
              const label = ctx.label || "";
              const val = ctx.raw || 0;
              return `${label}: ${val}`;
            },
          },
        },
      },
    },
  });

  // Top 10 Breeds Bar Chart
  const ctxBreed = document
    .getElementById("chartTopBreeds")
    .getContext("2d");
  chartTopBreeds = new Chart(ctxBreed, {
    type: "bar",
    data: {
      labels: [],   // breed names
      datasets: [
        {
          label: "Quantity",
          data: [],   // breed names
          backgroundColor: "rgba(54,162,235,0.7)",
          borderColor: "#36a2eb",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        x: {
          ticks: { autoSkip: false },
          title: { display: true, text: "Breed" },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Quantity" },
        },
      },
    },
  });

  // Top 10 Avg Stay by City Horizontal Bar Chart
  const ctxCity = document
    .getElementById("chartCityAvgStay")
    .getContext("2d");
  chartCityAvgStay = new Chart(ctxCity, {
    type: "bar",
    data: {
      labels: [],   // city names
      datasets: [
        {
          label: "Average duration of stay",
          data: [],   // average days
          backgroundColor: "rgba(255,159,64,0.7)",
          borderColor: "#ff9f40",
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",   // horizontal bars
      responsive: true,
      scales: {
        x: {
          beginAtZero: true,
          title: { display: true, text: "Average duration of stay" },
        },
        y: {
          title: { display: true, text: "City" },
        },
      },
    },
  });
}

// ==================== Populate Initial Charts with Data ====================
function updateInitialCharts() {
  // 1. Annual intake counts by year
  const df = rawData.map(d => ({
    year: new Date(d.intakedate).getFullYear(),
  }));
  // Count the number of occurrences each year
  const yearCountMap = {};
  df.forEach(row => {
    yearCountMap[row.year] = (yearCountMap[row.year] || 0) + 1;
  });
  const years = Object.keys(yearCountMap)
    .map(Number)
    .sort((a, b) => a - b);
  const yearCounts = years.map(y => yearCountMap[y]);
  chartAnnualIntake.data.labels = years;
  chartAnnualIntake.data.datasets[0].data = yearCounts;
  chartAnnualIntake.update();

  // 2. Movement type distribution
  const moveCountMap = {};
  rawData.forEach(d => {
    const mt = d.movementtype;
    moveCountMap[mt] = (moveCountMap[mt] || 0) + 1;
  });
  const moveLabels = Object.keys(moveCountMap);
  const moveValues = moveLabels.map(l => moveCountMap[l]);
  chartMovementDistribution.data.labels = moveLabels;
  chartMovementDistribution.data.datasets[0].data = moveValues;
  chartMovementDistribution.update();

  // 3. Top 10 breeds by frequency
  const breedCountMap = {};
  rawData.forEach(d => {
    const b = d.breedname;
    breedCountMap[b] = (breedCountMap[b] || 0) + 1;
  });
  const breedEntries = Object.entries(breedCountMap).sort(
    (a, b) => b[1] - a[1]
  );
  const topBreeds = breedEntries.slice(0, 10);
  const breedLabels = topBreeds.map(pair => pair[0]);
  const breedValues = topBreeds.map(pair => pair[1]);
  chartTopBreeds.data.labels = breedLabels;
  chartTopBreeds.data.datasets[0].data = breedValues;
  chartTopBreeds.update();

  // 4. Top 10 cities by average stay duration
  const stayDaysArray = rawData.map(d => {
    const days = (
      new Date(d.movementdate) - new Date(d.intakedate)
    ) / (1000 * 60 * 60 * 24);
    return { city: d.location.trim(), days };
  });
  const citySumCount = {};
  stayDaysArray.forEach(item => {
    const c = item.city;
    if (!citySumCount[c]) citySumCount[c] = { sum: 0, count: 0 };
    citySumCount[c].sum += item.days;
    citySumCount[c].count += 1;
  });
  const cityAvgArr = Object.entries(citySumCount).map(([city, val]) => ({
    city,
    avg: val.sum / val.count,
  }));
  const sortedCityAvg = cityAvgArr.sort((a, b) => b.avg - a.avg).slice(0, 10);
  const cityLabels = sortedCityAvg.map(item => item.city);
  const cityValues = sortedCityAvg.map(item => item.avg.toFixed(1));
  chartCityAvgStay.data.labels = cityLabels;
  chartCityAvgStay.data.datasets[0].data = cityValues;
  chartCityAvgStay.update();
}

// ==================== Initialize Interactive Sidebar Charts ====================
function initInteractiveCharts() {
  // Outcome distribution pie chart (initially zeroed)
  const ctxOutcome = document.getElementById("outcomeChart").getContext("2d");
  outcomeChart = new Chart(ctxOutcome, {
    type: "pie",
    data: {
      labels: ["Adoption", "Foster", "Reclaimed", "Transfer", "Released To Wild", "Stolen"],
      datasets: [
        {
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: [
            "rgba(75,192,192,0.7)",
            "rgba(255,206,86,0.7)",
            "rgba(255,99,132,0.7)",
            "rgba(54,162,235,0.7)",
            "rgba(153,102,255,0.7)",
            "rgba(201,203,207,0.7)",
          ],
          borderColor: [
            "#4bc0c0",
            "#ffce56",
            "#ff6384",
            "#36a2eb",
            "#9966ff",
            "#c9cbcf",
          ],
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const label = ctx.label || "";
              const val = ctx.raw || 0;
              return `${label}: ${val}`;
            },
          },
        },
      },
    },
  });

  // Top 5 breeds horizontal bar chart
  const ctxBreed = document.getElementById("breedChart").getContext("2d");
  breedChart = new Chart(ctxBreed, {
    type: "bar",
    data: {
      labels: ["", "", "", "", ""],    // placeholder labels
      datasets: [
        {
          label: "Quantity",
          data: [0, 0, 0, 0, 0],
          backgroundColor: "rgba(54,162,235,0.7)",
          borderColor: "#36a2eb",
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",   // horizontal bars
      responsive: true,
      scales: {
        x: {
          beginAtZero: true,
        },
        y: {
          ticks: { autoSkip: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          // Show count with unit
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw || 0;
              return ` ${val} `;
            },
          },
        },
      },
    },
  });

  // Clicking pie slice updates outcome filter
  document.getElementById("outcomeChart").addEventListener("click", (evt) => {
    const points = outcomeChart.getElementsAtEventForMode(
      evt,
      "nearest",
      { intersect: true },
      true
    );
    if (points.length) {
      // Set dropdown to selected outcome and re-filter
      const idx = points[0].index;
      const label = outcomeChart.data.labels[idx];
      document.getElementById("outcomeSelect").value = label;
      onFilterChange();
    }
  });

  // Clicking breed bar highlights cities for that breed
  document.getElementById("breedChart").addEventListener("click", (evt) => {
    const points = breedChart.getElementsAtEventForMode(evt, "nearest", {
      intersect: true,
    });
    if (points.length) {
      const idx = points[0].index;
      const breedName = breedChart.data.labels[idx];
      highlightCitiesByBreed(breedName);
    }
  });
}

// ==================== Filter Change Handler ====================
function onFilterChange() {
  const selectedYear = parseInt(document.getElementById("yearSlider").value);
  // Update visible year label
  document.getElementById("yearValue").textContent = selectedYear;
  const selectedSpecies = document.getElementById("speciesSelect").value;
  const selectedOutcome = document.getElementById("outcomeSelect").value;

  // Filter rawData based on year, species, outcome
  filteredData = rawData.filter(d => {
    const year = new Date(d.intakedate).getFullYear();
    if (year !== selectedYear) return false;
    if (selectedSpecies !== "All" && d.speciesname !== selectedSpecies) return false;
    if (selectedOutcome !== "All" && d.movementtype !== selectedOutcome) return false;
    return true;
  });

  // Re-render map and sidebar charts
  updateMap();
  updateOutcomeChart();
  updateBreedChart();
}

// ==================== Initialize Leaflet Map ====================
function initMap() {
  map = L.map("map").setView([51.5, -0.1], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  // Cluster group for markers
  markerClusterGroup = L.markerClusterGroup();
  map.addLayer(markerClusterGroup);
}

// ==================== Update Map with Filtered Data ====================
async function updateMap() {
  markerClusterGroup.clearLayers();    // Remove old markers

  // Aggregate stats by location
  const statsByLocation = {};
  for (let d of filteredData) {
    const loc = d.location.trim();
    const adoptedCount = d.movementtype === "Adoption" ? 1 : 0;
    const inDate = new Date(d.intakedate);
    const outDate = new Date(d.movementdate);
    const stayDays = (outDate - inDate) / (1000 * 60 * 60 * 24);

    if (!statsByLocation[loc]) {
      statsByLocation[loc] = {
        total: 0,
        adopted: 0,
        staySum: 0,
        breedCounts: {},
      };
    }
    statsByLocation[loc].total += 1;
    statsByLocation[loc].adopted += adoptedCount;
    statsByLocation[loc].staySum += stayDays;

    const breed = d.breedname;
    if (!statsByLocation[loc].breedCounts[breed]) {
      statsByLocation[loc].breedCounts[breed] = 0;
    }
    statsByLocation[loc].breedCounts[breed] += 1;
  }

  for (let loc of Object.keys(statsByLocation)) {
    const s = statsByLocation[loc];
    const adoptionRate = s.adopted / s.total;
    const avgStay = (s.staySum / s.total).toFixed(1);

    const coord = await getCoords(loc);
    if (!coord) continue;

    const color = `hsl(${adoptionRate * 120}, 70%, 50%)`;
    const size = Math.sqrt(s.total) * 4 + 6;

    const circle = L.circleMarker(coord, {
      radius: size,
      fillColor: color,
      color: "#333",
      weight: 1,
      fillOpacity: 0.7,
    });

    const breedCounts = statsByLocation[loc].breedCounts;
    const sortedBreeds = Object.entries(breedCounts).sort(
      (a, b) => b[1] - a[1]
    );
    const topBreedsText = sortedBreeds
      .slice(0, 3)
      .map(pair => `${pair[0]} (${pair[1]})`)
      .join(", ");

    const popupHtml = `
      <strong>${loc}</strong><br />
      Total intake：${s.total}<br />
      Adoption：${s.adopted}<br />
      Average duration of stay：${avgStay} days<br />
      Top 3 breeds：${topBreedsText}
    `;
    circle.bindPopup(popupHtml);

    // Tooltip on hover showing total count
    circle.on("mouseover", e => {
      const tooltipContent = `${loc}：${s.total} `;
      const tooltip = L.tooltip({
        permanent: false,
        direction: "top",
        className: "tooltip-custom",
      })
        .setContent(tooltipContent)
        .setLatLng(e.latlng);
      tooltip.addTo(map);
      circle.on("mouseout", () => {
        map.removeLayer(tooltip);
      });
    });

    markerClusterGroup.addLayer(circle);
  }
}

// ==================== Update Outcome Distribution Chart ====================
function updateOutcomeChart() {
  const counts = {
    Adoption: 0,
    Foster: 0,
    Reclaimed: 0,
    Transfer: 0,
    "Released To Wild": 0,
    Stolen: 0,
  };
  filteredData.forEach(d => {
    const mt = d.movementtype;
    if (counts.hasOwnProperty(mt)) counts[mt]++;
  });
  // Update pie data and re-render
  outcomeChart.data.datasets[0].data = [
    counts.Adoption,
    counts.Foster,
    counts.Reclaimed,
    counts.Transfer,
    counts["Released To Wild"],
    counts.Stolen,
  ];
  outcomeChart.update();
}

// ==================== Update Top 5 Breeds Chart ====================
function updateBreedChart() {
  const breedCounts = {};
  filteredData.forEach(d => {
    const b = d.breedname;
    if (!breedCounts[b]) breedCounts[b] = 0;
    breedCounts[b]++;
  });
  const sorted = Object.entries(breedCounts).sort((a, b) => b[1] - a[1]);
  const top5 = sorted.slice(0, 5);
  while (top5.length < 5) top5.push(["", 0]);
  breedChart.data.labels = top5.map(pair => pair[0]);
  breedChart.data.datasets[0].data = top5.map(pair => pair[1]);
  breedChart.update();
}

// ==================== Highlight Cities for Selected Breed ====================
async function highlightCitiesByBreed(chosenBreed) {
  markerClusterGroup.clearLayers();

  // Collect unique locations for this breed
  const locations = new Set();
  filteredData.forEach(d => {
    if (d.breedname === chosenBreed) {
      locations.add(d.location.trim());
    }
  });

  // Draw markers for all filteredData, but highlight chosen breed
  for (let d of filteredData) {
    const loc = d.location.trim();
    const coord = await getCoords(loc);
    if (!coord) continue;

    const isChosen = d.breedname === chosenBreed;
    const col = isChosen ? "orange" : "gray";
    const rad = isChosen ? 8 : 5;
    const opacity = isChosen ? 0.9 : 0.3;

    const circle = L.circleMarker(coord, {
      radius: rad,
      fillColor: col,
      color: "#333",
      weight: 1,
      fillOpacity: opacity,
    });
    circle.bindPopup(`
      <strong>${loc}</strong><br/>
      Breed: ${d.breedname}<br/>
      Year: ${new Date(d.intakedate).getFullYear()}<br/>
      Movement type: ${d.movementtype}
    `);
    markerClusterGroup.addLayer(circle);
  }

  // If there are any chosen locations, zoom to their bounds
  if (locations.size > 0) {
    const coordsList = [];
    for (let loc of locations) {
      const co = await getCoords(loc);
      if (co) coordsList.push(co);
    }
    if (coordsList.length > 0) {
      const latLngs = coordsList.map(c => L.latLng(c[0], c[1]));
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds.pad(0.5));
    }
  }
}

// ==================== Simple Geocoding with Cache ====================
async function getCoords(place) {
  // Return cached coords if available
  if (geocodeCache[place]) return geocodeCache[place];
  try {
    // Nominatim API for geocoding
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      place
    )}`;
    const res = await fetch(url, { headers: { "Accept-Language": "zh" } });
    const list = await res.json();
    if (list.length === 0) return null;
    const lat = parseFloat(list[0].lat),
      lon = parseFloat(list[0].lon);
    geocodeCache[place] = [lat, lon];
    return [lat, lon];
  } catch (err) {
    console.warn("❌ Geocode error：", place, err);
    return null;
  }
}