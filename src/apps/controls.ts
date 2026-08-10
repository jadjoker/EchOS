/**
 * Shared control widgets.
 *
 * Three apps was enough repetition to justify this, and the generator will need
 * exactly this vocabulary later — a generated app is going to be assembled from
 * widgets like these, so building them once here is not premature.
 */

export function appShell(): { root: HTMLElement; controls: HTMLElement; stage: HTMLElement } {
  const root = document.createElement("div");
  root.className = "app";

  const controls = document.createElement("div");
  controls.className = "app-controls";

  const stage = document.createElement("div");
  stage.className = "app-stage";

  root.append(controls, stage);
  return { root, controls, stage };
}

export function select<T extends string>(
  label: string,
  options: readonly T[],
  initial: T,
  onChange: (value: T) => void,
): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "ctl ctl-select";

  const name = document.createElement("span");
  name.className = "ctl-label";
  name.textContent = label;

  const field = document.createElement("select");
  field.className = "ctl-field";
  for (const option of options) {
    const el = document.createElement("option");
    el.value = option;
    el.textContent = option;
    field.append(el);
  }
  field.value = initial;
  field.addEventListener("change", () => onChange(field.value as T));

  wrap.append(name, field);
  return wrap;
}

export function slider(
  label: string,
  min: number,
  max: number,
  step: number,
  initial: number,
  onChange: (value: number) => void,
): HTMLElement {
  const wrap = document.createElement("label");
  wrap.className = "ctl ctl-slider";

  const name = document.createElement("span");
  name.className = "ctl-label";
  name.textContent = label;

  const readout = document.createElement("span");
  readout.className = "ctl-readout";
  readout.textContent = format(initial);

  const field = document.createElement("input");
  field.className = "ctl-field";
  field.type = "range";
  field.min = String(min);
  field.max = String(max);
  field.step = String(step);
  field.value = String(initial);
  field.addEventListener("input", () => {
    const value = Number(field.value);
    readout.textContent = format(value);
    onChange(value);
  });

  wrap.append(name, field, readout);
  return wrap;
}

export function button(label: string, onClick: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "ctl-button";
  el.textContent = label;
  el.addEventListener("click", onClick);
  return el;
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}
