/**
 * Renaming in place, on a desktop icon or a row in Files.
 *
 * Shared because the interaction has to be identical in both, and because the
 * detail that sells it is easy to leave out: the extension is not part of the
 * initial selection. Typing over a freshly made note should replace "untitled"
 * and leave ".txt" alone, which is what every file manager does and what the
 * hand expects.
 */

export interface RenameOptions {
  /** Called with the trimmed new name. Not called if nothing changed. */
  commit(next: string): void;
  /** Called whether the edit was committed or abandoned, to restore the row. */
  done?(): void;
}

/**
 * Swap `label` for a text field, and put it back when the edit ends.
 *
 * The label is hidden rather than removed so the caller's layout, which sized
 * itself around it, does not jump as the field appears.
 */
export function renameInPlace(
  label: HTMLElement,
  current: string,
  options: RenameOptions,
): void {
  const field = document.createElement("input");
  field.className = "rename-field";
  field.type = "text";
  field.value = current;
  field.spellcheck = false;
  field.setAttribute("aria-label", `Rename ${current}`);

  label.hidden = true;
  label.after(field);

  let settled = false;
  const finish = (next: string | null): void => {
    if (settled) return;
    settled = true;
    field.remove();
    label.hidden = false;
    if (next !== null && next !== current) options.commit(next);
    options.done?.();
  };

  field.addEventListener("keydown", (event) => {
    // Stopped here or the row underneath acts on the same key: Enter reopens
    // the file being renamed, and Escape closes the window around it.
    event.stopPropagation();
    if (event.key === "Enter") {
      event.preventDefault();
      finish(field.value.trim());
    } else if (event.key === "Escape") {
      event.preventDefault();
      finish(null);
    }
  });

  // Clicking away commits, which is the convention almost everywhere. Escape
  // is the way out.
  field.addEventListener("blur", () => finish(field.value.trim()));
  // The field lives inside a row that opens things on click.
  field.addEventListener("click", (event) => event.stopPropagation());
  field.addEventListener("dblclick", (event) => event.stopPropagation());

  field.focus();
  const stem = current.lastIndexOf(".");
  field.setSelectionRange(0, stem > 0 ? stem : current.length);
}
