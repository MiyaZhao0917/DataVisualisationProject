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

  // === 3. Initialize the scroll-driven narrative ===
  initScrolly(data);
});

function initScrolly(data) {
  // tooltip
  d3.select('body').append('div')
    .attr('class','tooltip')
    .style('opacity',0);

  scroller.setup({
    step: '.step',
    offset: 0.5
  }).onStepEnter(({ element }) => {
    // Clear the corresponding chart-area each time a new section is entered
    const container = d3.select(element).select('.chart-area');
    container.html('');
    const step = element.getAttribute('data-step');
    ({ intake: drawIntake,
       medical: drawMedical,
       adoption: drawAdoption,
       euthanasia: drawEuthanasia,
       kpi: drawKPI })[step](data, container);
  });
}

// Drawing functions now accept the container parameter
function drawIntake(data, container) {
  const svg = container.append('svg'),
        m = {top:20,right:20,bottom:40,left:50},
        w = svg.node().getBoundingClientRect().width - m.left - m.right,
        h = 0.6*window.innerHeight - m.top - m.bottom,
        g = svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  const x = d3.scaleBand().domain(data.map(d=>d.Year)).range([0,w]).padding(0.2),
        y = d3.scaleLinear().domain([0,d3.max(data,d=>d.Intake)*1.1]).range([h,0]);
  g.append('g').call(d3.axisLeft(y));
  g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d3.format('d')));
  g.selectAll('rect').data(data).enter().append('rect')
    .attr('x',d=>x(d.Year)).attr('y',h).attr('width',x.bandwidth()).attr('height',0)
    .attr('fill','#4f46e5').style('opacity',0)
    .transition().duration(800).delay((_,i)=>i*50)
      .attr('y',d=>y(d.Intake)).attr('height',d=>h-y(d.Intake)).style('opacity',1);
}

function drawMedical(data, container) {
  const svg = container.append('svg'),
        m = {top:20,right:20,bottom:40,left:50},
        w = svg.node().getBoundingClientRect().width - m.left - m.right,
        h = 0.6*window.innerHeight - m.top - m.bottom,
        g = svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  const x = d3.scaleLinear().domain(d3.extent(data,d=>d.Year)).range([0,w]),
        y = d3.scaleLinear().domain([0,d3.max(data,d=>d.Medical)*1.1]).range([h,0]);
  g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));
  g.append('g').call(d3.axisLeft(y));
  const line = d3.line().x(d=>x(d.Year)).y(d=>y(d.Medical));
  const path = g.append('path').datum(data)
    .attr('fill','none').attr('stroke','#f59e0b').attr('stroke-width',2).attr('d',line);
  const L = path.node().getTotalLength();
  path.attr('stroke-dasharray',`${L} ${L}`).attr('stroke-dashoffset',L)
    .transition().duration(1000).attr('stroke-dashoffset',0);
}

function drawAdoption(data, container) {
  const svg = container.append('svg'),
        m = {top:20,right:20,bottom:40,left:50},
        w = svg.node().getBoundingClientRect().width - m.left - m.right,
        h = 0.6*window.innerHeight - m.top - m.bottom,
        g = svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  const x = d3.scaleLinear().domain(d3.extent(data,d=>d.Year)).range([0,w]),
        y = d3.scaleLinear().domain([0,d3.max(data,d=>d.Adoption)*1.1]).range([h,0]),
        r = d3.scaleSqrt().domain(d3.extent(data,d=>d.AdoptionRevenue)).range([4,20]);
  g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d3.format('d')));
  g.append('g').call(d3.axisLeft(y));
  const tooltip = d3.select('.tooltip');
  g.selectAll('circle').data(data).enter().append('circle')
    .attr('cx',d=>x(d.Year)).attr('cy',d=>y(d.Adoption)).attr('r',0)
    .attr('fill','#10b981').style('opacity',0.7)
    .on('mouseover',(e,d)=>{ tooltip.transition().duration(200).style('opacity',0.9);
      tooltip.html(`Year:${d.Year}<br>Adoption:${d.Adoption}<br>Revenue:${d.AdoptionRevenue}`)
        .style('left',`${e.pageX+10}px`).style('top',`${e.pageY-28}px`); })
    .on('mouseout',()=>tooltip.transition().duration(300).style('opacity',0))
    .transition().duration(800).delay((_,i)=>i*80).attr('r',d=>r(d.AdoptionRevenue));
}

function drawEuthanasia(data, container) {
  const svg = container.append('svg'),
        m = {top:20,right:20,bottom:40,left:50},
        w = svg.node().getBoundingClientRect().width - m.left - m.right,
        h = 0.6*window.innerHeight - m.top - m.bottom,
        g = svg.append('g').attr('transform',`translate(${m.left},${m.top})`);
  const x = d3.scaleLinear().domain(d3.extent(data,d=>d.Year)).range([0,w]),
        y = d3.scaleLinear().domain([0,1]).range([h,0]);
  g.append('g').attr('transform',`translate(0,${h})`).call(d3.axisBottom(x).tickFormat(d3.format('d')));
  g.append('g').call(d3.axisLeft(y).tickFormat(d3.format('.0%')));
  const rate = data.map(d=>({Year:d.Year,Rate:d.Euthanized/d.Intake}));
  const area = d3.area().x(d=>x(d.Year)).y0(h).y1(d=>y(d.Rate));
  g.append('path').datum(rate).attr('fill','#ef4444').attr('opacity',0).attr('d',area)
    .transition().duration(1000).attr('opacity',0.7);
}

function drawKPI(data, container) {
  const div = container.append('div').attr('class','grid grid-cols-2 gap-6 p-4');
  const totalI = d3.sum(data,d=>d.Intake),
        totalA = d3.sum(data,d=>d.Adoption),
        totalE = d3.sum(data,d=>d.Euthanized),
        rateA = (totalA/totalI*100).toFixed(1)+'%',
        rateE = (totalE/totalI*100).toFixed(1)+'%';
  const cards = [
    {t:'Total Intake',v:totalI}, {t:'Total Adoptions',v:totalA},
    {t:'Adoption Rate',v:rateA},   {t:'Euthanasia Rate',v:rateE}
  ];
  cards.forEach(d=>{
    const c = div.append('div').attr('class','p-4 bg-white shadow rounded text-center');
    c.append('h3').attr('class','text-lg mb-2').text(d.t);
    c.append('p').attr('class','text-2xl').text(d.v);
  });
  gsap.from('.shadow',{opacity:0,y:20,duration:0.6,stagger:0.2});
}
