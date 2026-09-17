const ACCESS_CODE = "fotile2025";
const DATA_URL = "./data/dashboard-data.json";

let dashboardData = null;
let charts = {};
let modalChart = null;
let selectedMonthIndex = -1;

const COLORS = [
  "#38bdf8",
  "#22c55e",
  "#f59e0b",
  "#a78bfa",
  "#fb7185",
  "#14b8a6",
  "#e879f9",
];

function formatNumber(value, format = "number") {
  if (value === null || value === undefined || Number.isNaN(value)) return "暂无";
  if (format === "percent") return `${(Number(value) * 100).toFixed(2)}%`;
  return Number(value).toLocaleString("zh-CN");
}

function formatChange(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${(Number(value) * 100).toFixed(1)}%`;
}

function formatChangeText(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "暂无可比数据";
  if (Math.abs(value) < 0.001) return "基本持平";
  return `${value > 0 ? "增长" : "下降"} ${Math.abs(value * 100).toFixed(1)}%`;
}

function changeClass(value) {
  if (value === null || value === undefined || Number.isNaN(value) || value === 0) return "";
  return value > 0 ? "up" : "down";
}

function getSelectedMonth() {
  return dashboardData.months[selectedMonthIndex] || dashboardData.months.at(-1);
}

function valueAt(metric, index = selectedMonthIndex) {
  return metric.values[index] ?? null;
}

function previousValue(metric, index = selectedMonthIndex) {
  if (index <= 0) return null;
  return metric.values[index - 1] ?? null;
}

function sameMonthLastYearValue(metric, index = selectedMonthIndex) {
  const month = dashboardData.months[index];
  if (!month) return null;
  const targetIndex = dashboardData.months.findIndex((item) =>
    item.year === month.year - 1 && item.month === month.month
  );
  if (targetIndex < 0) return null;
  return metric.values[targetIndex] ?? null;
}

function changeRate(current, base) {
  if (current === null || current === undefined || base === null || base === undefined || base === 0) {
    return null;
  }
  return (Number(current) - Number(base)) / Number(base);
}

function metricSnapshot(metric, index = selectedMonthIndex) {
  const latestIndex = dashboardData.months.length - 1;
  const latestSelected = index === latestIndex;
  const current = valueAt(metric, index);
  return {
    ...metric,
    latest: current,
    mom: latestSelected ? metric.mom : changeRate(current, previousValue(metric, index)),
    yoy: latestSelected ? metric.yoy : changeRate(current, sameMonthLastYearValue(metric, index)),
  };
}

function windowedData(metric, rangeValue) {
  const months = dashboardData.months;
  const end = selectedMonthIndex + 1;
  if (rangeValue === "all") {
    return {
      labels: months.slice(0, end).map((item) => item.label),
      values: metric.values.slice(0, end),
    };
  }
  const count = Number(rangeValue);
  const start = Math.max(0, end - count);
  return {
    labels: months.slice(start, end).map((item) => item.label),
    values: metric.values.slice(start, end),
  };
}

function initAccessGate() {
  const overlay = document.getElementById("accessOverlay");
  const input = document.getElementById("accessInput");
  const button = document.getElementById("accessButton");
  const error = document.getElementById("accessError");

  if (localStorage.getItem("wecomV2Access") === "true") {
    overlay.classList.add("hidden");
  }

  function checkAccess() {
    if (input.value === ACCESS_CODE) {
      localStorage.setItem("wecomV2Access", "true");
      overlay.classList.add("hidden");
      error.style.display = "none";
    } else {
      error.style.display = "block";
      input.value = "";
      input.focus();
    }
  }

  button.addEventListener("click", checkAccess);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") checkAccess();
  });
}

function renderMeta() {
  const month = getSelectedMonth();
  document.getElementById("latestMonth").textContent =
    `当前查看：${month.label}`;
  document.getElementById("generatedAt").textContent =
    `数据生成：${dashboardData.meta.generatedAt}`;
}

function renderMonthOptions() {
  const select = document.getElementById("monthSelect");
  select.innerHTML = dashboardData.months.map((month, index) => `
    <option value="${index}">${month.label}</option>
  `).join("");
  selectedMonthIndex = dashboardData.months.length - 1;
  select.value = String(selectedMonthIndex);
}

function renderGroupOptions() {
  const select = document.getElementById("groupSelect");
  dashboardData.groups.forEach((group) => {
    const option = document.createElement("option");
    option.value = group.id;
    option.textContent = group.title;
    select.appendChild(option);
  });
}

function renderHighlights() {
  const grid = document.getElementById("highlightGrid");
  grid.innerHTML = dashboardData.highlights.map((metric) => metricSnapshot(metric)).map((metric) => `
    <article class="metric-card">
      <h3>${metric.name}</h3>
      <div class="metric-value">${formatNumber(metric.latest, metric.format)}</div>
      <div class="metric-footer">
        <span class="chip ${changeClass(metric.mom)}">环比 ${formatChange(metric.mom)}</span>
        <span class="chip ${changeClass(metric.yoy)}">同比 ${formatChange(metric.yoy)}</span>
      </div>
    </article>
  `).join("");
}

function renderInsight() {
  const activeGroup = dashboardData.groups.find((group) => group.id === "active");
  const activeMetrics = Object.fromEntries(activeGroup.metrics.map((item) => [item.name, metricSnapshot(item)]));
  const allMau = activeMetrics["全体企微智慧导购月活"];
  const threeMau = activeMetrics["三类人员企微智慧月活"];
  const threeShare = threeMau.latest / allMau.latest;
  const month = getSelectedMonth();

  document.getElementById("insightTitle").textContent =
    `${month.label}三类人员月活占比 ${formatNumber(threeShare, "percent")}`;
  document.getElementById("insightBody").textContent =
    `当月全体月活 ${formatNumber(allMau.latest)}，三类人员月活 ${formatNumber(threeMau.latest)}。` +
    `三类人员月活环比 ${formatChange(threeMau.mom)}，同比 ${formatChange(threeMau.yoy)}。` +
    `建议重点结合一线岗位使用场景，继续观察三类人员活跃度与功能使用之间的联动。`;
}

function allMetricSnapshots() {
  return dashboardData.groups.flatMap((group) =>
    group.metrics.map((metric) => ({
      groupTitle: group.title,
      ...metricSnapshot(metric),
    }))
  );
}

function getMetricByName(name) {
  return allMetricSnapshots().find((metric) => metric.name === name);
}

function rankMetrics(metrics, field, direction) {
  return metrics
    .filter((metric) => typeof metric[field] === "number" && Number.isFinite(metric[field]))
    .sort((a, b) => direction === "desc" ? b[field] - a[field] : a[field] - b[field]);
}

function renderMonthlyAnalysis() {
  const month = getSelectedMonth();
  const metrics = allMetricSnapshots();
  const basicUse = getMetricByName("企微 智慧导购 使用人数");
  const allMau = getMetricByName("全体企微智慧导购月活");
  const threeMau = getMetricByName("三类人员企微智慧月活");
  const allDau = getMetricByName("全体企微智慧导购日活");
  const threeDau = getMetricByName("三类人员企微智慧日活");
  const threeShare = threeMau && allMau ? threeMau.latest / allMau.latest : null;

  const rankingBase = metrics.filter((metric) =>
    !metric.name.includes("打开率") &&
    !metric.name.includes("产生率") &&
    !metric.name.includes("执行率")
  );
  const topMom = rankMetrics(rankingBase, "mom", "desc").slice(0, 3);
  const lowMom = rankMetrics(rankingBase, "mom", "asc")
    .filter((metric) => metric.mom < -0.001)
    .slice(0, 3);
  const topYoy = rankMetrics(rankingBase, "yoy", "desc").slice(0, 3);

  const cards = [
    {
      title: "整体判断",
      items: [
        `智慧导购使用人数 ${formatNumber(basicUse?.latest)}，环比${formatChangeText(basicUse?.mom)}，同比${formatChangeText(basicUse?.yoy)}。`,
        `全体月活 ${formatNumber(allMau?.latest)}，三类人员月活 ${formatNumber(threeMau?.latest)}，三类占比 ${formatNumber(threeShare, "percent")}。`,
        `全体日活 ${formatNumber(allDau?.latest)}，三类人员日活 ${formatNumber(threeDau?.latest)}。`,
      ],
    },
    {
      title: "本月亮点",
      items: topMom.map((metric) =>
        `${metric.name}环比${formatChangeText(metric.mom)}，当前值 ${formatNumber(metric.latest, metric.format)}。`
      ),
    },
    {
      title: "需要关注",
      items: lowMom.length
        ? lowMom.map((metric) =>
            `${metric.name}环比${formatChangeText(metric.mom)}，当前值 ${formatNumber(metric.latest, metric.format)}。`
          )
        : ["本月主要维护指标暂无明显环比回落。"],
    },
    {
      title: "经营建议",
      items: [
        topYoy.length ? `${topYoy[0].name}同比${formatChangeText(topYoy[0].yoy)}，可复盘对应动作并沉淀方法。` : "同比数据不足，建议优先补齐历史口径。",
        threeMau?.mom < 0 ? "三类人员月活环比下降，建议结合一线岗位场景检查使用阻力。" : "三类人员月活保持稳定，建议继续观察高频功能与活跃度联动。",
        lowMom[0] ? `${lowMom[0].name}是本月回落最明显指标，建议优先确认是否为活动节奏、数据口径或业务真实下滑。` : "暂无明显回落指标，建议把重点放在高增长功能的复盘与复用。",
      ],
    },
  ];

  document.getElementById("analysisMonth").textContent = month.label;
  document.getElementById("analysisGrid").innerHTML = cards.map((card) => `
    <article class="analysis-card">
      <h3>${card.title}</h3>
      <ul>
        ${card.items.map((item) => `<li>${item}</li>`).join("")}
      </ul>
    </article>
  `).join("");
}

function chartOptions(title) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      title: { display: false, text: title },
      legend: { labels: { color: "#cbd5e1", usePointStyle: true } },
      tooltip: {
        backgroundColor: "rgba(15, 23, 42, 0.96)",
        borderColor: "rgba(148, 163, 184, 0.24)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8" },
        grid: { color: "rgba(148, 163, 184, 0.12)" },
      },
      y: {
        ticks: {
          color: "#94a3b8",
          callback: (value) => Number(value).toLocaleString("zh-CN"),
        },
        grid: { color: "rgba(148, 163, 184, 0.12)" },
      },
    },
  };
}

function createLineChart(canvasId, groupId, title) {
  const rangeValue = document.getElementById("rangeSelect").value;
  const group = dashboardData.groups.find((item) => item.id === groupId);
  const labels = windowedData(group.metrics[0], rangeValue).labels;
  const datasets = group.metrics.map((metric, index) => {
    const { values } = windowedData(metric, rangeValue);
    return {
      label: metric.name,
      data: values,
      borderColor: COLORS[index % COLORS.length],
      backgroundColor: `${COLORS[index % COLORS.length]}22`,
      borderWidth: 3,
      tension: 0.35,
      pointRadius: 4,
    };
  });

  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(document.getElementById(canvasId), {
    type: "line",
    data: { labels, datasets },
    options: chartOptions(title),
  });
}

function renderCharts() {
  createLineChart("basicChart", "basic", "基础使用趋势");
  createLineChart("activeChart", "active", "活跃趋势");
}

function renderModules() {
  const grid = document.getElementById("moduleGrid");
  grid.innerHTML = dashboardData.groups.map((group) => `
    <article class="group-card" data-group-id="${group.id}">
      <header>
        <p class="section-kicker">${group.id.toUpperCase()}</p>
        <h3>${group.title}</h3>
        <p>${group.description}</p>
      </header>
      ${group.metrics.map((metric) => metricSnapshot(metric)).map((metric) => `
        <div class="metric-row" data-row="${metric.row}" data-group-id="${group.id}">
          <span>${metric.name}</span>
          <strong>${formatNumber(metric.latest, metric.format)}</strong>
          <span class="trend">
            <span class="chip ${changeClass(metric.mom)}">环比 ${formatChange(metric.mom)}</span>
            <span class="chip ${changeClass(metric.yoy)}">同比 ${formatChange(metric.yoy)}</span>
          </span>
        </div>
      `).join("")}
    </article>
  `).join("");

  grid.querySelectorAll(".metric-row").forEach((row) => {
    row.addEventListener("click", () => openMetricModal(Number(row.dataset.row)));
  });
}

function renderNotes() {
  const list = document.getElementById("notesList");
  list.innerHTML = dashboardData.meta.notes.map((note) => `<li>${note}</li>`).join("");
}

function applyGroupFilter() {
  const value = document.getElementById("groupSelect").value;
  document.querySelectorAll(".group-card").forEach((card) => {
    card.classList.toggle("hidden", value !== "all" && card.dataset.groupId !== value);
  });
}

function findMetric(rowNumber) {
  for (const group of dashboardData.groups) {
    const metric = group.metrics.find((item) => item.row === rowNumber);
    if (metric) return { group, metric };
  }
  return null;
}

function openMetricModal(rowNumber) {
  const found = findMetric(rowNumber);
  if (!found) return;

  const { group, metric } = found;
  const rangeValue = document.getElementById("rangeSelect").value;
  const { labels, values } = windowedData(metric, rangeValue);

  document.getElementById("modalGroup").textContent = group.title;
  document.getElementById("modalTitle").textContent = metric.name;
  document.getElementById("metricModal").classList.add("open");
  document.getElementById("metricModal").setAttribute("aria-hidden", "false");

  if (modalChart) modalChart.destroy();
  modalChart = new Chart(document.getElementById("modalChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: metric.name,
        data: values,
        borderColor: COLORS[0],
        backgroundColor: `${COLORS[0]}22`,
        borderWidth: 3,
        tension: 0.35,
        pointRadius: 5,
        fill: true,
      }],
    },
    options: chartOptions(metric.name),
  });
}

function closeMetricModal() {
  document.getElementById("metricModal").classList.remove("open");
  document.getElementById("metricModal").setAttribute("aria-hidden", "true");
  if (modalChart) {
    modalChart.destroy();
    modalChart = null;
  }
}

function downloadData() {
  const blob = new Blob([JSON.stringify(dashboardData, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `wecom-dashboard-${getSelectedMonth().key}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function init() {
  initAccessGate();
  const response = await fetch(DATA_URL);
  dashboardData = await response.json();

  renderMonthOptions();
  renderMeta();
  renderGroupOptions();
  renderHighlights();
  renderInsight();
  renderMonthlyAnalysis();
  renderCharts();
  renderModules();
  renderNotes();

  document.getElementById("monthSelect").addEventListener("change", (event) => {
    selectedMonthIndex = Number(event.target.value);
    renderMeta();
    renderHighlights();
    renderInsight();
    renderMonthlyAnalysis();
    renderCharts();
    renderModules();
    applyGroupFilter();
  });
  document.getElementById("rangeSelect").addEventListener("change", () => {
    renderCharts();
  });
  document.getElementById("groupSelect").addEventListener("change", applyGroupFilter);
  document.getElementById("downloadButton").addEventListener("click", downloadData);
  document.getElementById("modalClose").addEventListener("click", closeMetricModal);
  document.getElementById("metricModal").addEventListener("click", (event) => {
    if (event.target.id === "metricModal") closeMetricModal();
  });
}

init().catch((error) => {
  console.error(error);
  document.getElementById("insightTitle").textContent = "数据读取失败";
  document.getElementById("insightBody").textContent =
    "请检查 v2/data/dashboard-data.json 是否存在，或稍后刷新重试。";
});
