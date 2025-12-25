var parameters = [];	// URL arguments

function to_wait_mode() {
	document.body.innerHTML = '<img src="waiting.svg" style="width:100%; height:100%"/>';
}

function gen_interaction() {
	let comp = document.getElementsByClassName("interactive")[0];
	if (comp.classList.contains("rt-election")) {
		for (let opt of comp.querySelectorAll("li")) {
			opt.addEventListener("click", function(event){
				let xhttp = new XMLHttpRequest();
				xhttp.open("POST", location.protocol + "//" + location.host + location.pathname, false);
				xhttp.onreadystatechange = function() {
					if (this.readyState == XMLHttpRequest.DONE && this.status == 200) to_wait_mode();
				}
				xhttp.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
				xhttp.send("submit=" + parameters["wait"] + "&poll=" + this.closest(".interactive").id + "&answer=" + this.id);
			});
		}
	} else if (comp.classList.contains("rt-rating")) {
		let starListener = function(event) {
			let inf = true;
			for (let span of event.target.parentNode.childNodes) {
				if (inf) span.classList.add("lighted"); else span.classList.remove("lighted");
				if (span == event.target) inf = false;
			}
		};
		for (let rate of comp.querySelectorAll("span")) rate.addEventListener("click", starListener);
		comp.querySelector("button").addEventListener("click", function(event) {
			let xhttp = new XMLHttpRequest();
			xhttp.open("POST", location.protocol + "//" + location.host + location.pathname, false);
			xhttp.onreadystatechange = function() {
				if (this.readyState == XMLHttpRequest.DONE && this.status == 200) to_wait_mode();
			}
			xhttp.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
			let stars = this.previousSibling.querySelectorAll('.lighted').length;
			xhttp.send("submit=" + parameters["wait"] + "&poll=" + this.closest(".interactive").id + "&answer=" + stars);
		});
	}
}

document.addEventListener("DOMContentLoaded",function(event) {
	// Read query string
	let querys=decodeURI(location.search.substring(1)).split('&');
	for (let i=0;i<querys.length;++i) {
		let varval=querys[i].split('=');
		parameters[varval[0]]=varval[1];
	}
	// Subscribe to event source for new questions
	const evtSource = new EventSource(`slides.php?subscribe=${parameters['wait']}`);
	window.addEventListener('beforeunload', () => { evtSource.close(); });
	evtSource.onmessage = function(event) {
		document.body.innerHTML = event.data;
		gen_interaction();
	};
	// Go to waiting mode
	to_wait_mode();
});

