class HomeMaintenancePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.tasks = null;
    this.tags = null;
  }

  set hass(hass) {
    this._hass = hass;
  }

  async loadTags() {
    if (!this._hass) return;

    this.tags = await this._hass.connection.sendMessagePromise({
      type: "tag/list"
    });
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
      this.renderTasks();
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

    const payload = {
      title,
      interval_value: intervalValue,
      interval_type: intervalType,
      last_performed: lastPerformed,
    };
    if (tagId) {
      payload.tag_id = tagId;
    }

    await this.wsRequest("add_task", payload);
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

  async editTask(id) {
    var task = await this.wsRequest("get_task", { task_id: id });

    const dialog = this.dialog;
    const titleElement = dialog.querySelector('#edit-dialog-title');
    const intervalValueInput = dialog.querySelector('#edit-interval-value');
    const intervalTypeInput = dialog.querySelector('#edit-interval-type');
    const lastPerformedInput = dialog.querySelector('#edit-last-performed');

    const date = new Date(task.last_performed);

    titleElement.innerHTML = task.title;
    intervalValueInput.value = task.interval_value;
    intervalTypeInput.value = task.interval_type;
    lastPerformedInput.value = date.toISOString().split('T')[0];

    dialog.showModal();

    dialog.addEventListener('click', (e) => {
      const rect = dialog.getBoundingClientRect();
      const clickedInDialog =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      if (!clickedInDialog) {
        dialog.close();
      }
    });

    const oldButton = dialog.querySelector('#save-task');
    if (oldButton) {
      const newButton = oldButton.cloneNode(true); // shallow copy, no listeners
      oldButton.replaceWith(newButton);

      newButton.addEventListener('click', async () => {
        const dateStr = lastPerformedInput.value;
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

        await this.wsRequest("update_task", {
          task_id: id,
          updates: {
            interval_value: parseInt(intervalValueInput.value),
            interval_type: intervalTypeInput.value,
            last_performed: lastPerformed,
          }
        });

        dialog.close();
        this.loadTasks();
      });
    }
  }

  connectedCallback() {
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

      <!-- New Task Container -->
      <ha-card header="Create New Task">
        <div id="form-container" class="card-content"></div>
      </ha-card>

      <!-- Task List Container -->
      <ha-card header="Current Tasks">
        <div class="card-content">
          <ul id="task-list"></ul>
        </div>
      </ha-card>
    `;

    this.dialog = document.createElement('dialog');
    this.dialog.id = 'edit-dialog';
    this.dialog.innerHTML = `
      <form method="dialog" id="edit-form">
        <div class="dialog-header">
          <h2 id="edit-dialog-title">Task Title</h2>
        </div>

        <div class="form-group">
          <label for="edit-interval-value">Interval</label>
          <input type="number" id="edit-interval-value" />
        </div>

        <div class="form-group">
          <label for="edit-interval-type">Interval Type</label>
          <select id="edit-interval-type">
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
          </select>
        </div>

        <div class="form-group">
          <label for="edit-last-performed">Last Performed</label>
          <input type="date" id="edit-last-performed" />
        </div>

        <menu>
          <mwc-button value="save" id="save-task" class="save-button">Update</mwc-button>
        </menu>
      </form>
    `;

    // Style it manually (since it's in light DOM)
    const style = document.createElement('style');
    style.textContent = `
      dialog {
        border: none;
        border-radius: 12px;
        background: var(--card-background-color, #202020);
        color: var(--primary-text-color, #fff);
        padding: 24px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 16px 32px rgba(0, 0, 0, 0.6);
        animation: fadeIn 0.2s ease-out;
      }

      dialog::backdrop {
        background: rgba(0, 0, 0, 0.5);
      }

      .dialog-header {
        margin-bottom: 24px;
      }

      .dialog-header h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
      }

      .dialog-header .subtitle {
        font-size: 13px;
        color: var(--secondary-text-color, #aaa);
      }

      .form-group {
        margin-bottom: 20px;
        display: flex;
        flex-direction: column;
      }

      label {
        font-size: 13px;
        margin-bottom: 4px;
        color: var(--secondary-text-color, #ccc);
      }

      input,
      select {
        background: var(--input-fill-color, #2c2c2c);
        color: var(--primary-text-color, #fff);
        border: 1px solid var(--divider-color, #444);
        border-radius: 4px;
        padding: 10px;
        font-size: 14px;
      }

      select {
        background-color: var(--card-background-color);
        color: var(--primary-text-color);
        border: 1px solid var(--divider-color);
        padding: 8px;
        border-radius: 4px;
        font-size: 1em;
      }

      select:focus {
        outline: none;
        border-color: var(--primary-color);
      }

      menu {
        display: flex;
        justify-content: end;
        border-top: 1px solid var(--divider-color, #444);
        margin-top: 24px;
        padding-top: 16px;
        padding-left: 0;
        padding-right: 0;
      }

      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      `;
    this.dialog.appendChild(style);
    document.body.appendChild(this.dialog);

    this.loadTags().then(() => {
      this.renderForm();
    });

    this.loadTasks();
  }

  render() {
    if (!this.tasks) {
      this.shadowRoot.innerHTML = `<p>Loading tasks...</p>`;
      return;
    }
  }

  renderForm() {
    const tagOptions = this.tags
      ? this.tags.map(tag => `<option value="${tag.id}">${tag.name || tag.id}</option>`).join("")
      : `<option disabled>Loading...</option>`;

    const form = document.createElement("div");
    form.innerHTML = `
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
    `

    this.shadowRoot.getElementById("form-container").appendChild(form);
    this.shadowRoot.getElementById("add-button").addEventListener("click", () => this.addTask());
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
            <mwc-button data-id="${task.id}" class="edit">
              <ha-icon icon="mdi:pencil-outline"></ha-icon> Edit
            </mwc-button>
            <mwc-button data-id="${task.id}" class="remove warning">
              <ha-icon icon="mdi:trash-can-outline"></ha-icon> Remove
            </mwc-button>
          </div>
        </li>
      `;
    }).join("");

    this.shadowRoot.querySelectorAll(".edit").forEach((btn) =>
      btn.addEventListener("click", (e) => this.editTask(e.currentTarget.dataset.id))
    );
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