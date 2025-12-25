let polls = {};	// List of all polls in the slideshow, indexed by their id
let sse_listener = null;	// Event source listener for polls

/**
 * Generic poll class, base for other poll objects
 */
class Poll {
	constructor(id, type, element) {
		this.id = id;
		this.type = type;
		this.element = element;
		this.title = element.getElementsByTagName('h1')[0].innerHTML;
		this.options = [];
	}

	/** Generate the code for the participant page
	 *
	 * @returns {string} HTML for the poll client
	 */
	generateParticipantPage() {
		return element.outerHTML;
	}

	/** Generate the code for the presenter page
	 *
	 * @returns {string} HTML for the poll client
	 */
	generatePresenterPage() {
		return element.innerHTML;
	}

	/** Generate a Poll object based on a HTML DOM element
	 *
	 * @param {object} element - HTML DOM Element. This should be a div with the 'interactive' class, and another class giving the type of the poll
	 * @returns {object} Poll object
	 */
	static create(id, element) {
		if (element.classList.contains("rt-election")) return new PollElection(id, element);
		if (element.classList.contains("rt-rating")) return new PollRating(id, element);
	}
}

/*************************************
 *          Election poll            *
 *************************************/
/**
 * Election poll: the user can vote for a single option amongst several possibilities.
 */
class PollElection extends Poll {
	constructor(id, element) {
		super(id, 'election', element);
		let onum = 1;
		this.options = Array.from(element.getElementsByTagName('li')).map((el)=>({id: (el.id)?el.id:(id+"-"+(onum++)), value: el.innerHTML}));
	}

	generateParticipantPage() {
		return `<div class="interactive rt-election" id="${this.id}"><h1>${this.title}</h1><ul>` + this.options.map((el)=>`<li id="${el.id}">${el.value}</li>`).join("") + '</ul></div>';
	}

	generatePresenterPage() {
		return `<h1>${this.title}</h1><div>` + this.options.map((el)=>`<div id="${el.id}">${el.value}</div><div></div>`).join("") + "</div>";
	}

	update(data) {
		delete data.number;
		const max = Object.entries(data).reduce((acc, cur)=>(cur[1]>acc?cur[1]:acc), 0);
		for (const [key,value] of Object.entries(data)) {
			let div = document.getElementById(key).nextSibling ;
			div.style.marginRight = (100 - value / max * 100) + "%";
			div.innerHTML = "<div>" + value + "</div>";
		}
	}
}

/*************************************
 *           Rating poll             *
 *************************************/
/**
 * Rating poll: the user can choose a rating on a scale
 */
class PollRating extends Poll {
	constructor(id, element) {
		super(id, 'rating', element);
		this.max = parseInt(element.dataset["max"]);
	}

	generateParticipantPage() {
		return `<div class="interactive rt-rating" id="${this.id}"><h1>${this.title}</h1><div>` + '<span></span>'.repeat(this.max) + `</div><button type="button">OK</button></div>`;
	}

	generatePresenterPage() {
		return `<h1>${this.title}</h1><div style="grid-template-columns: repeat(${this.max+1}, 1fr)" >` + '<div class="bar"><div></div></div>'.repeat(this.max+1) + Array(this.max+1).fill().map((_, index)=>`<div class="legend">${index}</div>`).join('') + '</div>';
	}

	update(data) {
		delete data.number;
		const max = Object.entries(data).reduce((acc, cur)=>(cur[1]>acc?cur[1]:acc), 0);
		let grid = document.getElementById(this.id).getElementsByTagName('div')[0];
		for (const [key,value] of Object.entries(data)) {
			let div = grid.childNodes[parseInt(key.substring(6))].getElementsByTagName('div')[0];
			div.style.top = (100 - value / max * 100) + "%";
			div.innerHTML = "<div>" + value + "</div>";
		}
	}
}

/*************************************
 *         Starting script           *
 *************************************/
document.addEventListener("DOMContentLoaded",function(event) {
	// Save all polls and replace their contents
	let num = 0;
	for (let el of document.getElementsByClassName('interactive')) {
		let id;
		if (el.id) id = el.id; else {
			id = "poll-" + (++num);
			el.id = id;
		}
		let p = Poll.create(id, el);
		polls[id] = p;
		el.innerHTML = p.generatePresenterPage();
	}

	// Close the event source when the user disconnects
	window.addEventListener('beforeunload', () => { if (sse_listener) sse_listener.close(); });

	// Register a new event listener to start listening for answers on slides with polls
	window.addEventListener('hashchange', function() {
		let curslideo = getSlide(curslide);
		if (sse_listener) sse_listener.close();
		let els = curslideo.getElementsByClassName("interactive");
		if (els.length > 0) {
			let id = els[0].id;
			sse_listener = new EventSource(syncConfig.url + '?follow=' + encodeURIComponent(syncConfig.name) + '&poll=' + encodeURIComponent(id));
			sse_listener.onmessage = function(e) {
				polls[id].update(JSON.parse(e.data));
			};
		}
	});
});

