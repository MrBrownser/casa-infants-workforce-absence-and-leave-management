## REMOVED Requirements

### Requirement: Effective-dated House membership

**Reason**: The director manages who covers each fixed post today; dated membership periods add complexity she does not need (product owner decision after the prototypes).

**Migration**: A person belongs to one House through the `house_id` of the `people` row (`people-and-posts`). Moving a person is an edit. The `house_memberships` table is dropped with the single initial migration.

### Requirement: One House at a time

**Reason**: With one `house_id` per person, a person belongs to exactly one House by construction; the exclusion constraint is no longer needed.

**Migration**: None needed: the data model makes overlapping Houses impossible.

### Requirement: Current team members

**Reason**: Replaced by the Equip page of `people-and-posts`, which lists the posts of the House and their active people.

**Migration**: Use the active people of the House (`people-and-posts`, "Equip lists posts and people").

### Requirement: Historical membership

**Reason**: No screen needs a person's House on a past date. Later records (APs, vacations, sick leave, rota changes) store their own House.

**Migration**: Read the House stored on each record ("House-scoped records keep their own House" in `people-and-posts`).

### Requirement: Transfer does not rewrite history

**Reason**: Transfers become "move the person to another House", an in-place edit. History is preserved because records keep their own House.

**Migration**: Use the move action of `people-and-posts` ("Move a person to another post or House").

### Requirement: House-scoped records keep their own House

**Reason**: The rule still applies but moves to the capability that owns people.

**Migration**: See "House-scoped records keep their own House" in `people-and-posts`.

### Requirement: Temporary cross-House work is not membership

**Reason**: There is no membership any more. Coverage of absences (including by the CT) is part of SPEC-005 (El mes) and never changes a person's House or post.

**Migration**: SPEC-005 records who covers an absence on the absence or rota day itself.

### Requirement: Minimal employee data

**Reason**: Replaced by "Minimal personal data" in `people-and-posts`.

**Migration**: See `people-and-posts`.
