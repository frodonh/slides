/*************************************
 *    Answering pages generation     *
 *************************************/
/** Generate a web page for a poll answering client based on slideshow interactive component
 *
 * @param {object} element - Element which will be used to generate the answering page. This should be a div with a 'interactive' class
 * @returns {string} HTML content of the page
 */
function generatePollPage(element) {
	if (element.classList.contains("rt-election")) {
		return element.outerHTML;
	}
}

/*************************************
 *         Starting script           *
 *************************************/
document.addEventListener("DOMContentLoaded",function(event) {
	// Give IDs to interactive components which do not have one
	let num = 0;
	for (let comp of document.getElementsByClassName("interactive")) {
		++num;
		if (!comp.id) comp.id = "interactive-" + num;
		let numb = 0;
		for (let opt of comp.getElementsByTagName("li")) {
			++numb;
			if (!opt.id) opt.id = comp.id + "-" + numb;	
		}
	}
});

