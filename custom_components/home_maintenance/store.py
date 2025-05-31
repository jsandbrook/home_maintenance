"""Store Home Maintenance configuration."""

import logging

import attr
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry, storage
from homeassistant.util import dt as dt_util

from . import const
from .binary_sensor import HomeMaintenanceSensor

_LOGGER = logging.getLogger(__name__)

STORAGE_KEY = f"{const.DOMAIN}.storage"
STORAGE_VERSION_MAJOR = 1
STORAGE_VERSION_MINOR = 0


@attr.s(slots=True)
class HomeMaintenanceTask:
    """Represents a single home maintenance task."""

    id: str = attr.ib()
    title: str = attr.ib()
    interval_value: int = attr.ib()
    interval_type: str = attr.ib()
    last_performed: str = attr.ib()


class TaskStore:
    """Class to hold home maintenance task data."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the storage."""
        self.hass = hass
        self._store = storage.Store(
            hass,
            STORAGE_VERSION_MAJOR,
            STORAGE_KEY,
            minor_version=STORAGE_VERSION_MINOR,
        )
        self._tasks: dict[str, HomeMaintenanceTask] = {}

    async def async_load(self) -> None:
        """Load tasks from storage."""
        data = await self._store.async_load()
        if data is None:
            return

        self._tasks = {
            task_data["id"]: HomeMaintenanceTask(**task_data) for task_data in data
        }

    def get_all(self) -> list[dict]:
        """Get all tasks."""
        return [attr.asdict(t) for t in self._tasks.values()]

    def get(self, task_id: str) -> HomeMaintenanceTask | None:
        """Get single task."""
        return self._tasks.get(task_id)

    def add(self, task: HomeMaintenanceTask) -> str | None:
        """Add new task."""
        add_entities = self.hass.data[const.DOMAIN].get("add_entities")
        if not add_entities:
            msg = "add_entities not registered yet."
            raise RuntimeError(msg)
            return None

        device_id = self.hass.data[const.DOMAIN].get("device_id")
        if not device_id:
            msg = "Device ID not available."
            raise RuntimeError(msg)
            return None

        entity = HomeMaintenanceSensor(self.hass, attr.asdict(task), device_id)
        add_entities([entity])
        self._tasks[task.id] = task
        self.hass.data[const.DOMAIN]["entities"][task.id] = entity
        self._save()

        return entity.unique_id

    def delete(self, task_id: str) -> None:
        """Remove a task."""
        er = entity_registry.async_get(self.hass)

        # Search for entity by unique_id
        entity_entry = next(
            (
                entry
                for entry in er.entities.values()
                if entry.unique_id == task_id and entry.platform == const.DOMAIN
            ),
            None,
        )
        if entity_entry is None:
            msg = f"No entity found with task ID {task_id}."
            raise RuntimeError(msg)
            return

        # Remove the entity by entity_id
        er.async_remove(entity_entry.entity_id)

        # Remove from your task list and persist
        del self._tasks[task_id]
        self._save()

    def update_last_performed(self, task_id: str) -> None:
        """Update a tasks last performed date."""
        entity = self.hass.data[const.DOMAIN]["entities"].get(task_id)
        task = self._tasks.get(task_id)

        msg = "Task not found."
        if entity is None:
            raise RuntimeError(msg)
            return
        if task is None:
            raise RuntimeError(msg)
            return

        entity.task["last_performed"] = (
            dt_util.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        )
        task.last_performed = (
            dt_util.now().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        )
        self.hass.async_create_task(entity.async_update_ha_state(force_refresh=True))
        self._save()

    def _save(self) -> None:
        """Save tasks in the background."""
        self.hass.async_create_task(
            self._store.async_save([attr.asdict(task) for task in self._tasks.values()])
        )
