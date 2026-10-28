// Served as a page script by manager.cjs, on a locally proxied Archive origin.
// The userscript cannot access these page globals through Firefox's Xrays.
const params = new URLSearchParams(location.search);
const fallback = params.has('fallback');
const maximum = 30;
window.fixture = {index:0, activity:0, navigation:[], broken:[], bookmarkEvents:[]};
if (!fallback) {
  jQuery('.BRpager').slider({min:0, max:maximum, value:0});
  jQuery('.ui-slider-handle').attr({'aria-label':'Page navigation slider', 'aria-valuemin':0, 'aria-valuemax':maximum, 'aria-valuenow':0});
}
function supply(index) {
  const page = document.createElement('div');
  page.className = 'BRpagecontainer'; page.dataset.index = index; page.dataset.pageNum = 'n' + index;
  const image = document.createElement('img'); image.className = 'BRpageimage';
  image.src = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="100%" height="100%" fill="#cfb990"/></svg>');
  const layer = document.createElement('div'); layer.className = 'BRtextLayer'; layer.dir = 'ltr';
  layer.style.cssText = 'width:600px;height:900px';
  layer.innerHTML = '<p class="BRparagraphElement" style="margin-left:40px;margin-top:100px;width:500px;font-size:24px"><span class="BRlineElement" style="line-height:30px"><span class="BRwordElement">Librarian</span> <span class="BRwordElement">goblins</span></span></p>';
  page.append(image, layer); document.querySelector('section').replaceChildren(page);
}
function navigate(index, activity = false) {
  if (activity) window.dispatchEvent(new CustomEvent('BookReader:userAction'));
  if (index === fixture.index || index < 0 || index > maximum) return;
  fixture.index = index; fixture.navigation.push(index);
  // Fallback scenario deliberately has no URL or slider index: the extension
  // must read the real page-created event object to observe completion.
  if (!fallback) {
    location.hash = 'page/n' + index;
    jQuery('.ui-slider-handle').attr('aria-valuenow', index);
    jQuery('.BRpager').data('swallowchange', true).slider('value', index);
  }
  document.querySelector('section').replaceChildren();
  window.dispatchEvent(new CustomEvent('BookReader:pageChanged', {detail:{props:{index}}}));
  if (!fixture.broken.includes(index)) setTimeout(() => { if (fixture.index === index) supply(index); }, 80);
}
document.querySelector('.onepg').onclick = () => {};
document.querySelector('.book_right').onclick = () => navigate(fixture.index + 1, true);
document.querySelector('.book_left').onclick = () => navigate(fixture.index - 1, true);
document.querySelector('ia-bookmarks-list').addEventListener('bookmarkSelected', event => {
  const index = event.detail.bookmark.leafNum;
  fixture.bookmarkEvents.push(index);
  navigate(index);
});
if (!fallback) {
  jQuery('.BRpager').on('slide', (_, ui) => jQuery('.ui-slider-handle').attr('aria-valuenow', ui.value));
  jQuery('.BRpager').on('slidechange', (event, ui) => {
    const rail = jQuery(event.target);
    if (rail.data('swallowchange')) rail.data('swallowchange', false);
    else navigate(ui.value);
  });
}
window.addEventListener('BookReader:userAction', () => fixture.activity++);
supply(0);
