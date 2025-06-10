// Initialize Scrollama for scroll-driven storytelling
const scroller = scrollama();

// Load both CSV datasets in parallel: animal care summary & stray intake records
Promise.all([
  d3.csv('animal_care_data.csv'),
  d3.csv('stray_animals_data.csv')
]).then(([careData, strayData]) => {
  // === 1. Compute yearly "Medical" counts from strayData ===
  // I count records whose intake reason indicates injury/sickness.
  const medicalCounts = d3.rollups(
    strayData,
    v => v.filter(d => d.intakereason && /injur|sick/i.test(d.intakereason)).length,
    d => new Date(d.intakedate).getFullYear()
  );
  const medicalMap = new Map(medicalCounts);

  // === 2. Merge into a single summary data array ===
  // Convert strings to numbers, fill missing medical counts with 0
  const data = careData.map(d => ({
    Year: +d.Year,
    Intake: +d['Total Intake of Animals'],
    Medical: medicalMap.get(+d.Year) || 0,
    Adoption: +d.Adoptions,
    AdoptionRevenue: +d['Annual Adoption Revenue'],
    Euthanized: +d.Euthanized,
    Budget: +d['Annual Budget']
  }));

  // === 3. Initialize interactive controls (year selector & budget simulator) ===
  initControls(data);
  // === 4. Initialize the scroll-driven narrative ===
  initScrolly(data);
});

/**
 * initControls(data)
 * - Populates the "Jump to Year" dropdown.
 * - Configures the budget simulation slider (hidden by default).
 * - Sets up callback to update simulated adoption/euthanasia numbers.
 */
function initControls(data) {
  // 3.1 Year selector dropdown
  const years = data.map(d=>d.Year);
  const yearSel = d3.select('#year-select');
  yearSel.selectAll('option')
    .data(years)
    .enter().append('option')
    .attr('value', d=>d)
    .text(d=>d);
  // When user changes year, highlight all corresponding marks across charts
  yearSel.on('change', function() {
  const y = +this.value;
  // Dim all elements first
  d3.selectAll('[data-year]').style('opacity', 0.3);
  // Then highlight selected year's marks and bring them to front
  d3.selectAll(`[data-year='${y}']`)
    .classed('highlight', true)
    .style('opacity', 1)
    .raise();
});

  // 3.2 Hide the budget slider control until the KPI section
  d3.select('#slider-control').style('display', 'none');

  // 3.3 Budget simulation slider setup
  const totalBudget = d3.sum(data, d=>d.Budget);
  const totalAdopt = d3.sum(data, d=>d.Adoption);
  const totalAdRev = d3.sum(data, d=>d.AdoptionRevenue);
  const totalEuth  = d3.sum(data, d=>d.Euthanized);
  const yearsCount = data.length;
  // Compute average rates per budget dollar
  const adoptPerBud = totalAdopt / totalBudget;
  const revPerBud   = totalAdRev / totalBudget;
  const euthPerBud  = totalEuth  / totalBudget;

  const slider = d3.select('#budget-slider')
    .attr('min', d3.min(data,d=>d.Budget))
    .attr('max', d3.max(data,d=>d.Budget))
    .attr('step', (d3.max(data,d=>d.Budget)-d3.min(data,d=>d.Budget))/50)
    .attr('value', d3.mean(data,d=>d.Budget));
  const valSpan = d3.select('#budget-value');
  const formatNum = d3.format(',');

  // Run initial simulation with default slider value
  updateSimulation(+slider.property('value'));
  // On slider input, update the KPI simulation cards
  slider.on('input', function() {
    const v = +this.value;
    updateSimulation(v);
  });

  // Helper to update simulated adoption & euthanasia counts
  function updateSimulation(bud) {
    valSpan.text(`$${formatNum(bud)}`);
    // Predicted value
    const predAdopt = Math.round(bud * adoptPerBud);
    const predRev   = Math.round(bud * revPerBud);
    const predEuth  = Math.round(bud * euthPerBud);
    // Update the DOM elements in the KPI section
    d3.select('#sim-adoption').text(predAdopt);
    d3.select('#sim-revenue').text(`$${formatNum(predRev)}`);
    d3.select('#sim-euthanasia').text(predEuth);
  }
}

/**
 * initScrolly(data)
 * - Sets up tooltip container.
 * - Configures Scrollama to trigger chart drawing on step enter.
 * - Handles showing/hiding the budget slider only on the KPI step.
 * - Adds the cat-paw mouse trail effect.
 */
function initScrolly(data) {
  // Create a hidden tooltip div for hover interactions
  d3.select('body').append('div')
    .attr('class','tooltip')
    .style('opacity',0);

  // Configure Scrollama: trigger when 50% of step is in view
  scroller.setup({ step: '.step', offset: 0.5 })
    .onStepEnter(({ element }) => {
      const step = element.getAttribute('data-step');
      // Hide the budget slider by default on every step
      d3.select('#slider-control').style('display', 'none');
      // Only show the budget slider when we enter the KPI section
      if (step === 'kpi') {
        d3.select('#slider-control')
          .style('display', 'block');
      }

      // Only show the budget slider when we enter the KPI section
      const container = d3.select(element).select('.chart-area');
      container.html('');
      ({ intake: drawIntake,
         medical: drawMedical,
         adoption: drawAdoption,
         euthanasia: drawEuthanasia,
         kpi: drawKPI })[step](data, container);
    });

  // Cat-paw mouse trail effect using GSAP for fade & rise animation
  document.addEventListener('mousemove', e => {
    const paw = document.createElement('div');
    paw.className = 'paw-trail';
    paw.textContent = '🐾';
    paw.style.left = `${e.pageX}px`;
    paw.style.top  = `${e.pageY}px`;
    document.body.appendChild(paw);
    gsap.to(paw, {
      opacity: 0, y: -20, duration: 1, ease: 'power1.out',
      onComplete: () => paw.remove()
    });
  });
}

// === Chart drawing functions for each storytelling step ===

/**
 * drawIntake(data, container)
 * - Renders a bar chart of annual intake counts.
 * - Bars animate in with height transition.
 * - Clicking a bar jumps the year selector to that year.
 */
function drawIntake(data, container) {
  const svg = container.append('svg'),
        m = {top:20,right:20,bottom:40,left:50},
        w = svg.node().getBoundingClientRect().width - m.left - m.right,
        h = 0.6*window.innerHeight - m.top - m.bottom,
        g = svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  // X-scale: discrete years; Y-scale: intake count
  const x = d3.scaleBand().domain(data.map(d=>d.Year)).range([0,w]).padding(0.2),
        y = d3.scaleLinear().domain([0,d3.max(data,d=>d.Intake)*1.1]).range([h,0]);
  // Draw axes
  g.append('g').call(d3.axisLeft(y));
  g.append('g').attr('transform',`translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat(d3.format('d')));
  // Draw bars with animation and click-to-highlight behavior
  g.selectAll('rect').data(data).enter().append('rect')
    .attr('data-year', d=>d.Year)
    .attr('x',d=>x(d.Year)).attr('y',h)
    .attr('width',x.bandwidth()).attr('height',0)
    .attr('fill','#4f46e5').classed('shadow', true)  // for hover scale effect
    .on('click', (e,d)=> d3.select('#year-select').property('value', d.Year).dispatch('change'))  // Clicking a bar programmatically selects that year
    .transition().duration(800).delay((_,i)=>i*50)
      .attr('y',d=>y(d.Intake)).attr('height',d=>h-y(d.Intake));
}

/**
 * drawMedical(data, container)
 * - Renders a line chart of annual medical visit counts.
 * - Line draws itself with a stroke-dash animation.
 */
function drawMedical(data, container) {
  const svg = container.append('svg'),
        m={top:20,right:20,bottom:40,left:50},
        w=svg.node().getBoundingClientRect().width-m.left-m.right,
        h=0.6*window.innerHeight-m.top-m.bottom,
        g=svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  // Scales
  const x=d3.scaleLinear().domain(d3.extent(data,d=>d.Year)).range([0,w]),
        y=d3.scaleLinear().domain([0,d3.max(data,d=>d.Medical)*1.1]).range([h,0]);
  // Axes
  g.append('g').attr('transform',`translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));
  g.append('g').call(d3.axisLeft(y));
  // Line generator and path
  const line=d3.line().x(d=>x(d.Year)).y(d=>y(d.Medical));
  const path=g.append('path').datum(data)
    .attr('fill','none').attr('stroke','#f59e0b').attr('stroke-width',2).attr('d',line);
  // Animate line drawing using total path length
  const L=path.node().getTotalLength();
  path.attr('stroke-dasharray',`${L} ${L}`).attr('stroke-dashoffset',L)
    .transition().duration(1000).attr('stroke-dashoffset',0);
}

/**
 * drawAdoption(data, container)
 * - Renders a bubble chart: year vs. adoption count, bubble size ~ adoption revenue.
 * - Bubbles fade/scale in, show tooltip & enlarge on hover.
 * - Clicking a bubble jumps to that year.
 */
function drawAdoption(data, container) {
  const svg = container.append('svg'),
        m={top:20,right:20,bottom:40,left:50},
        w=svg.node().getBoundingClientRect().width-m.left-m.right,
        h=0.6*window.innerHeight-m.top-m.bottom,
        g=svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  // Scales: x=time, y=adoption count, r=bubble radius from revenue
  const x=d3.scaleLinear().domain(d3.extent(data,d=>d.Year)).range([0,w]),
        y=d3.scaleLinear().domain([0,d3.max(data,d=>d.Adoption)*1.1]).range([h,0]),
        r=d3.scaleSqrt().domain(d3.extent(data,d=>d.AdoptionRevenue)).range([4,20]);
  // Axes
  g.append('g').attr('transform',`translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat(d3.format('d')));
  g.append('g').call(d3.axisLeft(y));
  // Tooltip reference
  const tooltip=d3.select('.tooltip');
  // Bubbles with enter transition
  g.selectAll('circle').data(data).enter().append('circle')
    .attr('data-year', d=>d.Year)
    .attr('cx',d=>x(d.Year)).attr('cy',d=>y(d.Adoption)).attr('r',0)
    .attr('fill','#10b981').style('opacity',0.7).classed('shadow', true)  // hover scale effect
    .on('mouseover', function(e,d) {
      // Enlarge bubble & show tooltip
      d3.select(this).transition().duration(200).attr('r', r(d.AdoptionRevenue)*1.3);
      tooltip.transition().duration(200).style('opacity',0.9);
      tooltip.html(`Year:${d.Year}<br>Adoption:${d.Adoption}<br>Revenue${d.AdoptionRevenue}`)
        .style('left',`${e.pageX+10}px`).style('top',`${e.pageY-28}px`);
    })
    .on('mouseout', function(e,d) {
      // Restore size & hide tooltip
      d3.select(this).transition().duration(200).attr('r', r(d.AdoptionRevenue));
      tooltip.transition().duration(300).style('opacity',0);
    })
    .on('click', (e,d)=> d3.select('#year-select').property('value', d.Year).dispatch('change'))  // Jump to this year in the selector
    .transition().duration(800).delay((_,i)=>i*80)
      .attr('r',d=>r(d.AdoptionRevenue));
}

/**
 * drawEuthanasia(data, container)
 * - Renders an area chart of euthanasia rate (Euthanized / Intake).
 * - Area fades in with transition.
 */
function drawEuthanasia(data, container) {
  const svg=container.append('svg'),
        m={top:20,right:20,bottom:40,left:50},
        w=svg.node().getBoundingClientRect().width-m.left-m.right,
        h=0.6*window.innerHeight-m.top-m.bottom,
        g=svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  // Scales: x=time, y=rate [0..1]
  const x=d3.scaleLinear().domain(d3.extent(data,d=>d.Year)).range([0,w]),
        y=d3.scaleLinear().domain([0,1]).range([h,0]);
  // Axes with percentage format on Y
  g.append('g').attr('transform',`translate(0,${h})`)
    .call(d3.axisBottom(x).tickFormat(d3.format('d')));
  g.append('g').call(d3.axisLeft(y).tickFormat(d3.format('.0%')));
  // Prepare rate data and area generator
  const rate=data.map(d=>({Year:d.Year,Rate:d.Euthanized/d.Intake}));
  const area=d3.area().x(d=>x(d.Year)).y0(h).y1(d=>y(d.Rate));
  // Draw area with fade-in
  g.append('path').datum(rate)
    .attr('fill','#ef4444').attr('opacity',0).attr('d',area)
    .transition().duration(1000).attr('opacity',0.7);
}

/**
 * drawKPI(data, container)
 * - Renders:
 *    1) Four KPI summary cards (total intake, adoption, rates).
 *    2) Two simulation cards (simulated adoption & euthanasia based on slider).
 * - Cards animate in with GSAP.
 */
function drawKPI(data, container) {
  // 1) Summary KPI cards
  const div = container.append('div').attr('class','grid grid-cols-2 gap-6 p-4');
  const totalI=d3.sum(data,d=>d.Intake),
        totalA=d3.sum(data,d=>d.Adoption),
        totalE=d3.sum(data,d=>d.Euthanized);
  const rateA=(totalA/totalI*100).toFixed(1)+'%',
        rateE=(totalE/totalI*100).toFixed(1)+'%';
  const cards=[
    {t:'Total Intake',v:totalI},
    {t:'Total Adoptions',v:totalA},
    {t:'Adoption Rate',v:rateA},
    {t:'Euthanasia Rate',v:rateE}
  ];
  cards.forEach(d=>{
    div.append('div')
      .attr('class','p-4 bg-white shadow rounded text-center')
      .html(`<h3 class="text-lg mb-2">${d.t}</h3><p class="text-2xl">${d.v}</p>`);
  });

  // 2) Simulation result cards (populated by budget slider)
  const simDiv = container.append('div').attr('class','grid grid-cols-2 gap-6 p-4');
  simDiv.append('div')
    .attr('class','p-4 bg-green-50 shadow rounded text-center')
    .html(`<h3 class="text-lg mb-2">Simulated Adoptions</h3><p id="sim-adoption" class="text-2xl">—</p>`);
  simDiv.append('div')
    .attr('class','p-4 bg-red-50 shadow rounded text-center')
    .html(`<h3 class="text-lg mb-2">Simulated Euthanasias</h3><p id="sim-euthanasia" class="text-2xl">—</p>`);
  simDiv.append('div class="col-span-2 text-center text-sm text-gray-500 mt-2"')
    .html(`（Based on historical averages）`);

  // Animate all cards (class "shadow") into view
  gsap.from(container.selectAll('.shadow').nodes(), {
    opacity:0, y:20, duration:0.6, stagger:0.2
  });
}
