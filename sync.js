var parameters = [];	// URL arguments
let interaction_generators = {
	"rt-election": gen_interaction_election,
	"rt-selection": gen_interaction_selection,
	"rt-rating": gen_interaction_rating,
	"rt-ranking": gen_interaction_ranking
};
let temp_disable = false;	// Used to temporarily disable an event listener

function to_wait_mode() {
	document.body.innerHTML = '<img src="waiting.svg" style="width:100%; height:100%"/>';
}

function gen_interaction_election(comp) {
	for (let opt of comp.querySelectorAll("li")) {
		opt.addEventListener("click", function(event){
			let xhttp = new XMLHttpRequest();
			xhttp.open("POST", location.protocol + "//" + location.host + location.pathname, false);
			xhttp.onreadystatechange = function() {
				if (this.readyState == XMLHttpRequest.DONE && this.status == 200) to_wait_mode();
			}
			xhttp.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
			xhttp.send("submit=" + parameters["wait"] + "&poll=" + this.closest(".interactive").id + "&answers=" + encodeURIComponent("{\"" + this.id + "\":1}"));
		});
	}
}

function gen_interaction_selection(comp) {
	comp.querySelectorAll("li").forEach((opt)=>{opt.addEventListener('click', (ev) => {ev.target.classList.toggle('active');});});
	comp.querySelector("button").addEventListener("click", function(event){
		let xhttp = new XMLHttpRequest();
		xhttp.open("POST", location.protocol + "//" + location.host + location.pathname, false);
		xhttp.onreadystatechange = function() {
			if (this.readyState == XMLHttpRequest.DONE && this.status == 200) to_wait_mode();
		}
		xhttp.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
		xhttp.send("submit=" + parameters["wait"] + "&poll=" + this.closest(".interactive").id + "&answers=" + encodeURIComponent('{' + Array.from(comp.querySelectorAll('li.active')).map((opt)=>'"' + opt.id + '":1').join(',') + '}'));
	});
}

function gen_interaction_rating(comp) {
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
		xhttp.send("submit=" + parameters["wait"] + "&poll=" + this.closest(".interactive").id + "&answers=" + encodeURIComponent("{\"stars-" + stars + "\":1}"));
	});
}

function gen_interaction_ranking(comp) {
	let ul = comp.getElementsByTagName('ul')[0];
	for (let opt of ul.childNodes) {
		if (!opt.classList.contains("fake")) opt.addEventListener("dragstart", function (event) {
			if (event.target.tagName == "LI") {
				event.dataTransfer.setData("text/plain", opt.id);
			}
		});
		opt.addEventListener("dragover", function(event) {
			let cur = document.getElementById(event.dataTransfer.getData("text/plain"));
			if (event.target == cur) return;
			event.dataTransfer.dropEffect = "move";
			event.preventDefault();
		});
		opt.addEventListener("dragenter", function(event) {
			let cur = document.getElementById(event.dataTransfer.getData("text/plain"));
			if (event.target == cur) return;
			event.dataTransfer.dropEffect = "move";
			event.preventDefault();
			/*if (temp_disable) return;
			let clone = ul.querySelector("li.fake-clone");
			if (clone) {
				temp_disable = true;
				ul.insertBefore(clone, event.target);
				setTimeout(()=>{temp_disable = false}, 500);	
			} else {
				let newli = cur.cloneNode(true);
				newli.classList.add("fake-clone");
				newli.addEventListener("dragover", function(ev) {
					ev.dataTransfer.dropEffect = "move";
					ev.preventDefault();
				});
				ul.insertBefore(newli, event.target);
			}*/
		});
		opt.addEventListener("drop", function(event) {
			let cur = document.getElementById(event.dataTransfer.getData("text/plain"));
			if (event.target == cur) return;
			event.preventDefault();
			/*let clone = ul.querySelector("li.fake-clone");
			if (clone) ul.replaceChild(cur, clone);*/
			let curIndex = Array.from(ul.childNodes).indexOf(cur);
			let nowIndex = Array.from(ul.childNodes).indexOf(event.target);
			if (curIndex > nowIndex) ul.insertBefore(cur, event.target);
			else if (curIndex < nowIndex) ul.insertBefore(cur, event.target.nextSibling);
		});
		opt.addEventListener("dragend", function(event) {
			for (let li of ul.querySelectorAll("li.fake-clone")) ul.removeChild(li);
		});
	}
	comp.querySelector("button").addEventListener("click", function(event){
		let xhttp = new XMLHttpRequest();
		xhttp.open("POST", location.protocol + "//" + location.host + location.pathname, false);
		xhttp.onreadystatechange = function() {
			if (this.readyState == XMLHttpRequest.DONE && this.status == 200) to_wait_mode();
		}
		xhttp.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
		let scores = {};
		let points = 0;
		let ul = comp.getElementsByTagName("ul")[0];
		for (const opt of ul.childNodes) scores[opt.id] = points++;
		for (const opt of ul.childNodes) scores[opt.id] = points - 1 - scores[opt.id];
		xhttp.send("submit=" + parameters["wait"] + "&poll=" + this.closest(".interactive").id + "&answers=" + encodeURIComponent(JSON.stringify(scores)));
	});
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
		let comp = document.getElementsByClassName("interactive")[0];
		for (const [type, generator] of Object.entries(interaction_generators)) {
			if (comp.classList.contains(type)) {
				generator(comp);
				break;
			}
		}
	};
	// Go to waiting mode
	to_wait_mode();
});

