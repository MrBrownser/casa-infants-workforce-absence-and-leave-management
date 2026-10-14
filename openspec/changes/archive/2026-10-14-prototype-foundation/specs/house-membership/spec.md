## REMOVED Requirements

### Requirement: Effective-dated House membership

**Reason**: Dated membership periods are not needed yet. A history of who covered each post will come in a later spec; this first delivery keeps the simplest model (product owner decision after the prototypes).

**Migration**: A person belongs to one House through the `house_id` of the `people` row (`people-and-posts`). Moving a person is an edit. The `house_memberships` table is dropped with the single initial migration.

### Requirement: One House at a time

**Reason**: With one `house_id` per person, a person belongs to exactly one House by construction; the exclusion constraint is no longer needed.

**Migration**: None needed: the data model makes overlapping Houses impossible.

### Requirement: Current team members

**Reason**: Replaced by the Equip page of `people-and-posts`, which lists the posts of the House and their active people.

**Migration**: Use the active people of the House (`people-and-posts`, "Equip lists posts and people").

### Requirement: Historical membership

**Reason**: No screen needs a person's House on a past date yet. A history of people and posts is planned for a later spec.

**Migration**: None in this change. Until the history spec, a person's House is their current House.

### Requirement: Transfer does not rewrite history

**Reason**: Transfers become "move the person to another House", an in-place edit. Balances and records belong to the person and move with them ("Balances follow the person" in `people-and-posts`).

**Migration**: Use the move action of `people-and-posts` ("Move a person to another post or House").

### Requirement: House-scoped records keep their own House

**Reason**: Vacations, APs and the calendar surplus belong to the person, not to a House (product owner): a person who moves keeps them. Records that do belong to a House (rota changes, day notes) will say so in SPEC-005.

**Migration**: See "Balances follow the person" in `people-and-posts`.

### Requirement: Temporary cross-House work is not membership

**Reason**: There is no membership any more. Coverage of absences (including by the CT) is part of SPEC-005 (El mes) and never changes a person's House or post.

**Migration**: SPEC-005 records who covers an absence on the absence or rota day itself.

### Requirement: Minimal employee data

**Reason**: Replaced by "Minimal personal data" in `people-and-posts`.

**Migration**: See `people-and-posts`.
