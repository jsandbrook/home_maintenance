class HomeMaintenancePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.tasks = null;
  }

  set hass(hass) {
    this._hass = hass;
    //this.render();
    this.loadTags();
  }

  async loadTags() {
    if (!this._hass) return;

    this.tags = await this._hass.connection.sendMessagePromise({
      type: "tag/list"
    });

    this.render();
  }

  async wsRequest(type, payload = {}) {
    return await this._hass.callWS({
      type: `home_maintenance/${type}`,
      ...payload
    });
  }

  async loadTasks() {
    try {
      console.log("Calling get_tasks via WebSocket...");
      const tasks = await this.wsRequest("get_tasks");
      console.log("Tasks received:", tasks);
      this.tasks = tasks;
      this.render();
    } catch (error) {
      console.error("Failed to load tasks:", error);
    }
  }

  async addTask() {
    const titleEl = this.shadowRoot.getElementById("title");
    const intervalValueEl = this.shadowRoot.getElementById("interval");
    const intervalTypeEl = this.shadowRoot.getElementById("interval-type");
    const lastPerformedEl = this.shadowRoot.getElementById("last-performed");
    const tagIdEl = this.shadowRoot.getElementById("tag-select");

    const title = titleEl.value.trim();
    const intervalValue = parseInt(intervalValueEl.value);
    const intervalType = intervalTypeEl.value;
    if (!title || isNaN(intervalValue) || !intervalType) return alert("Please fill all fields");

    const dateStr = lastPerformedEl.value;
    let lastPerformed = undefined;
    if (dateStr) {
      const [year, month, day] = dateStr.split("-").map(Number);
      const parsedDate = new Date(year, month - 1, day);
      if (!isNaN(parsedDate.getTime())) {
        parsedDate.setHours(0, 0, 0, 0);
        lastPerformed = parsedDate.toISOString();
      } else {
        alert("Invalid date entered.");
      }
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      lastPerformed = today.toISOString();
    }
    console.log("Raw input:", dateStr);
    console.log("Converted to send:", lastPerformed);

    const tagId = tagIdEl.value || null;

    // Disable button to prevent double clicks
    const addButton = this.shadowRoot.getElementById("add-button");
    addButton.disabled = true;

    await this.wsRequest("add_task", { title, interval_value: intervalValue, interval_type: intervalType, last_performed: lastPerformed, tag_id: tagId });
    titleEl.value = "";
    intervalValueEl.value = "";
    intervalTypeEl.value = "days";
    tagIdEl.value = "";
    await this.loadTasks();

    addButton.disabled = false;
    titleEl.focus();
  }

  async completeTask(id) {
    await this.wsRequest("complete_task", { task_id: id });
    this.loadTasks();
  }

  async removeTask(id) {
    if (!confirm("Are you sure you want to remove this task?")) return;
    await this.wsRequest("remove_task", { task_id: id });
    this.loadTasks();
  }

  connectedCallback() {
    this.render();
    this.loadTasks();
  }

  render() {
    if (!this.tasks) {
      this.shadowRoot.innerHTML = `<p>Loading tasks...</p>`;
      return;
    }

    const tagOptions = this.tags
      ? this.tags.map(tag => `<option value="${tag.id}">${tag.name || tag.id}</option>`).join("")
      : `<option disabled>Loading...</option>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 16px;
          background: var(--lovelace-background, var(--primary-background-color));
        }

        ha-card {
          display: block;
          margin-bottom: 16px;
          padding: 16px;
        }

        .form-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        input, button, select {
          padding: 8px;
          font-size: 1em;
          height: 40px;
          box-sizing: border-box;
        }

        input[type="date"]:hover {
          border-color: var(--primary-text-color); /* or use --primary-color for accent */
        }

        select {
          min-width: 120px;
        }

        ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        li {
          margin-bottom: 12px;
          padding: 8px;
          padding-left: 0;
          border-bottom: 1px solid var(--divider-color);
        }

        button {
          margin-right: 8px;
          background: var(--primary-color);
          color: var(--text-primary-color);
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        button:hover {
          filter: brightness(1.1);
        }

        button ha-icon {
          vertical-align: middle;
          margin-right: 4px;
        }

        .form-field {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
        }

        .form-field label {
          display: block;
          color: var(--primary-text-color);
          font-weight: 500;
          margin-bottom: 4px;
        }

        .form-field input[type="date"] {
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;

          line-height: 1.2;

          border-style: solid;
          border-width: 1px;
          border-radius: 2px;
        }

        .form-field small {
          color: var(--secondary-text-color);
          font-size: 13px;
        }

        .task-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--divider-color);
        }

        .task-content {
          flex: 1;
        }

        .task-actions {
          display: flex;
          flex-direction: row;
          gap: 0.5rem;
        }

        .due-soon {
          color: var(--error-color, red);
          font-weight: bold;
        }

        .warning {
          --mdc-theme-primary: var(--error-color);
          color: var(--primary-text-color);
        }
      </style>

      <ha-card header="Create New Task">
        <div class="card-content">
          <div class="form-row">
            <div class="form-field">
              <label for="title">Task Title</label>
              <input id="title" type="text" placeholder="Enter task title" />
            </div>

            <div class="form-field">
              <label for="interval">Interval</label>
              <input id="interval" type="number" min="1" />
            </div>

            <div class="form-field">
              <label for="interval-type">Interval Type</label>
              <select id="interval-type">
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
                <option value="months">Months</option>
              </select>
            </div>

            <div class="form-field">
              <label for="last-performed">Last Performed</label>
              <input id="last-performed" type="date" />
              <small>Optional — leave blank to use today</small>
            </div>

            <div class="form-field">
              <label for="tag-select">Tag</label>
              <select id="tag-select">
                <option value="">None</option>
                ${tagOptions}
              </select>
              <small>Optional</small>
            </div>

            <div class="form-field">
              <label>&nbsp;</label>
              <mwc-button id="add-button">Add Task</mwc-button>
            </div>
          </div>
        </div>
      </ha-card>

      <ha-card header="Current Tasks">
        <div class="card-content">
          <ul id="task-list"></ul>
        </div>
      </ha-card>
    `;

    this.shadowRoot.getElementById("add-button").addEventListener("click", () => this.addTask());
    this.renderTasks();
  }

  renderTasks() {
    const taskList = this.shadowRoot.getElementById("task-list");
    if (!taskList) return;

    if (!this.tasks || this.tasks.length === 0) {
      taskList.innerHTML = `<li>No tasks found.</li>`;
      return;
    }

    taskList.innerHTML = this.tasks.map((task) => {
      const last = new Date(task.last_performed);
      const next = new Date(last);
      const now = new Date();
      const value = parseInt(task.interval_value);
      const type = task.interval_type || "days";
      let typeLabel = type;

      if (type === "days") {
        next.setDate(next.getDate() + value);
        if (value === 1) {
          typeLabel = "day";
        }
      } else if (type === "weeks") {
        next.setDate(next.getDate() + value * 7);
        if (value === 1) {
          typeLabel = "week";
        }
      } else if (type === "months") {
        next.setMonth(next.getMonth() + value);
        if (value === 1) {
          typeLabel = "month";
        }
      }

      const isDue = next <= now;

      return `
        <li class="task-item">
          <div class="task-content">
            <div>
              <strong>${task.title}</strong> — every ${task.interval_value} ${typeLabel}.
            </div>
            <div>Last: ${last.toLocaleDateString()}</div>
            <div>
              Next Due:
              <span class="${isDue ? 'due-soon' : ''}">
                ${next.toLocaleDateString()}
              </span>
            </div>
          </div>
          <div class="task-actions">
            <mwc-button data-id="${task.id}" class="complete">
              <ha-icon icon="mdi:check-circle-outline"></ha-icon> Complete
            </mwc-button>
            <mwc-button data-id="${task.id}" class="remove warning">
              <ha-icon icon="mdi:trash-can-outline"></ha-icon> Remove
            </mwc-button>
          </div>
        </li>
      `;
    }).join("");

    this.shadowRoot.querySelectorAll(".complete").forEach((btn) =>
      btn.addEventListener("click", (e) => this.completeTask(e.target.dataset.id))
    );
    this.shadowRoot.querySelectorAll(".remove").forEach((btn) =>
      btn.addEventListener("click", (e) => this.removeTask(e.target.dataset.id))
    );
  }
}

customElements.define("home-maintenance-panel", HomeMaintenancePanel);

window._homeMaintenancePanel = {
  version: "1.0",
  setup: (el, hass, config) => {
    const panel = document.createElement("home-maintenance-panel");
    panel.hass = hass;
    el.appendChild(panel);
  },
};