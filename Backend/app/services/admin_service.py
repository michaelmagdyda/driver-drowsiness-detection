"""Admin service - real user/role listing for the admin console.

Every caller reaches this only through
:func:`app.dependencies.auth.require_admin` (enforced at the route layer) -
this service holds no authorisation logic of its own, it assumes the caller
has already been cleared to see every user.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.core.constants import AppRole
from app.schemas.admin import AdminUser

if TYPE_CHECKING:
    from app.infra.repositories.admin_repository import AdminRepository


class AdminService:
    """Joins Auth users with their profile and role rows.

    Args:
        repository: Reads cross-user identity/role/profile data.
    """

    def __init__(self, repository: AdminRepository) -> None:
        """Store the injected repository."""
        self._repository = repository

    async def list_users(
        self, *, page: int | None = None, per_page: int | None = None
    ) -> list[AdminUser]:
        """Return every registered user, with their profile and effective role.

        Args:
            page: 1-based page number, or ``None`` for the API's default.
            per_page: Rows per page, or ``None`` for the API's default.

        Returns:
            One :class:`AdminUser` per registered account.

        Raises:
            DatabaseError: Propagated from the repository.
        """
        auth_users = await self._repository.list_auth_users(page=page, per_page=per_page)
        role_rows = await self._repository.list_all_roles()
        profile_rows = await self._repository.list_all_profiles()

        admin_ids = {row["user_id"] for row in role_rows if row.get("role") == AppRole.ADMIN.value}
        display_names = {row["id"]: row.get("display_name") for row in profile_rows}

        return [
            AdminUser(
                id=user.id,
                email=user.email,
                display_name=display_names.get(user.id),
                role=(AppRole.ADMIN if user.id in admin_ids else AppRole.USER).value,
                created_at=user.created_at,
                last_sign_in_at=user.last_sign_in_at,
            )
            for user in auth_users
        ]
