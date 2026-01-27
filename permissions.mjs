export const NULL = 0 // No permissions.
export const CHANGE_PASSWORD = 1 // This is for their own account. To edit someone else's password, see MANAGE_USERS.
export const CHANGE_EMAIL = 2 // This is for their own account. To edit someone else's email, see MANAGE_USERS.
export const MANAGE_SETTINGS = 4 // Edit server settings.
export const MANAGE_USERS = 8 // Create or edit users accounts, including first name, last name, display name, email, password, permissions, internal id and other settings that might be added by other modules.
export const MANAGE_PERMISSIONS = 16 // Manage user permissions, this does not include default permissions
export const MANAGE_CRITICAL_PERMISSIONS = 32 // Manage critical user permissions
export const ALL = -1 // All permissions.

export const critical = 
[
    MANAGE_SETTINGS, 
    MANAGE_USERS, 
    MANAGE_PERMISSIONS, 
    MANAGE_CRITICAL_PERMISSIONS, 
    ALL
]

export const ignored = [
    NULL
]