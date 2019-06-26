import InfiniteScroller from './js/lib/infiniteScroller/InfiniteScroller';
import moment from 'moment';
import './css/style.css';

const BASE_URL = 'https://message-list.appspot.com';
const SWIPE_DIRECTION = "DIRECTION_RIGHT";

/**
 * Callback method to render any template based on Data
 * @param {*} el 
 * @param {*} obj 
 */
function renderTemplateCallback(el, obj) {
    const template = `
        <article class="item" data-id="item-${obj.id}">
        <section class="author-details">
            <figure class="author-image">
            <img src="http://message-list.appspot.com${obj.author.photoUrl}" alt="Profile image of ${obj.author.name}">
            </figure>
            <section class="author-info">
            <strong>${obj.author.name}</strong>
            <time>`+ moment(obj.updated).fromNow() +`</time>
            </section>
        </section>
        <section class="author-message">
            ${obj.content}
        </section>
        </article>
    `;

    el.innerHTML = template;
}

/**
 * Initialise Infinite Scroller
 */
const scroll = new InfiniteScroller({
    container: '#message_list_1',   // root element
    url: `${BASE_URL}/messages`,
    renderTemplate: renderTemplateCallback, // developer can implemente any template they need
    swipeDirection: SWIPE_DIRECTION, // left or right ( // TODO: more tough gestures can be configurable )
});

// Future configs 
// data: {},   // can it be implemented for static data, without fetching data
// batch_size: 10,
// isRTL: false, // RTL language support

export default scroll;