## ADDED Requirements

### Requirement: Director application grants
Application access SHALL be decided by server-owned grants stored in the application's EU database, keyed by the immutable Clerk user ID, each with role `director` and an enabled or revoked state. Only a user with an enabled director grant SHALL be treated as a director; such a user MAY manage both Houses without any House membership or position. Clerk user metadata MUST NOT be read for authorisation, with no fallback.

#### Scenario: Stale metadata flag without a grant
- **WHEN** a signed-in user has Clerk `publicMetadata.role = "director"` but no enabled grant
- **THEN** House pages, staffing reads and staffing writes are denied

#### Scenario: Director without membership
- **WHEN** a user has an enabled director grant and no employee record, membership or position
- **THEN** the user can manage both Houses

### Requirement: Revocation applies on the next request
Grant checks SHALL read the current grant on every request. No cache that outlives a single request MUST keep a revoked grant effective.

#### Scenario: Revoked grant
- **WHEN** a director's grant is revoked and the director then loads a House page
- **THEN** that request is denied with the "Sense accés" page

### Requirement: Roles and links grant nothing
Occupational roles (including CT and ER), position assignments, House memberships, transfers and account links MUST NOT create, enable or revoke an application grant. Staffing forms MUST NOT accept fields that create grants or change account links.

#### Scenario: Linked ER without grant
- **WHEN** a signed-in user is linked to an employee who holds an ER position and has no grant
- **THEN** the user is denied access to House pages, reads and writes

#### Scenario: Permission fields in a form are ignored
- **WHEN** a staffing form submission includes extra fields such as `role=director` or a Clerk user ID
- **THEN** the extra fields are ignored and no grant or account link is created or changed

### Requirement: Optional employee account link
The system SHALL allow at most one Clerk user ID per employee and at most one employee per Clerk user ID. Links MUST NOT be created automatically from matching names or emails. Linking or unlinking MUST NOT change staffing history or grants.

#### Scenario: Account already linked elsewhere
- **WHEN** the operator links a Clerk user ID that is already linked to another employee
- **THEN** the link is rejected, and staffing history and grants are unchanged

### Requirement: Trusted operator provisioning
Grants and account links SHALL be managed only through operator procedures that verify the Clerk user ID exists in the Clerk instance for the target environment, show which environment and database are targeted, and require explicit confirmation before writing. Grants MUST NOT be bulk-converted from Clerk metadata. The procedure SHALL document how to restore a missing director grant.

#### Scenario: Unknown Clerk user
- **WHEN** the operator grants access to a Clerk user ID that does not exist in the configured Clerk instance
- **THEN** the procedure stops without writing a grant

#### Scenario: Grant restores access
- **WHEN** the director has no grant and the operator runs the grant procedure for the director's Clerk user ID
- **THEN** the director's next request to a House page succeeds
