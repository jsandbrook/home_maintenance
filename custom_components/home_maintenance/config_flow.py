"""Config flow for Home Maintenance integration."""  # noqa: EXE002

import secrets
from typing import Any

from homeassistant.config_entries import (
    CONN_CLASS_LOCAL_POLL,
    ConfigFlow,
    ConfigFlowResult,
)

from .const import DOMAIN, NAME


class HomeMaintenanceConfigFlow(ConfigFlow, domain=DOMAIN):
    """Config flow for Home Maintenenance."""

    VERSION = "1.0.0"
    CONNECTION_CLASS = CONN_CLASS_LOCAL_POLL

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle a flow initialized by the user."""
        # Only allow a single instance
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        new_id = secrets.token_hex(6)

        await self.async_set_unique_id(new_id)
        self._abort_if_unique_id_configured(updates=user_input)

        return self.async_create_entry(title=NAME, data={})
