// ========================
// General configuration and helper functions
// ========================

// Define global margins
const margin = { top: 40, right: 20, bottom: 50, left: 60 };

// General: render X-axis
function renderXAxis(svg, xScale, height) {
  const xAxis = d3.axisBottom(xScale).tickFormat(d3.format('d'));
  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${height - margin.bottom})`)
    .call(xAxis)
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');
}

// General: render Y-axis
function renderYAxis(svg, yScale) {
  const yAxis = d3.axisLeft(yScale).ticks(6);
  svg
    .append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(yAxis);
}

// ========================
// Data loading and preprocessing
// ========================

// Global variables to store data
window.animalData = [];

// Directly load the uploaded raw CSV: animal_care_data.csv
d3.csv('animal_care_data.csv', function (d) {
  return {
    Year: +d['Year'],
    Employees: +d['Number of Employees'],
    Vehicles: +d['Number of Division Vehicles'],
    Budget: +d['Annual Budget'],
    Owner_Surrenders: +d['Owner Surrenders'],
    Strays: +d['Strays'],
    // Fill missing values of “Impounds by ACO (Added in 2015)” with 0
    Impounds_ACO:
      d['Impounds by ACO (Added in 2015)'] === '' ||
      d['Impounds by ACO (Added in 2015)'] == null
        ? 0
        : +d['Impounds by ACO (Added in 2015)'],
    Total_Intake: +d['Total Intake of Animals'],
    Adoptions: +d['Adoptions'],
    Return_to_Owner: +d['Return to Owner'],
    Euthanized: +d['Euthanized'],
    Transported: +d['Transported to other shelters and rescues'],
    Fostered: +d['Fostered Animals'],
    Service_Calls: +d['Service Calls'],
    Emergency_Calls: +d['Emergency Call-Outs'],
    Grants: +d['Grants Received'],
    Adoption_Revenue: +d['Annual Adoption Revenue']
  };
})
  .then(function (data) {
    // Sort (ascending by year)
    data.sort((a, b) => d3.ascending(a.Year, b.Year));
    window.animalData = data;

    // Invoke modules in order
    generateSummaryCards(data);
    drawOverviewChart(data);
    initTrendModule(data);
    initComparisonModule(data);
  })
  .catch(function (error) {
    console.error('Error when loading CSV:', error);
  });

// ========================
// Module 1: Overall overview
// ========================

function generateSummaryCards(data) {
  if (!data || data.length < 2) return;

  const latest = data[data.length - 1]; // Year 2019
  const prev = data[data.length - 2];   // Year 2018

  const cardsInfo = [
    {
      title: 'Employees number',
      value: latest.Employees,
      delta:
        prev.Employees !== 0
          ? (((latest.Employees - prev.Employees) / prev.Employees) * 100).toFixed(1) + '%'
          : 'N/A'
    },
    {
      title: 'Annual Budget(USD)',
      value: d3.format('~s')(latest.Budget), // Output like 1.2M
      delta:
        prev.Budget !== 0
          ? (((latest.Budget - prev.Budget) / prev.Budget) * 100).toFixed(1) + '%'
          : 'N/A'
    },
    {
      title: 'Total intake',
      value: latest.Total_Intake,
      delta:
        prev.Total_Intake !== 0
          ? (((latest.Total_Intake - prev.Total_Intake) / prev.Total_Intake) * 100).toFixed(1) +
            '%'
          : 'N/A'
    },
    {
      title: 'Adoption',
      value: latest.Adoptions,
      delta:
        prev.Adoptions !== 0
          ? (((latest.Adoptions - prev.Adoptions) / prev.Adoptions) * 100).toFixed(1) + '%'
          : 'N/A'
    }
  ];

  const container = d3.select('#summary-cards');
  cardsInfo.forEach((card) => {
    const col = container
      .append('div')
      .attr('class', 'col-sm-6 col-md-3 summary-card');

    col
      .append('h5')
      .text(card.title)
      .style('font-weight', '600');

    col
      .append('p')
      .text(card.value)
      .attr('class', 'h2');

    const deltaColor = card.delta.startsWith('-') ? 'text-danger' : 'text-success';
    col
      .append('p')
      .text(card.delta)
      .attr('class', deltaColor);
  });
}

function drawOverviewChart(data) {
  if (!data || data.length === 0) return;

  const svg = d3.select('#overview-chart');
  const width = parseInt(svg.style('width'));
  const height = parseInt(svg.style('height'));

  // Set up scales
  // X-axis scale: Year
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.Year))
    .range([margin.left, width - margin.right]);

  // Unified Y-axis: max of Total_Intake / Adoptions / Euthanized
  const allMax = d3.max([
    d3.max(data, (d) => d.Total_Intake),
    d3.max(data, (d) => d.Adoptions),
    d3.max(data, (d) => d.Euthanized)
  ]);
  const yScale = d3
    .scaleLinear()
    .domain([0, allMax * 1.1])
    .range([height - margin.bottom, margin.top]);

  // Render axes
  renderXAxis(svg, xScale, height);
  renderYAxis(svg, yScale);

  // Line generators for three lines
  const lineTotal = d3
    .line()
    .x((d) => xScale(d.Year))
    .y((d) => yScale(d.Total_Intake));
  const lineAdopt = d3
    .line()
    .x((d) => xScale(d.Year))
    .y((d) => yScale(d.Adoptions));
  const lineEuth = d3
    .line()
    .x((d) => xScale(d.Year))
    .y((d) => yScale(d.Euthanized));

  // Draw three lines
  svg
    .append('path')
    .datum(data)
    .attr('class', 'line line-total')
    .attr('d', lineTotal)
    .attr('stroke', '#1f77b4')
    .attr('fill', 'none')
    .attr('stroke-width', 2);
  svg
    .append('path')
    .datum(data)
    .attr('class', 'line line-adopt')
    .attr('d', lineAdopt)
    .attr('stroke', '#2ca02c')
    .attr('fill', 'none')
    .attr('stroke-width', 2);
  svg
    .append('path')
    .datum(data)
    .attr('class', 'line line-euth')
    .attr('d', lineEuth)
    .attr('stroke', '#d62728')
    .attr('fill', 'none')
    .attr('stroke-width', 2);

  // Add legend
  const legendData = [
    { label: 'Total intake', color: '#1f77b4', class: 'line-total' },
    { label: 'Adoption', color: '#2ca02c', class: 'line-adopt' },
    { label: 'Euthanasia', color: '#d62728', class: 'line-euth' }
  ];
  const legend = svg
    .append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width - margin.right - 150}, ${margin.top})`);

  legendData.forEach((d, i) => {
    const g = legend.append('g').attr('transform', `translate(0, ${i * 20})`);

    g
      .append('rect')
      .attr('x', 0)
      .attr('y', -10)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', d.color)
      .style('cursor', 'pointer')
      .on('click', function () {
        const line = svg.select(`.line.${d.class}`);
        const currentlyHidden = line.classed('hidden');
        line.classed('hidden', !currentlyHidden);
        d3.select(this).style('opacity', currentlyHidden ? 1 : 0.3);
      });

    g
      .append('text')
      .attr('x', 18)
      .attr('y', 0)
      .attr('dy', '0.32em')
      .text(d.label);
  });

  // Add circles & hover tooltip on lines
  ['Total_Intake', 'Adoptions', 'Euthanized'].forEach((key, idx) => {
    const color = legendData[idx].color;
    svg
      .selectAll(`.dot-${key}`)
      .data(data)
      .enter()
      .append('circle')
      .attr('class', `dot dot-${key}`)
      .attr('cx', (d) => xScale(d.Year))
      .attr('cy', (d) => yScale(d[key]))
      .attr('r', 4)
      .attr('fill', color)
      .on('mouseover', function (event, d) {
        // Remove existing tooltip first
        d3.selectAll('.tooltip').remove();
        const tooltip = d3
          .select('body')
          .append('div')
          .attr('class', 'tooltip')
          .html(`Year: ${d.Year}<br>${legendData[idx].label}: ${d[key]}`);
        tooltip
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px');
      })
      .on('mouseout', function () {
        d3.selectAll('.tooltip').remove();
      });
  });
}

// ========================
// Module 2: Indicator trends
// ========================

function initTrendModule(data) {
  if (!data || data.length === 0) return;

  // Default plot: Employees vs Budget
  drawTrendLineChart(data, 'Employees', 'Budget');

  // Listen to dropdown change
  d3.select('#metric-select').on('change', function () {
    const selected = d3.select(this).property('value'); // e.g. "Employees,Budget"
    const [key1, key2] = selected.split(',');
    // Clear old SVG content
    d3.select('#trend-line-chart').selectAll('*').remove();
    drawTrendLineChart(data, key1, key2);
  });

  // Draw stacked bar chart
  drawStackedBarChart(data);

  // Listen to year slider
  d3.select('#year-slider').on('input', function () {
    const year = +d3.select(this).property('value');
    updateYearInfo(data, year);
    highlightStackedBar(data, year);
  });

  // On page load, show 2019 data by defaultv
  updateYearInfo(data, 2019);
}

function drawTrendLineChart(data, key1, key2) {
  const svg = d3.select('#trend-line-chart');
  const width = parseInt(svg.style('width'));
  const height = parseInt(svg.style('height'));

  // X-axis scale
  const xScale = d3
    .scaleLinear()
    .domain(d3.extent(data, (d) => d.Year))
    .range([margin.left, width - margin.right]);

  // X-axis scale
  const allMax = d3.max([
    d3.max(data, (d) => d[key1]),
    d3.max(data, (d) => d[key2])
  ]);
  const yScale = d3
    .scaleLinear()
    .domain([0, allMax * 1.1])
    .range([height - margin.bottom, margin.top]);

  // Render X and Y axes
  renderXAxis(svg, xScale, height);
  renderYAxis(svg, yScale);

  // Line generator
  const line1 = d3
    .line()
    .x((d) => xScale(d.Year))
    .y((d) => yScale(d[key1]));
  const line2 = d3
    .line()
    .x((d) => xScale(d.Year))
    .y((d) => yScale(d[key2]));

  // Draw line 1 & dots
  svg
    .append('path')
    .datum(data)
    .attr('class', 'line line-trend1')
    .attr('d', line1)
    .attr('stroke', '#1f77b4')
    .attr('fill', 'none')
    .attr('stroke-width', 2);
  svg
    .selectAll('.dot1')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', 'dot dot1')
    .attr('cx', (d) => xScale(d.Year))
    .attr('cy', (d) => yScale(d[key1]))
    .attr('r', 3)
    .attr('fill', '#1f77b4')
    .on('mouseover', function (event, d) {
      // Remove any existing tooltip first
      d3.selectAll('.tooltip').remove();
      const tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'tooltip')
        .html(`Year: ${d.Year}<br>${key1.replace(/_/g, ' ')}: ${d[key1]}`);
      tooltip
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 28 + 'px');
    })
    .on('mouseout', function () {
      d3.selectAll('.tooltip').remove();
    });

  // Draw line 2 & dots
  svg
    .append('path')
    .datum(data)
    .attr('class', 'line line-trend2')
    .attr('d', line2)
    .attr('stroke', '#ff7f0e')
    .attr('fill', 'none')
    .attr('stroke-width', 2);
  svg
    .selectAll('.dot2')
    .data(data)
    .enter()
    .append('circle')
    .attr('class', 'dot dot2')
    .attr('cx', (d) => xScale(d.Year))
    .attr('cy', (d) => yScale(d[key2]))
    .attr('r', 3)
    .attr('fill', '#ff7f0e')
    .on('mouseover', function (event, d) {
      d3.selectAll('.tooltip').remove();
      const tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'tooltip')
        .html(`Year: ${d.Year}<br>${key2.replace(/_/g, ' ')}: ${d[key2]}`);
      tooltip
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 28 + 'px');
    })
    .on('mouseout', function () {
      d3.selectAll('.tooltip').remove();
    });

  // Legend
  const legendData = [
    { label: key1.replace(/_/g, ' '), color: '#1f77b4', class: 'line-trend1' },
    { label: key2.replace(/_/g, ' '), color: '#ff7f0e', class: 'line-trend2' }
  ];
  const legend = svg
    .append('g')
    .attr('class', 'legend-trend')
    .attr('transform', `translate(${width - margin.right - 120}, ${margin.top})`);

  legendData.forEach((d, i) => {
    const g = legend.append('g').attr('transform', `translate(0, ${i * 20})`);
    g
      .append('rect')
      .attr('x', 0)
      .attr('y', -10)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', d.color)
      .style('cursor', 'pointer')
      .on('click', function () {
        const line = svg.select(`.line.${d.class}`);
        const hidden = line.classed('hidden');
        line.classed('hidden', !hidden);
        d3.select(this).style('opacity', hidden ? 1 : 0.3);
      });

    g
      .append('text')
      .attr('x', 18)
      .attr('y', 0)
      .attr('dy', '0.32em')
      .text(d.label);
  });
}

function drawStackedBarChart(data) {
  const svg = d3.select('#stacked-bar-chart');
  const width = parseInt(svg.style('width'));
  const height = parseInt(svg.style('height'));

  // // Specify the fields to stack
  const keys = ['Owner_Surrenders', 'Strays', 'Impounds_ACO'];

  // D3 stack layout
  const stack = d3.stack().keys(keys);
  const stackedData = stack(data);

  // X-axis: band scale based on year
  const xScale = d3
    .scaleBand()
    .domain(data.map((d) => d.Year))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  // Y-axis: maximum of the sum of the three series
  const maxStack = d3.max(data, (d) => d.Owner_Surrenders + d.Strays + d.Impounds_ACO);
  const yScale = d3
    .scaleLinear()
    .domain([0, maxStack * 1.1])
    .range([height - margin.bottom, margin.top]);

  // Color: assign a color to each layer
  const colorScale = d3
    .scaleOrdinal()
    .domain(keys)
    .range(['#6baed6', '#9ecae1', '#c6dbef']);

  // Render the X and Y axes
  const xAxis = d3.axisBottom(xScale);
  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${height - margin.bottom})`)
    .call(xAxis)
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end');

  const yAxis = d3.axisLeft(yScale).ticks(6);
  svg.append('g').attr('class', 'y-axis').attr('transform', `translate(${margin.left}, 0)`).call(yAxis);

  // Draw stacked rectangles
  const groups = svg
    .selectAll('g.layer')
    .data(stackedData)
    .enter()
    .append('g')
    .attr('class', 'layer')
    .attr('fill', (d) => colorScale(d.key));

  groups
    .selectAll('rect')
    .data((d) => d)
    .enter()
    .append('rect')
    .attr('x', (d) => xScale(d.data.Year))
    .attr('y', (d) => yScale(d[1]))
    .attr('height', (d) => yScale(d[0]) - yScale(d[1]))
    .attr('width', xScale.bandwidth())
    .on('mouseover', function (event, d) {
      // On mouse hover: remove existing tooltip first
      d3.selectAll('.tooltip').remove();
      const key = this.parentNode.__data__.key;  // Current layer field name
      const tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'tooltip')
        .html(`Year: ${d.data.Year}<br>${key.replace(/_/g, ' ')}: ${d.data[key]}`);
      tooltip
        .style('left', event.pageX + 10 + 'px')
        .style('top', event.pageY - 28 + 'px');
    })
    .on('mouseout', function () {
      d3.selectAll('.tooltip').remove();
    });

  // Highlight bar of currently selected year
  function highlightBar(year) {
    svg.selectAll('rect').attr('stroke', 'none');
    svg
      .selectAll('rect')
      .filter((d) => d.data.Year === year)
      .attr('stroke', '#000')
      .attr('stroke-width', 1.5);
  }

  // Expose for external calls to highlight when slider updates
  window.highlightStackedBar = highlightBar;
}

function updateYearInfo(data, year) {
  const record = data.find((d) => d.Year === year);
  const container = d3.select('#year-info');
  container.html('');  // Clear

  if (record) {
    const ul = container.append('ul').attr('class', 'list-unstyled');
    Object.keys(record).forEach((key) => {
      if (key !== 'Year') {
        ul.append('li').text(`${key.replace(/_/g, ' ')}: ${record[key]}`);
      }
    });
  } else {
    container.text('No data for this year');
  }
}

// ========================
// Module 3: Indicator comparison and correlation
// ========================

// Initialize comparison module: scatter plot + correlation heatmap
function initComparisonModule(data) {
  drawScatterPlot(data);
  drawCorrelationHeatmap(data);
}

// Draw scatter plot (indicator comparison)
function drawScatterPlot(data) {
  const svg = d3.select('#scatter-plot');
  const width = parseInt(svg.style('width'));
  const height = parseInt(svg.style('height'));

  // Create a tooltip container to be added only once
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  // X-axis: Budget
  const xScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.Budget) * 1.1])
    .range([margin.left, width - margin.right]);

  // Y-axis: Adoption Revenue
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.Adoption_Revenue) * 1.1])
    .range([height - margin.bottom, margin.top]);

  // Bubble radius: Total Intake
  const rScale = d3.scaleSqrt()
    .domain(d3.extent(data, d => d.Total_Intake))
    .range([3, 12]);

  // Color: segmented by Euthanized count
  const euthArray = data.map(d => d.Euthanized).sort(d3.ascending);
  const lowThresh = d3.quantile(euthArray, 0.33);
  const midThresh = d3.quantile(euthArray, 0.66);
  const colorScale = d3.scaleThreshold()
    .domain([lowThresh, midThresh])
    .range(['#addd8e', '#31a354', '#006837']);

  // Render axes
  renderXAxis(svg, xScale, height);
  renderYAxis(svg, yScale);

  // Draw points
  svg.selectAll('.scatter-dot')
    .data(data)
    .enter()
    .append('circle')
      .attr('class', 'scatter-dot')
      .attr('cx', d => xScale(d.Budget))
      .attr('cy', d => yScale(d.Adoption_Revenue))
      .attr('r', d => rScale(d.Total_Intake))
      .attr('fill', d => colorScale(d.Euthanized))
      .attr('stroke', '#333')
      .attr('opacity', 0.7)
      .style('pointer-events', 'all')  // Ensure interactivity
      // On mouseover: show tooltip
      .on('mouseover', (event, d) => {
        tooltip.transition().duration(200)
          .style('opacity', 0.9);
        tooltip.html(
          `Year: ${d.Year}<br>` +
          `Budget: ${d.Budget}<br>` +
          `Adoption Revenue: ${d.Adoption_Revenue}<br>` +
          `Total Intake: ${d.Total_Intake}<br>` +
          `Euthanized: ${d.Euthanized}`
        )
        .style('left',  (event.pageX + 10) + 'px')
        .style('top',   (event.pageY - 28) + 'px');
      })
      // On mousemove: update position
      .on('mousemove', (event) => {
        tooltip
          .style('left',  (event.pageX + 10) + 'px')
          .style('top',   (event.pageY - 28) + 'px');
      })
      // On mouseout: hide tooltip
      .on('mouseout', () => {
        tooltip.transition().duration(500)
          .style('opacity', 0);
      });

  // Draw legend (color segmentation explanation)
  const legendData = colorScale.range().map((clr, i) => {
    const domain = colorScale.domain();
    const label =
      i === 0
        ? `< ${domain[0]}`
        : i === domain.length
        ? `≥ ${domain[domain.length - 1]}`
        : `${domain[i - 1]}–${domain[i]}`;
    return { color: clr, label: `Euthanized: ${label}` };
  });

  const legend = d3
    .select('#scatter-legend')
    .append('svg')
    .attr('width', 200)
    .attr('height', legendData.length * 20 + 20);

  legendData.forEach((d, i) => {
    const g = legend.append('g').attr('transform', `translate(10, ${i * 20 + 10})`);
    g
      .append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', d.color);
    g
      .append('text')
      .attr('x', 18)
      .attr('y', 6)
      .attr('dy', '0.32em')
      .text(d.label);
  });
}

function drawCorrelationHeatmap(data) {
  // List of indicators for computing correlation matrix
  const metrics = [
    'Employees',
    'Vehicles',
    'Budget',
    'Owner_Surrenders',
    'Strays',
    'Impounds_ACO',
    'Total_Intake',
    'Adoptions',
    'Return_to_Owner',
    'Euthanized',
    'Transported',
    'Fostered',
    'Service_Calls',
    'Emergency_Calls',
    'Grants',
    'Adoption_Revenue'
  ];

  // Function to compute Pearson correlation coefficient
  function pearsonCorr(a, b) {
    const n = a.length;
    const meanA = d3.mean(a);
    const meanB = d3.mean(b);
    let num = 0,
      denA = 0,
      denB = 0;
    for (let i = 0; i < n; i++) {
      num += (a[i] - meanA) * (b[i] - meanB);
      denA += (a[i] - meanA) * (a[i] - meanA);
      denB += (b[i] - meanB) * (b[i] - meanB);
    }
    return denA * denB === 0 ? 0 : num / Math.sqrt(denA * denB);
  }

  // Construct correlation matrix
  const matrix = [];
  metrics.forEach((m1, i) => {
    matrix[i] = [];
    const arr1 = data.map((d) => d[m1]);
    metrics.forEach((m2, j) => {
      const arr2 = data.map((d) => d[m2]);
      matrix[i][j] = pearsonCorr(arr1, arr2);
    });
  });

  const svg = d3.select('#correlation-heatmap');
  const width = parseInt(svg.style('width'));
  const height = parseInt(svg.style('height'));

  // Grid size
  const gridSize = Math.min(
    (width - margin.left - margin.right) / metrics.length,
    (height - margin.top - margin.bottom) / metrics.length
  );

  // Colors: map -1 to +1 from blue→white→red
  const colorScale = d3
    .scaleLinear()
    .domain([-1, 0, 1])
    .range(['#4575b4', '#ffffff', '#d73027']);

  // Draw heatmap cells and values
  metrics.forEach((m1, i) => {
    metrics.forEach((m2, j) => {
      svg
        .append('rect')
        .attr('x', margin.left + j * gridSize)
        .attr('y', margin.top + i * gridSize)
        .attr('width', gridSize)
        .attr('height', gridSize)
        .attr('fill', colorScale(matrix[i][j]));
      // Annotate correlation coefficient values
      svg
        .append('text')
        .attr('x', margin.left + j * gridSize + gridSize / 2)
        .attr('y', margin.top + i * gridSize + gridSize / 2)
        .attr('dy', '0.32em')
        .attr('text-anchor', 'middle')
        .attr('font-size', '8px')
        .text(matrix[i][j].toFixed(2))
        .attr('fill', '#000');
    });
  });

  // Draw row labels (left) and column labels (top)
  metrics.forEach((m, i) => {
    // Row labels
    svg
      .append('text')
      .attr('x', margin.left - 5)
      .attr('y', margin.top + i * gridSize + gridSize / 2)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .text(m.replace(/_/g, ' '));

    // Column labels (top, rotated 45°)
    svg
      .append('text')
      .attr('x', margin.left + i * gridSize + gridSize / 2)
      .attr('y', margin.top - 5)
      .attr('transform', `rotate(-45, ${margin.left + i * gridSize + gridSize / 2}, ${margin.top -
        5})`)
      .attr('text-anchor', 'start')
      .attr('font-size', '10px')
      .text(m.replace(/_/g, ' '));
  });
}
