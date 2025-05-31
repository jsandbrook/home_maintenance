"""Constants for the Home Maintenance integration."""

import voluptuous as vol
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
    }
)
