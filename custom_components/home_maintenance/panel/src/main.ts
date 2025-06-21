import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";
import type { HomeAssistant } from "custom-card-helpers";

import { localize } from '../localize/localize';
import { VERSION } from "./const";
import { commonStyle } from './styles'
import { IntegrationConfig, IntervalType, INTERVAL_TYPES, getIntervalTypeLabels, Task, Tag } from './types';
import { completeTask, getConfig, loadTags, loadTask, loadTasks, removeTask, saveTask, updateTask } from './data/websockets';

export class HomeMaintenancePanel extends LitElement {
    @property() hass?: HomeAssistant;
    @property() narrow!: boolean;

    @state() private tags: Tag[] | null = null;
    @state() private tasks: Task[] = [];
    @state() private config: IntegrationConfig | null = null;

    // New Task form state
    @state() title = "";
    @state() intervalValue: number | "" = "";
    @state() intervalType = "days";
    @state() lastPerformed = "";
    @state() tagId: string = " ";
    @state() icon: string = "";

    // Edit dialog state
    @state() private editingTask: Task | null = null;

    private async loadData() {
        this.tags = await loadTags(this.hass!);
        this.tasks = await loadTasks(this.hass!);
        this.config = await getConfig(this.hass!);
    }

    private async resetForm() {
        this.title = "";
        this.intervalValue = "";
        this.intervalType = "days";
        this.lastPerformed = "";
        this.tagId = " ";
        this.icon = "";

        this.tasks = await loadTasks(this.hass!);
    }

    private computeISODate(dateStr: string): string {
        let isoDateStr: string;

        if (dateStr) {
            // Only take the YYYY-MM-DD part to avoid time zone issues
            const [yearStr, monthStr, dayStr] = dateStr.split("T")[0].split("-");
            const year = Number(yearStr);
            const month = Number(monthStr);
            const day = Number(dayStr);

            if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                const parsedDate = new Date(year, month - 1, day);
                parsedDate.setHours(0, 0, 0, 0);
                isoDateStr = parsedDate.toISOString();
            } else {
                alert("Invalid date entered.");
                const fallback = new Date();
                fallback.setHours(0, 0, 0, 0);
                isoDateStr = fallback.toISOString();
            }
        } else {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            isoDateStr = today.toISOString();
        }

        return isoDateStr;
    }

    connectedCallback() {
        super.connectedCallback();
        this.loadData();
    }

    renderTagSelect() {
        if (!this.hass) return html``;

        return html`
            <div class="form-field">
                <ha-select
                label="${localize('panel.cards.new.fields.tag.heading', this.hass.language)}"
                floatLabel
                helper="${localize('panel.cards.new.fields.tag.helper', this.hass.language)}"
                helperPersistent
                .value=${this.tagId || " "}
                @change=${(e: Event) => this.tagId = (e.target as HTMLSelectElement).value || ""}
                fixedMenuPosition
                naturalMenuWidth
                >
                <mwc-list-item value=" ">${localize('common.none', this.hass.language)}</mwc-list-item>
                ${this.tags
                ? this.tags.map((tag) => html`
                    <mwc-list-item value=${tag.id}>${tag.name || tag.id}</mwc-list-item>
                    `
                )
                : html`<mwc-list-item disabled>${localize('common.loading', this.hass.language)}</mwc-list-item>`}
                </ha-select>
            </div>
        `;
    }

    render() {
        if (!this.hass) return html``;

        if (!this.tasks || !this.tags) {
            return html`<p>${localize('common.loading', this.hass.language)}</p>`;
        }

        return html`
            <div class="header">
                <div class="toolbar">
                    <ha-menu-button .hass=${this.hass} .narrow=${this.narrow}></ha-menu-button>
                    <div class="main-title">
                        ${this.config?.options.sidebar_title}
                    </div>
                    <div class="version">
                        v${VERSION}
                    </div>
                </div>
            </div>

            <div class="view">
                <ha-card header="${localize('panel.cards.new.title', this.hass.language)}">
                    <div class="card-content">${this.renderForm()}</div>
                </ha-card>

                <div class="break"></div>

                <ha-card header="${localize('panel.cards.current.title', this.hass.language)}">
                    <div class="card-content">
                        <ul id="task-list" class="task-list">${this.renderTasks()}</ul>
                    </div>
                </ha-card>
            </div>

            <ha-form
                style="display: none"
                .hass=${this.hass}
                .data=${{ dummy: "" }}
                .schema=${[{ name: "dummy", selector: { date: {} } }]}
            ></ha-form>

            ${this.renderEditDialog()}
        `;
    }

    renderForm() {
        if (!this.hass) return html``;

        const intervalTypeLabels = getIntervalTypeLabels(this.hass.language);

        return html`
            <div class="form-row">
                <div class="form-field">
                    <ha-textfield
                        label="${localize('panel.cards.new.fields.title.heading', this.hass.language)}"
                        .value=${this.title}
                        @input=${(e: Event) => this.title = (e.target as HTMLInputElement).value}
                    />
                </div>

                <div class="form-field">
                    <ha-textfield
                        label="${localize('panel.cards.new.fields.interval_value.heading', this.hass.language)}"
                        type="number"
                        min="1"
                        .value=${String(this.intervalValue)}
                        @input=${(e: Event) => this.intervalValue = parseInt((e.target as HTMLInputElement).value)}
                    />
                </div>

                <div class="form-field">
                    <ha-select
                        label="${localize('panel.cards.new.fields.interval_type.heading', this.hass.language)}"
                        .value=${this.intervalType}
                        @change=${(e: Event) => this.intervalType = (e.target as HTMLSelectElement).value}
                        fixedMenuPosition
                        naturalMenuWidth
                    >
                    ${INTERVAL_TYPES.map((type) => html`
                        <mwc-list-item .value=${type}>
                            ${intervalTypeLabels[type]}
                        </mwc-list-item>
                    `)}
                    </ha-select>
                </div>

                <div class="form-field">
                    <ha-date-input
                        label="${localize('panel.cards.new.fields.last_performed.heading', this.hass.language)}"
                        helper="${localize('panel.cards.new.fields.last_performed.helper', this.hass.language)}"
                        .locale=${this.hass.locale}
                        .value=${this.lastPerformed}
                        @value-changed=${(e: Event) => this.lastPerformed = (e.target as HTMLInputElement).value}
                    >
                </div>

                ${this.renderTagSelect?.() ?? null}

                <div class="form-field">
                    <ha-icon-picker
                        label="${localize('panel.cards.new.fields.icon.heading', this.hass.language)}"
                        helper="${localize('panel.cards.new.fields.icon.helper', this.hass.language)}"
                        helperPersistent
                        .value=${this.icon}
                        @value-changed=${(e: CustomEvent) => this.icon = e.detail.value}
                    ></ha-icon-picker>
                </div>

                <div class="form-field">
                    <mwc-button @click=${this._handleAddTaskClick}>${localize('panel.cards.new.actions.add_task', this.hass.language)}</mwc-button>
                </div>

                <div class="filler"></div>
            </div>
        `;
    }

    renderTasks() {
        if (!this.hass) return html``;

        if (!this.tasks || this.tasks.length === 0) {
            return html`<li>No tasks found.</li>`;
        }

        const now = new Date();

        return this.tasks.map((task) => {
            if (!this.hass) return html``;

            const last = new Date(this.computeISODate(task.last_performed));
            const next = new Date(last);
            const value = task.interval_value;
            let typeLabel: string = task.interval_type;
            const intervalType: IntervalType = task.interval_type;

            switch (intervalType) {
                case "days":
                    next.setDate(next.getDate() + value);
                    if (value === 1) typeLabel = localize('intervals.day', this.hass.language);
                    break;
                case "weeks":
                    next.setDate(next.getDate() + value * 7);
                    if (value === 1) typeLabel = localize('intervals.week', this.hass.language);
                    break;
                case "months":
                    next.setMonth(next.getMonth() + value);
                    if (value === 1) typeLabel = localize('intervals.month', this.hass.language);
                    break;
                default:
                    throw new Error(`Unsupported interval type: ${intervalType}`);
            }

            const isDue = next <= now;
            const nextDue = next.toLocaleDateString();
            const lastDone = last.toLocaleDateString();
            const icon = task.icon;

            return html`
                <li class="task-item">
                    <div class="task-content">
                        <div class="task-header">
                            <ha-icon icon="${icon}" class="task-icon"></ha-icon>
                            <strong>${task.title}</strong> — ${localize('panel.cards.current.every', this.hass.language)} ${task.interval_value} ${typeLabel}
                        </div>
                        <div>${localize('panel.cards.current.last', this.hass.language)}: ${lastDone}</div>
                        <div>
                            ${localize('panel.cards.current.next', this.hass.language)}:
                            <span class=${isDue ? "due-soon" : ""}>${nextDue}</span>
                        </div>
                    </div>
                    <div class="task-actions">
                        <mwc-button @click=${this._handleCompleteTaskClick.bind(this, task.id)}>
                            <ha-icon icon="mdi:check-circle-outline"></ha-icon> ${localize('panel.cards.current.actions.complete', this.hass.language)}
                        </mwc-button>
                        <mwc-button @click=${this._handleOpenEditDialogClick.bind(this, task.id)}>
                            <ha-icon icon="mdi:pencil-outline"></ha-icon> ${localize('panel.cards.current.actions.edit', this.hass.language)}
                        </mwc-button>
                        <mwc-button class="warning" @click=${this._handleRemoveTaskClick.bind(this, task.id)}>
                            <ha-icon icon="mdi:trash-can-outline"></ha-icon> ${localize('panel.cards.current.actions.remove', this.hass.language)}
                        </mwc-button>
                    </div>
                </li>
            `;
        });
    }

    renderEditDialog() {
        if (!this.hass) return html``;

        if (!this.editingTask) return html``;

        const intervalTypeLabels = getIntervalTypeLabels(this.hass.language);

        return html`
            <ha-dialog
                open
                heading="${localize('panel.dialog.edit_task.title', this.hass.language)}: ${this.editingTask.title}"
                @closed=${this._handleDialogClosed}
            >
                <div class="form-field">
                    <ha-textfield
                        label="${localize('panel.dialog.edit_task.fields.interval_value.heading', this.hass.language)}"
                        type="number"
                        .value=${String(this.editingTask.interval_value)}
                        @input=${(e: Event) => {
                const val = parseInt((e.target as HTMLInputElement).value);
                if (!isNaN(val)) this.editingTask!.interval_value = val;
            }}
                    ></ha-textfield>
                </div>

                <div class="form-field">
                    <ha-select
                        .value=${this.editingTask.interval_type}
                        @selected=${(e: Event) => {
                e.stopPropagation();
                this.editingTask!.interval_type = (e.target as HTMLSelectElement).value as IntervalType
            }}
                        label="${localize('panel.dialog.edit_task.fields.interval_type.heading', this.hass.language)}"
                    >
                    ${INTERVAL_TYPES.map((type) => html`
                        <mwc-list-item .value=${type}>
                            ${intervalTypeLabels[type]}
                        </mwc-list-item>
                    `)}
                    </ha-select>
                </div>

                <div class="form-field">
                    <ha-date-input
                        label="${localize('panel.dialog.edit_task.fields.last_performed.heading', this.hass.language)}"
                        helper="${localize('panel.dialog.edit_task.fields.last_performed.helper', this.hass.language)}"
                        .locale=${this.hass.locale}
                        .value=${this.editingTask.last_performed.split("T")[0]}
                        @value-changed=${(e: Event) => this.editingTask!.last_performed = (e.target as HTMLInputElement).value}
                    >
                </div>

                <div class="form-field">
                    <ha-icon-picker
                        label="${localize('panel.dialog.edit_task.fields.icon.heading', this.hass.language)}"
                        helper="${localize('panel.dialog.edit_task.fields.icon.helper', this.hass.language)}"
                        helperpersistent
                        .value=${this.editingTask.icon}
                        @value-changed=${(e: CustomEvent) => this.editingTask!.icon = e.detail.value}
                    ></ha-icon-picker>
                </div>

                <mwc-button slot="secondaryAction" @click=${() => (this.editingTask = null)}>
                    ${localize('panel.dialog.edit_task.actions.cancel', this.hass.language)}
                </mwc-button>
                <mwc-button slot="primaryAction" @click=${this._handleSaveEditClick}>
                    ${localize('panel.dialog.edit_task.actions.save', this.hass.language)}
                </mwc-button>
            </ha-dialog>
        `;
    }

    private async _handleAddTaskClick() {
        if (!this.title.trim() || !this.intervalValue || !this.intervalType) {
            const msg = localize('panel.cards.new.alerts.required', this.hass!.language)
            alert(msg);
            return;
        }

        const payload: Record<string, any> = {
            title: this.title.trim(),
            interval_value: this.intervalValue,
            interval_type: this.intervalType,
            last_performed: this.computeISODate(this.lastPerformed),
        };

        if (this.tagId && this.tagId.trim() !== "") {
            payload.tag_id = this.tagId;
        }

        if (this.icon && this.icon.trim() !== "") {
            payload.icon = this.icon
        } else {
            payload.icon = "mdi:calendar-check";
        }

        try {
            await saveTask(this.hass!, payload);
            await this.resetForm();
        } catch (error) {
            console.error("Failed to add task:", error);
            const msg = localize('panel.cards.new.alerts.error', this.hass!.language)
            alert(msg);
        }
    };

    private async _handleCompleteTaskClick(id: string) {
        try {
            await completeTask(this.hass!, id);
            await this.loadData();
        } catch (e) {
            console.error("Failed to complete task:", e);
        }
    }

    private async _handleOpenEditDialogClick(id: string) {
        try {
            const task: Task = await loadTask(this.hass!, id);
            this.editingTask = task;

            await this.updateComplete;
        } catch (e) {
            console.error("Failed to fetch task for edit:", e);
        }
    }

    private async _handleSaveEditClick() {
        if (!this.editingTask) return;

        const lastPerformedISO = this.computeISODate(this.editingTask.last_performed);
        if (!lastPerformedISO) return;

        let icon = "mdi:calendar-check";
        if (this.editingTask.icon && this.editingTask.icon.trim() !== "") {
            icon = this.editingTask.icon
        }

        try {
            await updateTask(this.hass!, {
                task_id: this.editingTask.id,
                updates: {
                    interval_value: Number(this.editingTask.interval_value),
                    interval_type: this.editingTask.interval_type,
                    last_performed: lastPerformedISO,
                    icon: icon,
                },
            });

            this.editingTask = null;
            await this.loadData();
        } catch (e) {
            console.error("Failed to update task:", e);
        }
    }

    private async _handleRemoveTaskClick(id: string) {
        const msg = localize('panel.cards.current.confirm_remove', this.hass!.language)
        if (!confirm(msg)) return;
        try {
            await removeTask(this.hass!, id);
            await this.loadData();
        } catch (e) {
            console.error("Failed to remove task:", e);
        }
    }

    private _handleDialogClosed(e: CustomEvent) {
        const action = e.detail?.action;
        if (action === "close" || action === "cancel") {
            this.editingTask = null;
        }
    }

    static styles = commonStyle;
}

customElements.define("home-maintenance-panel", HomeMaintenancePanel);
