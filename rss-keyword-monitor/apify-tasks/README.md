# Public Apify Task definitions

Each JSON file contains the saved Task name, public landing-page metadata, displayed input fields, selected dataset view, and complete Actor input.

The discovery configuration uses `onlyNew: false` so a first-time visitor can see a bounded current dataset. After copying an example, recurring monitoring requires the user to:

1. Save it as a persistent Apify Task.
2. Change `onlyNew` to `true`.
3. Keep `resetState` set to `false`.
4. Run that same Task on every schedule.

The first stateful run can return current matches. Later quiet runs can return zero records by design.

Before publication, the release coordinator must run every Task on Apify, verify success in less than five minutes with a non-empty dataset, and then select the `overview` dataset view in the Publication tab.
