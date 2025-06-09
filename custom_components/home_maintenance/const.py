"""Constants for the Home Maintenance integration."""

import voluptuous as vol
from homeassistant.config_entries import ConfigEntry
from homeassistant.helpers import config_validation as cv

VERSION = "1.0.0"
NAME = "Home Maintenance"
MANUFACTURER = "@TJPoorman"

DOMAIN = "home_maintenance"

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

PANEL_FILENAME = "panel/main.js"
PANEL_URL = "home-maintenance"
PANEL_API_URL = "/api/home_maintenance_static"
PANEL_TITLE = NAME
PANEL_ICON = "mdi:hammer-wrench"
PANEL_NAME = "home-maintenance-panel"

DEVICE_KEY = "home_maintenance_hub"

SERVICE_RESET = "reset_last_performed"
SERVICE_RESET_SCHEMA = vol.Schema(
    {
        vol.Required("entity_id"): cv.entity_id,
        vol.Optional("performed_date"): cv.string,
    }
)

CONFIG_STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Optional("admin_only", default=True): cv.boolean,
    }
)


def get_options_schema(config_entry: ConfigEntry):
    return vol.Schema(
        {
            vol.Optional(
                "admin_only",
                default=config_entry.options.get(
                    "admin_only", config_entry.data.get("admin_only", True)
                ),
            ): cv.boolean,
        }
    )
