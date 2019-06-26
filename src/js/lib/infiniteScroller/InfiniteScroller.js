import _ from 'lodash';
import Hammer from 'hammerjs';
import './style.css';

/**
 * Infinite Scroller Component
 * @param {*} config 
 */
function InfiniteScroller(config) {

    /**
     * Constants
     */
    const SCROLL_TRIGGER_HEIGHT = 400;
    const MAX_ITEM_CACHE = 30;
    const CLOSEST_ITEM_WRAPPER = 'article';
    const ATTR_DATA_ID = 'data-id';


    /**
     * Default Options for Infinite Scroller
     */
    let options = {
        container: null,
        url: null,
        data: null,
        threshold: 10,
    };

    /**
     * Combine default options and user options
     */
    options = {
        ...options,
        ...config
    };

    /**
     * Varibales used acroll component
     */
    let itemsWrapperEle, topLoaderEle, bottomLoaderEle, infiniteScrollEle;
    let debounceScrollCall = null;
    let dynamicHeightMap = {};
    let dismissedItems = {};
    let pageToken = (options.data !== null && options.data.pageToken !== null ? options.data.pageToken : null);
    let dataList = (options.data !== null && options.data.messages !== null ? options.data.messages : null);
    let container = document.querySelector(options.container);
    let itemCounter = 0;

    /**
     * Maintain page to token mapping
     * Pass pageId and map will return pageToken Needed to load that page
     */
    let pageTokenObj = {
        pageId: 0,
        pageToken: null,
    };
    let pageTokenMap = {}; // PageId -> PageToken Map


    /**
     * Store Dom References for later use
     */
    function collectDomReferences() {
        infiniteScrollEle = container.querySelector('.infiniteScrollerWrapper');
        itemsWrapperEle = container.querySelector('.itemsWrapper');
        topLoaderEle = container.querySelector('.topLoader');
        bottomLoaderEle = container.querySelector('.bottomLoader');
    }

    /**
     * Get PageTokenObject from the Map
     */
    function getPageTokenObjectFromMap(isForward = true) {
        const children = itemsWrapperEle.children;
        const len = children.length - 1;
        let child = null;
        let pageId = null;
        let pageToken = null;

        // reset pageTokenObj before setting new value
        pageTokenObj.pageId = 0;
        pageTokenObj.pageToken = null;

        if (len > 0) {
            if (isForward) {
                child = children[len];
                pageId = +child.dataset.pageid;
            } else {
                child = children[0];
                pageId = +child.dataset.pageid;
                pageId = pageId - 1;
            }
        }

        if (pageId !== null && pageId > 0 && pageTokenMap[pageId] !== null) {
            pageToken = pageTokenMap[pageId];
            // update pageTokenObject before making fetch call
            pageTokenObj.pageId = pageId;
            pageTokenObj.pageToken = pageToken;
        }

        return pageTokenObj;
    }

    /**
     * Fetch and Render Items only if valid token found
     * if scrolled all the way to top or bottom (if all data is loaded)
     * then we will not find valid pageToken
     * @param {*} isForward 
     */
    function fetchAndRender(isForward = true) {
        pageTokenObj = getPageTokenObjectFromMap(isForward);

        if (pageTokenObj && pageTokenObj.pageId !== null && pageTokenObj.pageId >= 0) {
            fetchMoreData(isForward).then((results) => {
                renderItems(results, isForward);
            });
        }
    }

    /**
     * On Scroll decides either to load next or load previous
     */
    function onScroll(e) {
        const target = e.target;
        const scrollTop = target.scrollTop;
        const clientHeight = target.clientHeight;
        const scrollHeight = target.scrollHeight;

        //TODO: what happens if user scrolls down, but scrolls up quickly, 
        // Check with PM: Ideally if one ajax call is in use, do not make another ajax call.
        // what happens if 2 ajax calls are going out, because of slow internet, race condition

        if (scrollHeight - scrollTop - clientHeight <= SCROLL_TRIGGER_HEIGHT) {
            console.log('load next 10');
            fetchAndRender(true);
        } else if (scrollTop <= SCROLL_TRIGGER_HEIGHT && pageTokenObj.pageId > 1) { //scrollTop <= 100
            // if isForward == false and pageId > 1, only then make ajax call
            console.log('load previous');
            fetchAndRender(false);
        }
    }

    /**
     * Handler to dismiss an Item. Calls scroll handler to trigger item fetch if needed
     * @param target
     */
    function dismissItem(target) {
        const itemId = target.getAttribute(ATTR_DATA_ID);
        target.classList.add('remove');
        dismissedItems[itemId] = true;
        setTimeout(function () {
            target.remove();
        }, 1000);

        // kick onScroll to see if fetch is needed
        onScroll({
            target: infiniteScrollEle
        }, true);
    }

    /**
     * Pan handler. Triggers dismissItem or snapsItem back to original position depending on drag offset
     * @param ev
     */
    function handlePan(ev) {
        var elem = ev.target.closest(CLOSEST_ITEM_WRAPPER);
        var posX = ev.deltaX;
        if (!elem) {
            return;
        }

        // move our element to that position
        elem.style.transform = `translateX(${posX}px)`;
        elem.classList.add('beingDragged');
        // DRAG COMPLETE
        // check if the deltaX is more than threshold
        if (ev.isFinal) {
            const dismissalPosX = elem.offsetWidth * 50 / 100;
            if (posX >= dismissalPosX) {
                dismissItem(elem);
            } else {
                elem.classList.add('snapBack');
                setTimeout(function () {
                    elem.classList.remove('snapBack');
                }, 1000);
                // if it did not hit the dismiss threshold.. move it back to original position
                elem.style.transform = `translateX(0)`;
            }

            elem.classList.remove('beingDragged');
        }
    }

    /**
     * Bind Events
     */
    function bindEvents() {
        infiniteScrollEle.addEventListener('scroll', debounceScrollCall);

        /**
         * Bind event to swipe right on message item.
         */
        var mc = new Hammer(itemsWrapperEle);
        mc.get('pan').set({
            direction: (!Hammer['SWIPE_DIRECTION'] ? Hammer.DIRECTION_RIGHT : Hammer[options.swipeDirection])
        });
        mc.on("pan", handlePan);
    }

    /**
     * Remove Events
     */
    function removeEvents() {
        infiniteScrollEle.removeEventListener('scroll', debounceScrollCall);
    }

    /**
     * Generate Initial Dom elements
     */
    function renderInitialDomWrapper() {
        const baseTemplate = `
            <section class="infiniteScrollerWrapper">
                <div class="topLoader"></div>
                <section class="itemsWrapper"></section>
                <div class="bottomLoader"></div>
            </section>
        `;

        container.innerHTML = baseTemplate;
        collectDomReferences(container);
    }

    function showLoader(isAfter = true) {
        if (isAfter) {
            bottomLoaderEle.classList.add("spinner");
        } else {
            topLoaderEle.classList.add("spinner");
        }
    }

    function hideLoader(isAfter = true) {
        if (isAfter) {
            bottomLoaderEle.classList.remove("spinner");
        } else {
            topLoaderEle.classList.remove("spinner");
        }
    }

    function fetchMoreData(isForward = true) {
        let url = options.url;
        if (pageToken) {
            url = `${options.url}?pageToken=${pageToken}`
        }

        /**
         * Show loading spinner
         */
        showLoader(isForward);
        return fetch(url).then((resp) => {
            return resp.json();
        }).catch((error) => {
            throw new error("error fetching data...");
        });
    }

    /**
     * Remove item nodes based on MAX ITEM ALLOWED CACHE
     * @param len
     * @param isForward
     * @returns {Array}
     */
    function cleanItemNodes(size, isForward = true) {
        let children = [...itemsWrapperEle.children];

        for (let i = 0; i < size; i++) {
            let node;
            if (itemCounter >= MAX_ITEM_CACHE) {
                if (isForward) {
                    // if forward load, remove child from top
                    node = children.shift();
                } else {
                    // if backward / top load, remove child from bottom
                    node = children.pop();
                }

                //TODO
                //FIXME
                // Instead of removing each child one by one and causing reflow, 
                // if we can wrap each page nodes in wrapper and remove the entire wrapper
                // it will increase performance and avoid reflows
                node.parentNode.removeChild(node);
            }

            itemCounter++;
        }
    }

    /**
     * On Successful fetch of data
     * Render Messages 
     */
    function renderItems(results, isForward = true) {
        const messages = results.messages;
        const pageToken = results.pageToken;
        const fragment = document.createDocumentFragment();

        // remove or clean nodes from dom
        cleanItemNodes(results.messages.length, isForward);

        // update pageTokenObj with newer data after fetch call.
        pageTokenObj.pageId = (isForward ? +pageTokenObj.pageId + 1 : +pageTokenObj.pageId);
        pageTokenObj.pageToken = pageToken;

        messages.forEach((message, index) => {
            // Render Dom based on template provided through the config
            const tpl = document.createElement('template');
            options.renderTemplate(tpl, message);
            if (tpl.content.children && tpl.content.children.length <= 0) {
                throw new Error("Unable to set page Id, please pass valid template");
            }
            tpl.content.children[0].setAttribute("data-pageId", pageTokenObj.pageId);
            fragment.appendChild(tpl.content);
        });

        if (isForward) {
            // append at the end
            itemsWrapperEle.appendChild(fragment);
        } else {
            // append at the top
            itemsWrapperEle.insertBefore(fragment, itemsWrapperEle.children[0]);
        }

        // hide loader after rendering is complete.
        // hideLoader(isForward);
    }


    /**
     * Initialize Infinite Scroller 
     * Initialize Dom
     * Initialize Events
     * Fetch Initial Data
     * Throw Error if required params missing
     */
    function init() {

        /**
         * Setup initial template
         */
        renderInitialDomWrapper();

        /**
         * Use Debounce to avoid multiple ajax calls being fired on scroll
         */
        debounceScrollCall = _.debounce(onScroll, 20);

        /**
         * we are adding scroll event on container,
         * if container does not have overflow = scroll property,
         * then below scroll event will not get triggered, 
         * because document level scroll will get triggered instead of container level.
         */
        infiniteScrollEle.style.overflowY = "scroll";
        bindEvents();

        /**
         * Load Initial data
         */
        fetchAndRender(true);
    }


    /**
     * DEFINING PUBLIC APIs ~~~~~~~~~~~~~~~~~~~~~~~~
     * 
     * 
     * Allowing Developers to remove Events when needed
     */
    this.destroy = function () {
        removeEvents();
    }


    /**
     * Initial Infinite Scroller
     */
    init();
}

export default InfiniteScroller;