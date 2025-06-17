import { Tag, Task } from '../types';
import type { HomeAssistant } from "custom-card-helpers";

export const loadTags = (hass: HomeAssistant): Promise<Tag[]> =>
    hass.connection.sendMessagePromise<Tag[]>({
        type: 'tag/list',
    });

export const loadTasks = (hass: HomeAssistant): Promise<Task[]> =>
    hass.callWS({
        type: 'home_maintenance/get_tasks',
    });

export const loadTask = (hass: HomeAssistant, id: string): Promise<Task> =>
    hass.callWS({
        type: 'home_maintenance/get_task',
        task_id: id,
    })

export const saveTask = (hass: HomeAssistant, payload: Record<string, any>): Promise<void> =>
    hass.callWS({
        type: 'home_maintenance/add_task',
        ...payload,
    })

export const removeTask = (hass: HomeAssistant, id: string): Promise<void> =>
    hass.callWS({
        type: 'home_maintenance/remove_task',
        task_id: id,
    });

export const completeTask = (hass: HomeAssistant, id: string): Promise<void> =>
    hass.callWS({
        type: 'home_maintenance/complete_task',
        task_id: id,
    })

export const updateTask = (hass: HomeAssistant, payload: Record<string, any>): Promise<void> =>
    hass.callWS({
        type: 'home_maintenance/update_task',
        ...payload,
    })