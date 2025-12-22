let polls = {};	// List of all polls in the slideshow, indexed by their id

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
		return `<div class="interactive" id="${this.id}"><h1>${this.title}</h1><ul>` + this.options.map((el)=>`<li id="${el.id}">${el.value}</li>`).join("") + '</ul></div>';
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

	generatePresenterPage() {
		return `<h1>${this.title}</h1><div>` + this.options.map((el)=>`<div id="${el.id}">${el.value}</div><div></div>`).join("") + "</div>";
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
});

