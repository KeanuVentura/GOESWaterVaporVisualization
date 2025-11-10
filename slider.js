const width = 928;
const height = 600;
const margin = { top: 20, right: 20, bottom: 50, left: 70 }; // reduced right margin since legend is separate

const svg = d3.select("#chart")
  .attr("width", width)
  .attr("height", height)
  .attr("viewBox", [0, 0, width, height]);

  d3.csv("/GOESWaterVaporVisualization/data/goes16_water_vapor_regions_daily_2025.csv", d3.autoType).then(data => {
  // Convert dates
  data.forEach(d => d.date = new Date(d.date));

  // Group data into weeks
  const startDate = new Date("2025-01-01");
  const endDate = new Date("2025-11-10");
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  const weeks = [];
  let weekStart = startDate;
  while (weekStart <= endDate) {
    const weekEnd = new Date(Math.min(weekStart.getTime() + msPerWeek - 1, endDate.getTime()));
    weeks.push({
      start: weekStart,
      end: weekEnd,
      data: data.filter(d => d.date >= weekStart && d.date <= weekEnd)
    });
    weekStart = new Date(weekStart.getTime() + msPerWeek);
  }

  const regions = [...new Set(data.map(d => d.region))];

  // X scale
  const x = d3.scaleTime()
              .range([margin.left, width - margin.right]);

  // Y scale
  const y = d3.scaleLinear()
              .domain(d3.extent(data, d => d.mean_BT))
              .nice()
              .range([height - margin.bottom, margin.top]);

  // Color scale
  const z = d3.scaleOrdinal(d3.schemeCategory10).domain(regions);

  // X-axis
  const xAxisGroup = svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`);

  // Y-axis
  const yAxisGroup = svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));

  // Y-axis label
  svg.append("text")
   .attr("transform", "rotate(-90)")
   .attr("x", - (height / 2))
   .attr("y", 20)
   .attr("fill", "var(--color-text)")
   .attr("text-anchor", "middle")
   .style("font-family", "system-ui, sans-serif")
   .style("font-weight", "bold")
   .style("font-size", "18px")
   .text("Mean Brightness Temperature (K)");

  // Line generator
  const line = d3.line()
                 .x(d => x(d.date))
                 .y(d => y(d.mean_BT));

  // Path group
  const pathGroup = svg.append("g");

  // Week label
  const weekLabel = d3.select("#week-display");

  // Update function
  function updateWeek(weekIndex) {
    const weekData = weeks[weekIndex].data;

    // Update x domain
    x.domain(d3.extent(weekData, d => d.date));
    xAxisGroup.call(
      d3.axisBottom(x)
        .ticks(d3.timeDay.every(1))
        .tickFormat(d3.timeFormat("%b %d"))
    );

    xAxisGroup.selectAll("text")
        .style("font-family", "system-ui, sans-serif")
        .style("font-size", "14px")
        .attr("fill", "var(--color-text)");

    yAxisGroup.selectAll("text")
        .style("font-family", "system-ui, sans-serif")
        .style("font-size", "14px")
        .attr("fill", "var(--color-text)");

    // Group by region
    const series = d3.groups(weekData, d => d.region)
                     .map(([key, values]) => ({ key, values }));

    // ------------------ VISIBLE PATHS ------------------
    const paths = pathGroup.selectAll("path.line")
                           .data(series, d => d.key);

    paths.enter().append("path")
         .attr("class", "line")
         .attr("fill", "none")
         .attr("stroke-width", 2)
         .attr("stroke", d => z(d.key))
         .merge(paths)
         .transition().duration(300)
         .attr("d", d => line(d.values));

    paths.exit().remove();

    // ------------------ HOVER PATHS ------------------
    const hoverPaths = pathGroup.selectAll("path.hover")
        .data(series, d => d.key);

    hoverPaths.enter()
        .append("path")
        .attr("class", "hover")
        .attr("fill", "none")
        .attr("stroke", "transparent")
        .attr("stroke-width", 30)
        .merge(hoverPaths)
        .attr("d", d => line(d.values));

    hoverPaths.exit().remove();

    // ------------------ TOOLTIP ------------------
    const tooltip = d3.select("#line-tooltip");

    const weeklyStats = d3.rollups(
        weekData,
        v => ({
            mean: d3.mean(v, d => d.mean_BT),
            min: d3.min(v, d => d.mean_BT),
            max: d3.max(v, d => d.mean_BT)
        }),
        d => d.region
    ).reduce((acc, [region, stats]) => { acc[region] = stats; return acc; }, {});

    pathGroup.selectAll("path.hover")
        .on("mouseenter", (event, d) => {
            pathGroup.selectAll("path.line")
                .filter(p => p.key === d.key)
                .attr("stroke-width", 4);

            const stats = weeklyStats[d.key];
            const meanBT = stats ? stats.mean.toFixed(1) : "N/A";
            const minBT = stats ? stats.min.toFixed(1) : "N/A";
            const maxBT = stats ? stats.max.toFixed(1) : "N/A";

            tooltip
                .style("display", "block")
                .html(`
                    Region: ${d.key}<br>
                    Mean Brightness Temperature (K): ${meanBT}<br>
                    Min Brightness Temperature (K): ${minBT}<br>
                    Max Brightness Temperature (K): ${maxBT}
                `);
        })
        .on("mousemove", (event) => {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseleave", (event, d) => {
            pathGroup.selectAll("path.line")
                .filter(p => p.key === d.key)
                .attr("stroke-width", 2);

            tooltip.style("display", "none");
        });

    // ------------------ WEEK LABEL ------------------
    const format = d3.timeFormat("%B %d");
    const start = format(weeks[weekIndex].start);
    const end = format(weeks[weekIndex].end);
    weekLabel.text(`Week: ${start} → ${end}`);
  }

  // Slider
  const slider = d3.select("#week-slider")
                   .attr("min", 0)
                   .attr("max", weeks.length - 1)
                   .attr("step", 1)
                   .attr("value", 0)
                   .on("input", function() { updateWeek(+this.value); });

  // ------------------ LEGEND ------------------
  const legendContainer = d3.select("#legend-container");

  regions.forEach(region => {
    const item = legendContainer.append("div")
        .attr("class", "legend-item")
        .style("display", "flex")
        .style("align-items", "center")
        .style("margin-right", "15px")
        .style("cursor", "pointer");

    // Color box
    const colorBox = item.append("div")
        .style("width", "15px")
        .style("height", "15px")
        .style("border-radius", "3px")
        .style("background-color", z(region))
        .style("transition", "all 0.15s ease"); // smooth transition

    // Label
    const label = item.append("span")
        .text(region)
        .style("margin-left", "6px")
        .style("font-family", "system-ui, sans-serif")
        .style("font-size", "16px")
        .style("font-weight", "bold")
        .style("transition", "all 0.15s ease"); // smooth transition

    // Hover interactions
    item.on("mouseenter", () => {
        pathGroup.selectAll("path.line").transition()
            .delay(50)
            .duration(100)
            .attr("stroke-width", d => d.key === region ? 4 : 2)
            .attr("opacity", d => d.key === region ? 1 : 0.3);

        colorBox.transition()
            .delay(50)
            .duration(100)
            .style("width", "18px")
            .style("height", "18px");

        label.transition()
            .delay(50)
            .duration(100)
            .style("color", "var(--color-accent)"); // optional highlight color
    })
    .on("mouseleave", () => {
        pathGroup.selectAll("path.line").transition()
            .delay(50)
            .duration(100)
            .attr("stroke-width", 2)
            .attr("opacity", 1);

        colorBox.transition()
            .delay(50)
            .duration(100)
            .style("width", "15px")
            .style("height", "15px");

        label.transition()
            .delay(50)
            .duration(100)
            .style("color", "var(--color-text)"); // back to normal
    });
});

  // Initialize
  updateWeek(0);
});
