// Firefox content-world integration. Included inside the generated reader IIFE.
// Share only the numeric bookmark payload, never a function or privileged API.
function firefoxBookmarkEvent(index) {
  const detail = new window.Object();
  detail.bookmark = new window.Object();
  detail.bookmark.id = index;
  detail.bookmark.leafNum = index;
  return new CustomEvent('bookmarkSelected', {detail});
}

function firefoxPageIndex(event) {
  try {
    // Firefox Xrays hide page-created object properties. Read only the index,
    // validate it in the reader, and retain its DOM/URL fallback when absent.
    const detail = (event.wrappedJSObject || event).detail;
    const index = detail?.props?.index ?? detail?.props?.firstIndex;
    return Number.isSafeInteger(index) && index >= 0 ? index : null;
  } catch {
    return null;
  }
}
