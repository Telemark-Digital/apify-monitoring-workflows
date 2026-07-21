# Clean Export Procedure

The public repository must be created from this allowlisted staging tree, never from an Actor directory or private repository history.

## Procedure

1. Confirm all product packages are complete and reviewed.
2. Run `npm run validate` in the staging tree.
3. Create a new empty directory outside every private repository.
4. Run `npm run export:clean -- <destination>` to copy only the files in `public-files.json`.
5. Confirm the destination contains no `.git`, `.env`, `storage`, logs, private notes, or unexpected files. Validation rejects any file not explicitly allowlisted.
6. Run `npm run validate` in the destination.
7. Initialize a new Git repository in the destination.
8. Review `git status` and the full staged diff.
9. Add the remote belonging to the dedicated public publishing account.
10. Confirm the remote URL and active credential immediately before pushing.

If any check fails, stop. Correct the source and regenerate the clean export instead of patching sensitive files out of Git history afterward.
