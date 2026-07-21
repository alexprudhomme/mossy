# Requirements Document

## Introduction

This feature adds the ability to create a new Jira ticket directly from the "MY JIRA ISSUES" panel in the Mossy desktop app. Users click a "+" icon in the panel header to open a modal dialog, fill in a minimal set of fields (summary, parent epic), and submit to create a "User Story" ticket in their configured Jira project. The ticket is automatically assigned to the current user on a best-effort basis.

## Glossary

- **Mossy**: The macOS desktop app for managing git worktrees with integrated issue tracking.
- **Issue_Panel**: The sidebar panel in Mossy that displays the current user's Jira issues (labeled "MY JIRA ISSUES").
- **Creation_Form**: The modal dialog that opens when the user clicks the "+" icon, containing fields for creating a new Jira ticket.
- **Jira_CLI**: The `jira` command-line tool used by Mossy to interact with Jira via shell commands.
- **Summary_Field**: The free-text field for the ticket title/summary.
- **Parent_Epic**: An optional association linking the new ticket to an existing Jira epic.
- **Configured_Project**: The Jira project associated with the user's Jira CLI configuration.

## Requirements

### Requirement 1: Entry Point

**User Story:** As a user, I want a "+" icon in the "MY JIRA ISSUES" panel header, so that I can initiate Jira ticket creation without leaving the app.

#### Acceptance Criteria

1. WHILE the Issue_Panel is visible and the issue tracker is configured as "jira", THE Issue_Panel SHALL display a "+" icon button in the panel header, positioned to the left of the existing refresh button within the same button group.
2. WHEN the user clicks the "+" icon button, THE Mossy app SHALL open a centered modal dialog overlaying the app window containing the Creation_Form.
3. WHILE the issue tracker is configured as "github" or "none", THE Issue_Panel SHALL NOT display the "+" icon button.
4. IF the issue tracker is configured as "jira" and the Jira_CLI is not authenticated, THE Creation_Form modal SHALL still open, and any authentication errors SHALL be displayed inside the form (e.g., as error banners for project or user resolution failures).

### Requirement 2: Creation Form Layout

**User Story:** As a user, I want a dedicated modal form for creating Jira tickets, so that I can fill in the necessary fields without navigating away from my workflow.

#### Acceptance Criteria

1. WHEN the Creation_Form is opened, THE Creation_Form SHALL appear as a centered modal dialog and display the following fields in top-to-bottom order: Summary_Field text input, and Parent_Epic searchable dropdown.
2. WHEN the Creation_Form is opened, THE Creation_Form SHALL display a "Create" submit button (initially enabled) and a "Cancel" button.
3. WHEN the user clicks the "Cancel" button, THE Creation_Form SHALL close immediately.
4. THE Creation_Form modal SHALL be dismissible via the Escape key, which closes the form immediately. The modal SHALL NOT close when clicking outside.
5. THE Creation_Form modal SHALL have `role="dialog"`, `aria-modal="true"`, and be labeled by the form header via `aria-labelledby` for accessibility.

### Requirement 3: Issue Type

**User Story:** As a user, I want the system to use a consistent issue type so that ticket categorization is automatic.

#### Acceptance Criteria

1. THE Creation_Form SHALL always use "User Story" as the issue type when creating a ticket. No work type selection is presented to the user.

### Requirement 4: Summary Field

**User Story:** As a user, I want to enter a summary for my ticket, so that it has a descriptive title.

#### Acceptance Criteria

1. THE Creation_Form SHALL display the Summary_Field as a single-line free-text input.
2. IF the Summary_Field is empty or contains only whitespace at the time of submission, THEN THE Creation_Form SHALL prevent submission and display a validation message indicating that a summary is required.
3. THE Creation_Form SHALL enforce a maximum length of 255 UTF-8 characters on the Summary_Field and SHALL prevent the user from entering more than 255 UTF-8 characters.
4. WHEN the user submits the Creation_Form, THE Creation_Form SHALL strip leading and trailing whitespace from the Summary_Field value before submission.
5. IF the Summary_Field content reaches 255 UTF-8 characters, THEN THE Creation_Form SHALL display a character count indicator showing the current length relative to the 255-character maximum.
6. THE Summary_Field SHALL accept any printable Unicode characters including letters, numbers, punctuation, and spaces.
7. THE Summary_Field SHALL have `autoCorrect="off"`, `autoCapitalize="off"`, and `spellCheck=false` to prevent macOS text correction.
8. BEFORE submission, embedded newline, carriage return, and tab characters in the summary SHALL be replaced with spaces.

### Requirement 5: Parent Epic Field

**User Story:** As a user, I want to optionally link my ticket to a parent epic, so that it is organized within the correct body of work.

#### Acceptance Criteria

1. THE Creation_Form SHALL display the Parent_Epic field as a searchable dropdown that shows each epic as its issue key followed by its summary (e.g., "PROJ-123 Epic summary").
2. THE Parent_Epic field SHALL default to empty (no epic selected).
3. THE Creation_Form SHALL populate the Parent_Epic dropdown with up to 50 epics from the Configured_Project fetched via the Jira_CLI.
4. THE Parent_Epic field SHALL be optional — the Creation_Form SHALL allow submission with no Parent_Epic selected.
5. WHEN the user types in the Parent_Epic dropdown, THE Creation_Form SHALL filter the displayed epics by performing a case-insensitive substring match against both the epic key and the epic summary.
6. IF the Jira_CLI returns an error or no epics when fetching the Parent_Epic list, THEN THE Creation_Form SHALL display the Parent_Epic dropdown as empty and allow the user to proceed without selecting a parent epic.
7. THE Parent_Epic list SHALL exclude epics with a status in the set: done, closed, resolved, completed, cancelled, canceled, rejected.

### Requirement 6: Auto-Populated Fields

**User Story:** As a user, I want the project and assignee fields to be automatically set from my configuration, so that I do not need to manually enter repetitive information.

#### Acceptance Criteria

1. WHEN the Creation_Form submits a new ticket, THE Mossy app SHALL rely on the Jira CLI's own project configuration (read from `~/.config/.jira/.config.yml`) to determine the target project. The project is NOT explicitly passed as a CLI flag.
2. WHEN the Creation_Form submits a new ticket, THE Mossy app SHALL set the assignee field via the `-a` flag using the output of `jira me`. IF `jira me` fails, the ticket SHALL still be created without an explicit assignee (best-effort).
3. WHEN the Creation_Form submits a new ticket, THE Mossy app SHALL use Jira default values for all fields not explicitly set by the user or by auto-population.
4. WHEN the Creation_Form is opened, THE Creation_Form SHALL display the resolved project name and assignee as read-only information so the user can confirm which values will be auto-populated.

### Requirement 7: Ticket Submission

**User Story:** As a user, I want to submit the form to create the Jira ticket, so that the ticket is available in my Jira project.

#### Acceptance Criteria

1. WHEN the user clicks the "Create" button with all mandatory fields valid, THE Mossy app SHALL create a new issue in Jira via the Jira_CLI with "User Story" as the type, the Summary, Parent_Epic (if provided), and current user as assignee (best-effort).
2. WHEN the Jira_CLI returns a successful result, THE Mossy app SHALL close the Creation_Form modal immediately, and SHALL refresh the Issue_Panel after a 2-second delay (to allow Jira indexing time).
3. IF the Jira_CLI returns an error during ticket creation, THEN THE Mossy app SHALL display an error message within the Creation_Form indicating the failure reason from the Jira_CLI output, and SHALL preserve all user-entered form data so the user can correct and retry without re-entering information.
4. WHILE the ticket creation request is in progress, THE Creation_Form SHALL disable the "Create" button, the "Cancel" button, and all form inputs, and SHALL display a loading indicator to prevent duplicate submissions or navigation away from the form.
5. IF the Jira_CLI does not respond within 30 seconds, THEN THE Mossy app SHALL abort the request, re-enable the Creation_Form controls, preserve all user-entered form data, and display an error message indicating that the request timed out.

### Requirement 8: Form Validation

**User Story:** As a user, I want to see clear validation feedback, so that I can correct any issues before submitting.

#### Acceptance Criteria

1. WHEN the user clicks "Create" with the Summary_Field empty or whitespace-only, THE Creation_Form SHALL display a validation message adjacent to the Summary_Field indicating that a summary is required.
2. WHEN the user modifies a field that has a visible validation message, THE Creation_Form SHALL remove the validation message for that field once the field value satisfies its validation rule.
3. THE Creation_Form SHALL NOT send a creation request to the Jira_CLI until all mandatory field validations pass.
