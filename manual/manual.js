function create_toc() {
	let div=document.createElement('div');
	div.classList.add('outline');
	let title=document.createElement('h2');
	title.innerText='Sommaire';
	div.appendChild(title);
	let curelements=[div];
	let curlists=[];
	let rank=0;
	Array.from(document.body.childNodes).forEach(function(element) {
		if (element.tagName && element.tagName.length==2 && element.tagName[0].toUpperCase()=='H') {
			let newrank=parseInt(element.tagName[1])-1;
			if (newrank>=1) {
				for (;rank<newrank;++rank) {
					let ul=document.createElement('ul');
					if (rank<newrank-1) {
						let li=document.createElement('li');
						ul.appendChild(li);
						curelements[rank+1]=li;
					}
					curlists[rank]=ul;
					curelements[rank].appendChild(ul);
					rank=rank+1;
				}
				rank=newrank;
				let li=document.createElement('li');
				if (!element.id) element.id=encodeURI(element.innerHTML);
				li.innerHTML='<a href="#'+element.id+'">'+element.innerHTML+'</a>';
				curlists[rank-1].appendChild(li);
				curelements[rank]=li;
			}
		}
	});
	document.body.prepend(div);
}

document.addEventListener("DOMContentLoaded",function(event) {
	Prism.plugins.NormalizeWhitespace.setDefaults({
		'remove-trailing': false,
		'remove-indent': true,
		'left-trim': true,
		'right-trim': true
	});
	// Prepare description sections
	const classes={'dl.attributes':'Attributs','dl.components':'Éléments','div.example':'Exemples'};
	for (key in classes) {
		Array.from(document.querySelectorAll(key)).forEach(function(element) {
			let div=document.createElement('div');
			div.classList.add('documentation');
			let title=document.createElement('h1');
			title.innerText=classes[key];
			div.appendChild(title);
			element.classList.add('content');
			element.parentNode.insertBefore(div,element);
			div.appendChild(element);
		});
	}
	// Collapse description sections
	let coll=document.querySelectorAll('.documentation>h1');
	for (let i=0;i<coll.length;++i) {
		coll[i].addEventListener('click',function() {
			this.classList.toggle('active');
			let content=this.nextElementSibling;
			if (content.style.maxHeight) content.style.maxHeight=null; else content.style.maxHeight=content.scrollHeight+'px';
		});
	}
	// Create table of contents
	create_toc();
});
