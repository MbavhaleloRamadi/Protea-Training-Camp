function renderCalendar(monthId, year, month, highlights) {
  const calendar = document.getElementById(monthId);
  const monthNames = ["January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December"];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = `<h3>${monthNames[month]} '${year.toString().slice(-2)}</h3>`;
  html += `<table><tr><th>S</th><th>M</th><th>T</th><th>W</th><th>T</th><th>F</th><th>S</th></tr><tr>`;

  for (let i = 0; i < firstDay; i++) html += "<td></td>";

  for (let day = 1; day <= daysInMonth; day++) {
    const key = `${month + 1}-${day}`;
    const color = highlights[key];
    html += `<td${color ? ` style="background-color: ${color}; color: black;"` : ''}>${day}</td>`;
    if ((day + firstDay) % 7 === 0) html += "</tr><tr>";
  }

  html += "</tr></table>";
  calendar.innerHTML = html;
}

document.getElementById("dashboardBtn").addEventListener("click", () => {
  window.location.href = "dashboard.html";
});

renderCalendar("calendar-july", 2025, 6, {
  "7-4": "#ffff00", "7-11": "#ff9900", "7-18": "#ff9900", "7-25": "#ff9900",
  "7-14": "#ffff00", "7-20": "#ffff00"
});
renderCalendar("calendar-august", 2025, 7, {
  "8-1": "#ff9900", "8-8": "#ff9900", "8-15": "#ff9900", "8-22": "#ff9900",
  "8-29": "#ff9900"
});
renderCalendar("calendar-september", 2025, 8, {
  "9-5": "#ff9900", "9-12": "#ff0000", "9-19": "#ff9900"
});
