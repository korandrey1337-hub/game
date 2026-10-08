export function createActionRenderer(panel) {
  let previousMarkup;
  return markup => {
    // Browser serialization normalizes attributes; compare the source instead.
    if (markup === previousMarkup) return;
    panel.innerHTML = markup;
    previousMarkup = markup;
  };
}
