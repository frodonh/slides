/** Array of slides together with their characteristics
 *	Each element of the slide is an object with the following members:
 *	<dl>
 *		<dt>id</dt><dd>id of the slide</dd>
 *		<dt>background</dt><dd>URL of background image, an empty string if there is no background</dd>
 *		<dt>animation</dt><dd>Name of the animation used when the slide is displayed (either a function name or a part of a CSS class name)</dd>
 *		<dt>navigation</dt><dd>True if the navigation bar has to be displayed. By default, it is true for all slides except for title slide.</dd>
 *		<dt>footer</dt><dd>True if the footer has to be displayed. By default, it is true for all slides except for title slide.</dd>
 *		<dt>numfragments</dt><dd>Number of fragments in the slide</dd>
 *		<dt>groups</dt><dd>Array of groups the slide belongs to</dd>
 *	</dl>
 *	Additionnally, it may hold the following members:
 *	<dl>
 *		<dt>section</dt><dd>Name of the section, when the slide starts a new section</dd>
 *		<dt>ssection</dt><dd>Short name of the section, when the slide starts a new section</dd>
 *		<dt>subsection</dt><dd>Name of the subsection, when the slide starts a new subsection</dd>
 *	</dl>
 */
var slides=[];
/** Current slide number, relative to the slides array, 0 is first slide */
var curslide=0;
/** Current fragment number, 0 is first fragment */
var curfragment=0;
/** Tell if a hash change event is managed by the script or not */
var program_hashchange=false;
/** Url of the current background */
var background_url=null;
/** Tell if the user is browsing the overview */
var on_overview=false;
/** Current slide number on overview, relative to the slides array */
var overview_curslide;
/** Id of the notes window, null if not displayed */
var wnotes=null;
/** Tell if the sync QR-code is displayed */
var on_qrcode=false;
/** Touch event starting point x coordinate */
var xDown=null;
/** Touch event starting point y coordinate */
var yDown=null;
/** URL used for synchronization */
var syncUrl=null;
/** Name used for synchronization */
var syncName=null;
/** Slave mode */
var slaveMode=false;
/** Outline stylesheet activated */
var outlinestyle=false;
/** Array of slideshow parameters. */
var parameters=[];

/**
 * Compare string values in a case-insensitive manner. Also works when one string is undefined.
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns True if both strings exist and are equal
 */
function compare(a,b) {
	return (a && b && a.toUpperCase()==b.toUpperCase());
}

/**
 * Look for the first object in the {@link slides} variable that stands for the slide with the given id
 * @param {string} Id - Id (DOM) of the searched slide
 * @returns First member of the {@link slides} variable matching the id
 */
function getSlideElement(slideid) {
	return slides.find(element => element['id']==slideid);
}

/**
 * Get the DOM element associated with the given index of the {@link slides} array
 * @param {number} num - Index in the array
 * @returns DOM element for the slide
 */
function getSlide(num) {
	return document.getElementById(slides[num]['id']);
}

/**
 * Look for the index of the first object in the {@link slides} variable that stands for the slide with the given id
 * @param {number} slideid - Id of the slide
 * @returns Index of the first member of the {@link slides} variable matching the id
 */
function getSlideIndex(slideid) {
	return slides.findIndex(element => element['id']==slideid);
}

/**
 * If the argument is a valid JSON string, this function returns the corresponding Javascript object. Otherwise it returns a string.
 * @param {string} arg - String argument, either a JSON value or any string
 * @returns Javascript object obtained by parsing the JSON string, or same string as argument if it is not a valid JSON string
 */
function from_string(arg) {
	let a;
	try {
		a=JSON.parse(arg);
	} catch(e) {
		a=arg;
	}
	return a;
}

/**********************************
 *       Utility functions        *
 **********************************/
function getDate() {
	let elem=document.getElementById("title").getElementsByTagName('time')[0];
	if (elem.innerHTML!='') return;
	let d=new Date().toLocaleDateString(document.documentElement.lang,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
	elem.innerHTML=d[0].toUpperCase()+d.slice(1);
}

/**********************************
 *      Background functions      *
 **********************************/
/**
 * Change background image to a new one applying a smooth transition between them
 * @param {object} back - Either a string, which stands for the url of the new background, or a Javascript array of strings, in which case the background in randomly chosen among the array.
 */
function switch_background(back) {
	let url;
	if (typeof back==='string' || back instanceof String) url=back; else url=back[Math.floor(Math.random()*back.length)];
	if (url==background_url && !url.endsWith('php')) return;
	let oldbg=document.getElementById('background');
	let newbg=document.getElementById('newbackground');
	if (url && url!='') newbg.style.backgroundImage='url('+url+')'; else newbg.style.backgroundImage='none';
	oldbg.style.opacity='0';
	newbg.addEventListener('transitionend',function(event) {
		oldbg.style.backgroundImage=newbg.style.backgroundImage;
		oldbg.style.transition='none';
		newbg.style.transition='none';
		background_url=url;
		setTimeout(function() {
			oldbg.style.opacity='1';
			newbg.style.opacity='0';
			setTimeout(function() {
				oldbg.style.transition='opacity 1s ease';
				newbg.style.transition='opacity 1s ease';
			},20);
		},20);
	},{capture:false,once:true});
	setTimeout(function() {
		newbg.style.opacity='1';
	},20);
}

/**********************************
 *       Fragment functions       *
 **********************************/
/**
 * Test if the fragment num is included in the fragspec.
 * @param {string} fragspec - A string which specifies the fragments indexes for which the slide should be displayed. It is a sequence of elementary fragment specifications separated by commas. An elementary fragment sequence is either an individual index (number), either an interval (number-number).<br/>Example : "1,4-7,12".
 * @returns {boolean} True if the fragment with index num is included in the fragspec, false otherwise.
 */
function test_frag(fragspec,num) {
	let reg=/(?:^|,)(\d*)(?:-(\d*))?/g;
	let frag;
	while ((frag=reg.exec(fragspec))!==null) {
		let first=frag[1]=='' ? 0 : parseInt(frag[1]);
		let last=(typeof (frag[2])!=='undefined') ? (frag[2]=='' ? 10000 : parseInt(frag[2])) : first;
		if (num>=first && num<=last) return true;
	}
	return false;
}

/**
 * Toggle the starting styles to all the fragments of the slide. The starting style is given by adding the classes read from the <tt>data-fstart</tt> attribute.
 * @param {object} slide - DOM element for the slide
 * @param {boolean} on - If true, starting styles are applied. If false, they are removed
 */
function apply_start_fragments(slide,on) {
	Array.from(slide.querySelectorAll('[data-fstart]')).forEach(function(element) {
		let classes=JSON.parse(element.dataset["fstart"]);
		for (let cl of classes) if (on) element.classList.add(cl); else element.classList.remove(cl);
	});
}

/**
 * Apply a class to the objects of a slide according to whether their fragspec includes or not the fragment with index num.
 * If num is in the fragspec of the object, the matching class is added to the object. Otherwise, it is removed.
 * @param {object} slide - DOM element for the slide
 * @param {num} num - Fragment number
 */
function reset_fragments(slide,num) {
	Array.from(slide.querySelectorAll('[data-fragment]')).forEach(function(element) {
		let fragspec=JSON.parse(element.dataset["fragment"]);
		Object.getOwnPropertyNames(fragspec).forEach(function(fraglist) {
			if (fragspec[fraglist]!=null) {
				if (test_frag(fraglist,num)) {
					fragspec[fraglist].forEach(function(val) {
						element.classList.add(val);
					});
				} else {
					fragspec[fraglist].forEach(function(val) {
						element.classList.remove(val);
					});
				}
			}
		});
	}); 
}

/**
 * Animation for a fragment: this function only makes the fragment visible or not.
 * @param {object} element - DOM element to animate
 * @param {boolean} incoming - Direction of the animation
 */
function fragment_none(element,incoming) {
	if (incoming) element.style.visibility='visible'; else element.style.visibility='hidden';
}

/**
 * Animation for a fragment: this function starts the CSS animation for the fragment. It does so by cloning the object, putting it on the page and removing the old object.
 * @param {object} element - DOM element to animate
 * @param {boolean} incoming - Direction of the animation, not used
 */
function fragment_cssanim(element,incoming) {
	if (incoming) {
		let newelement=element.cloneNode(true);
		element.parentNode.replaceChild(newelement,element);
	}
}

/**
 * Apply an animation to a fragment. The animation function is read in the <tt>data-fanim</tt> attribute of the object.
 * @param {number} slidenum - Index of the slide in the {@link slides} array
 * @param {number} fragmentnum - Index of the fragment to animate
 * @param {boolean} incoming - Direction of the animation
 */
function animate_fragment(slidenum,fragmentnum,incoming) {
	Array.from(getSlide(slidenum).querySelectorAll('[data-fanim]')).forEach(function(element) {
		let fragspec=JSON.parse(element.dataset['fanim']);
		Object.getOwnPropertyNames(fragspec).forEach(function(fraglist) {
			if (test_frag(fraglist,fragmentnum)) {
				let fname=fragspec[fraglist];
				if (fname) window[fname](element,incoming);
			}
		});
	});
}

/**********************************
 *       Animation functions      *
 **********************************/
/**
 * Animation for a transition between two slides: this function only makes the new slide appear over the old one.
 * @param {object} source - DOM object for the old slide
 * @param {object} dest - DOM object for the new slide
 * @param {boolean} increasing - Direction of the animation
 * @param {function} callback - Callback function called when the animation ends
 */
function animate_none(source,dest,increasing,callback) {
	source.style.visibility=null;
	if (source.dataset["onhide"]) window[source.dataset["onhide"]](source);
	dest.style.visibility='visible';
	if (dest.dataset["onshow"]) window[dest.dataset["onshow"]](dest);
	program_hashchange=true;
	location.hash="#"+dest.id;
	dest.style.visibility=null;
	callback();
}

/**
 * Animation for a transition between two slides: this function applies CSS transitions.
 * The transition is applied by adding and removing classes to the slide, with names like 'anim-sweep-from', 'anim-sweep-to', 'anim-sweep-transitions' where 'sweep' is the name read from the name argument.
 * @param {object} source - DOM object for the old slide
 * @param {object} dest - DOM object for the new slide
 * @param {boolean} increasing - Direction of the animation
 * @param {function} callback - Callback function called when the animation ends
 * @param {string} name - Name of the animation
 */
function animate_css(source,dest,increasing,callback,name) {
	dest.classList.add(increasing ? ('anim-'+name+'-from') : ('anim-'+name+'-to'));
	// Timeouts are needed, otherwise the browser changes the order of the events
	setTimeout(function() {
		source.classList.add('anim-'+name+'-transitions');
		dest.classList.add('anim-'+name+'-transitions');
		let destfinish=false;
		let sourcefinish=false;
		// Callbacks at end of animations
		function destend(event) {
			//console.log('destend : destfinish='+destfinish+' source='+source.id+' dest='+dest.id);
			if (destfinish) return;
			destfinish=true;
			dest.removeEventListener('transitionend',destend);
			dest.classList.remove('anim-'+name+'-transitions');
			if (dest.dataset["onshow"]) window[dest.dataset["onshow"]](dest);
			program_hashchange=true;
			location.hash="#"+dest.id;
			dest.style.visibility=null;
			callback();
		}
		function sourceend(event) {
			//console.log('sourceend : sourcefinish='+sourcefinish+' source='+source.id+' dest='+dest.id);
			if (sourcefinish) return;
			sourcefinish=true;
			source.removeEventListener('transitionend',sourceend);
			source.classList.remove('anim-'+name+'-transitions');
			if (source.dataset["onhide"]) window[source.dataset["onhide"]](source);
			source.style.visibility=null;
			source.classList.remove(increasing ? ('anim-'+name+'-to') : ('anim-'+name+'-from'));
		}
		setTimeout(function() {
			// Set callbacks
			// Animation
			source.addEventListener("transitionend",sourceend);
			dest.addEventListener("transitionend",destend);
			setTimeout(function() {
				//console.log('animate : source='+source.id+' dest='+dest.id);
				dest.style.visibility='visible';
				source.classList.add(increasing ? ('anim-'+name+'-to') : ('anim-'+name+'-from'));
				dest.classList.remove(increasing ? ('anim-'+name+'-from') : ('anim-'+name+'-to'));
				setTimeout(function() {
					destend();
					sourceend();
				},1200);
			},20);
		},20);
	},20);
}

/**
 * Apply an animation to make a new slide appear over an old one. The animation is read from the <tt>data-animation</tt> attribute of the slide.
 * First a function name animate_name is searched in the global scope. If none is found, the function tries to animate the transition with the {@link animate_css} function, using the <tt>data-animation</tt> attribute as the name of the CSS animation.
 * @param {object} source - DOM object for the old slide
 * @param {object} dest - DOM object for the new slide
 * @param {boolean} increasing - Direction of the animation
 * @param {function} callback - Callback function called when the animation ends
 */
function apply_animation(source,dest,increasing,callback) {
	let fn=null;
	let name;
	let destid=getSlideIndex(dest.id);
	if (slides[destid]["animation"] && slides[destid]['animation']!='') {
		fn=window[slides[destid]["animation"]];
		if (!fn) {
			name=slides[destid]["animation"];
			fn=animate_css;
		} 
	} else fn=animate_none;
	if (dest.id==source.id) fn=animate_none;
	fn(source,dest,increasing,callback,name);
}

/**********************************
 *         Navigation bar         *
 **********************************/
/**
 * Add a navigation bar on top of all slides and populate it with sections and subsections as read from the presentation.
 * A new section is started by a slide with a <tt>data-section</tt> attribute. This attribute stands for the title of the new section.
 * A <tt>data-ssection</tt> attribute may be added to provide a short name for the title of the section. In that case, the short title is used in the navigation bar.
 * A new section is started by a slide with a <tt>data-subsection</tt> attribute. This attribute stands for the title of the new subsection.
 */
function add_navigation_bar() {
	let nav=document.createElement('nav');
	nav.setAttribute('id','minitoc');
	document.body.insertAdjacentElement('afterbegin',nav);
	let csection=null;
	let csubsection=null;
	for (let slide of slides) if (slide['id']!='outline') {
		if (slide['section']) {
			let sname=slide['ssection'] ? slide['ssection'] : slide['section'];
			let newsection=document.createElement('div');
			newsection.classList.add('section');
			newsection.dataset['section']=slide['section'];
			newsection.innerHTML='<div class="title">'+sname+'</div>';
			csection=document.createElement('ul');
			csection.classList.add('slides');
			newsection.insertAdjacentElement('beforeend',csection);
			nav.insertAdjacentElement('beforeend',newsection);
			csubsection=null;
		}
		if (slide['subsection']) {
			let cli=document.createElement('li');
			csubsection=document.createElement('ul');
			csubsection.dataset['subsection']=slide['subsection'];
			cli.insertAdjacentElement('afterbegin',csubsection);
			csection.insertAdjacentElement('beforeend',cli);
		}
		if (csubsection) csubsection.insertAdjacentHTML('beforeend','<li><a href="#'+slide['id']+'">&#x25cb;</a></li>');
		else if (csection) csection.insertAdjacentHTML('beforeend','<li><a href="#'+slide['id']+'">&#x25cb;</a></li>');
	};
}

/**
 * Update the navigation bar: the new slide is represented by a filled circle, the old slide is reverted to its original state. The section and subsection of the new slide also get new styles by adding the <tt>currentSection</tt> and <tt>currentSubsection</tt> classes to them.
 * @param {number} newslidenum - New slide index, relative to the {@link slides} array
 * @param {number} oldslidenum - Old slide index, relative to the {@link slides} array
 */
function update_navigation_bar(newslidenum,oldslidenum) {
	let link;
	let minitoc=document.getElementById('minitoc');
	Array.from(minitoc.getElementsByClassName('section')).forEach(element => element.classList.remove('currentSection'));
	Array.from(minitoc.getElementsByTagName('ul')).forEach(element => element.classList.remove('currentSubsection'));
	if (oldslidenum) {
		Array.from(minitoc.querySelectorAll('[href="#'+slides[oldslidenum]['id']+'"]')).forEach(element => element.innerHTML='&#x25cb;');
	}
	if (slides[newslidenum]['navigation']===true) {
		minitoc.style.opacity='1';
		if (slides[newslidenum]['id']=="outline") {
			Array.from(minitoc.querySelectorAll('div[data-section="'+slides[newslidenum]['section']+'"]')).forEach(element => element.classList.add('currentSection'));
		} else {
			Array.from(minitoc.querySelectorAll('[href="#'+slides[newslidenum]['id']+'"]')).forEach(function(element) {
				element.innerHTML='&#x25cf;';
				let subsection=element.closest('ul');
				if (subsection) subsection.classList.add('currentSubsection');
				let section=element.closest('.section');
				if (section) section.classList.add('currentSection');
			});
		}
	} else minitoc.style.opacity='0';
}

/**********************************
 *             Footer             *
 **********************************/
/**
 * Add a footer to the presentation
 */
function add_footer() {
	let footer=document.createElement('footer');
	footer.setAttribute('id','footer');
	let titles=document.getElementById('title');
	let title=titles.getElementsByTagName('h1')[0].innerHTML;
	let i=title.indexOf('<');
	if (i>=0) title=title.substring(0,i);
	footer.innerHTML='<div>'+titles.getElementsByTagName('time')[0].innerHTML+'</div><div>'+title.trim()+'</div><div></div>';
	document.body.insertAdjacentElement('afterbegin',footer);
}

/**
 * Update the footer when a new slide is displayed. The function change the page index in the footer
 * @param {number} newslidenum - New slide index, relative to the {@link slides} array
 */
function update_footer(newslidenum) {
	let footer=document.getElementById('footer');
	if (slides[newslidenum]['footer']===true) {
		footer.style.display='';
		footer.querySelector('div:last-child').innerHTML=newslidenum+'/'+(slides.length-1);
	} else footer.style.display='none';
}

/**********************************
 *         Outline slides         *
 **********************************/
/**
 * Compose an outline slide. The same outline slide, with id <tt>outline</tt> is used for the whole presentation. This function populates it with the names of sections and subsections.
 * @see {@link add_navigation_bar} for additional information about how new sections and subsections are declared.
 */
function compose_outline_slide() {
	let outlineslide=document.getElementById('outline');
	if (!outlineslide) return;
	let outline=outlineslide.getElementsByClassName('content')[0];
	let content=document.createElement('ul');
	outline.insertAdjacentElement('afterbegin',content);
	let csection=null;
	let csubsection=null;
	for (let slide of slides) if (slide['id']!='outline') {
		if (slide['section']) {
			let sname=slide['section'];
			csection=document.createElement('li');
			csection.dataset['section']=sname;
			csection.innerHTML='<a href="#'+slide['id']+'">'+sname+'</a>';
			content.insertAdjacentElement('beforeend',csection);
			csubsection=null;
		}
		if (slide['subsection']) {
			if (!csubsection) {
				csubsection=document.createElement('ul');
				csection.insertAdjacentElement('beforeend',csubsection);
			}
			csubsection.insertAdjacentHTML('beforeend','<li><a href="#'+slide['id']+'">'+slide['subsection']+'</a></li>');
		}
	}
}

/**
 * Update the outline slide based on the position in the presentation. The function highlights the current section in the outline slide.
 * @param {number} slidenum - Current slide index, relative to the {@link slides} array
 */
function update_outline_slide(slidenum) {
	let outlineslide=document.getElementById('outline');
	if (!outlineslide) return;
	if (slides[slidenum]['section']=="") {
		Array.from(outlineslide.querySelectorAll('[data-section]')).forEach(function(element) {
			element.classList.remove('currentSection');
			element.classList.remove('notCurrentSection');
		});
	}
	else {
		Array.from(outlineslide.querySelectorAll('[data-section]')).forEach(function(element) {
			element.classList.remove('currentSection');
			element.classList.add('notCurrentSection');
		});
		Array.from(outlineslide.querySelectorAll('[data-section="'+slides[slidenum]['section']+'"]')).forEach(function(element) {
			element.classList.add('currentSection');
			element.classList.remove('notCurrentSection');
		});
	}
}

/**********************************
 *        Printing management     *
 **********************************/
/**
 * Make thumbnails out of the slides. The function scales all slides, displays their final fragments, and places them of a flexbox div.
 */
function open_print_view() {
	// Wrap all slides in new divs to put them in a flexbox layout, and make them thumbnails
	for (let slide of slides) {
		let element=document.getElementById(slide['id']);
		if (element.classList.contains('thumbnail')) continue;
		element.classList.add('thumbnail');
		reset_fragments(element,slide['numfragments']);
		let wrapper=document.createElement('div');
		wrapper.classList.add('wthumb');
		element.parentNode.appendChild(wrapper);
		wrapper.appendChild(element);
	}
	let nwrapper=document.createElement('div');
	nwrapper.id='thumblayer';
	let firstdiv=document.querySelector('body div.wthumb');
	firstdiv.parentNode.insertBefore(nwrapper,firstdiv);
	document.querySelectorAll('body div.wthumb').forEach(function(element) {
		nwrapper.appendChild(element);
	});
	// Remove outline slide if visible
	if (slides[curslide]['id']=='outline') getSlide(curslide).style.display='none';
	// Converts thead tags to tbody with class 'dummy-header'. This is intended to prevent the browser from trying to repeat them several times when printing.
	document.querySelectorAll('thead').forEach(function(element) {
		let newel=document.createElement('tbody');
		newel.classList.add('dummy-header');
		newel.innerHTML=element.innerHTML;
		element.parentNode.replaceChild(newel,element);
	});
}

/**
 * Restore the view to its original state after printing
 */
function close_print_view() {
	// Unwrap all slides from their flexbox layout
	document.getElementById('thumblayer').querySelectorAll('div.wthumb').forEach(function(element) {
		element.firstChild.classList.remove('thumbnail');
		reset_fragments(element,0);
		let parent=element.parentNode;
		parent.insertBefore(element.firstChild,element);
		parent.removeChild(element);
	});
	let tl=document.getElementById('thumblayer');
	let parent=tl.parentNode;
	while (tl.firstChild) parent.insertBefore(tl.firstChild,tl);
	parent.removeChild(tl);
	// Remakes outline slide visible if it is selected
	if (slides[curslide]['id']=='outline') getSlide(curslide).style.display='flex';
	// Converts back dummy tbody tags to thead tags 
	document.querySelectorAll('tbody.dummy-header').forEach(function(element) {
		let newel=document.createElement('thead');
		newel.innerHTML=element.innerHTML;
		element.parentNode.replaceChild(newel,element);
	});
}

/**********************************
 *        Overview management     *
 **********************************/
/**
 * Open an overview of all slides. The function scales all slides, places them on a flexbox div, blurs the background, and animates the transition from the current slide to its new position.
 */
function open_overview() {
	on_overview=true;
	overview_curslide=curslide;
	// Add the overlay to blur the background
	document.body.insertAdjacentHTML('afterbegin','<div id="coverlayer"></div>');
	document.getElementById('coverlayer').style.opacity='1';
	let slideo=getSlide(curslide);
	let oldpos=slideo.getBoundingClientRect(); // Remember the position of the current slide
	// Wrap all slides in new divs to put them in a flexbox layout, and make them thumbnails
	for (let slide of slides) {
		let element=document.getElementById(slide['id']);
		if (element.classList.contains('thumbnail')) continue;
		element.classList.add('thumbnail');
		let wrapper=document.createElement('div');
		wrapper.classList.add('wthumb');
		element.parentNode.appendChild(wrapper);
		wrapper.appendChild(element);
		wrapper.addEventListener('click',function() {
			close_overview(getSlideIndex(element.id));
		});
	}
	let nwrapper=document.createElement('div');
	nwrapper.id='thumblayer';
	let firstdiv=document.querySelector('body div.wthumb');
	firstdiv.parentNode.insertBefore(nwrapper,firstdiv);
	document.querySelectorAll('body div.wthumb').forEach(function(element) {
		nwrapper.appendChild(element);
	});
	if (slideo.id!='outline') {
		let wrapper=slideo.parentNode;
		// Scroll the overview div so that the current slide is visible
		let tl=document.getElementById('thumblayer');
		tl.scrollTop=tl.offsetTop+wrapper.offsetTop;
		wrapper.style.zIndex='30';
		let newpos=wrapper.getBoundingClientRect();	// Remember the new position of the current slide
		let deltal=newpos.left-oldpos.left;
		let deltat=newpos.top-oldpos.top;
		let deltaw=newpos.width/oldpos.width-1;
		let deltah=newpos.height/oldpos.height-1;
		// Put back the current slide at its original position
		slideo.classList.remove('thumbnail');
		slideo.style.position='fixed';
		slideo.style.transformOrigin='left top';
		slideo.style.backgroundColor='white';
		slideo.style.visibility='visible';
		setTimeout(function() {
			slideo.classList.add('overview-transition');
			// Animate the transition while blurring the background
			slideo.addEventListener('transitionend',function(event) {
				slideo.style.transform=null;
				slideo.style.position=null;
				slideo.style.transformOrigin=null;
				slideo.style.backgroundColor=null;
				slideo.style.visibility=null;
				slideo.classList.add('thumbnail');
				slideo.classList.remove('overview-transition');
				wrapper.style.zIndex=null;
			},{capture:false,once:true});
			setTimeout(function() {
				slideo.style.transform='translate('+newpos.left+'px, '+newpos.top+'px) scale('+(newpos.width/oldpos.width)+', '+(newpos.height/oldpos.height)+')';
				getSlide(overview_curslide).classList.add('targetted'); // Add a visual style to the targetted slide in the overview
			},20);
		},20);
	}
}

/**
 * Close the overview. This function puts all slides to their original states, removes the divs created to make the overview, and animates the selected slide while it grows to the whole screen.
 * @param {number} newslidenum - Selected slide which shall become the active slide when the overview is closed. If null, the previously active slide remains active.
 */
function close_overview(newslidenum=null) {
	function remove_overview_wrapper() {
		document.getElementById('thumblayer').querySelectorAll('div.wthumb').forEach(function(element) {
			element.firstChild.classList.remove('thumbnail');
			let parent=element.parentNode;
			parent.insertBefore(element.firstChild,element);
			parent.removeChild(element);
		});
		let tl=document.getElementById('thumblayer');
		let parent=tl.parentNode;
		while (tl.firstChild) parent.insertBefore(tl.firstChild,tl);
		parent.removeChild(tl);
	}
	on_overview=false;
	getSlide(overview_curslide).classList.remove('targetted');	// Remove the visual style of the targetted slide in the overview
	if (newslidenum==null) newslidenum=curslide;	// If no new slide was selected, the previously active slide will be animated to cover the whole screen
	let slideo=getSlide(newslidenum);
	if (slideo.id=='outline') {
		let cl=document.getElementById('coverlayer');
		cl.addEventListener('transitionend',function(event) {
			cl.parentNode.removeChild(cl);
		});
		cl.style.opacity='0';
		remove_overview_wrapper();
	} else {
		slideo.parentNode.style.zIndex='30';
		let oldpos=slideo.getBoundingClientRect();	// Remember the current position of the selected slide
		let deltal=oldpos.left;
		let deltat=oldpos.top;
		let deltaw=oldpos.width/window.innerWidth-1;
		let deltah=oldpos.height/window.innerHeight-1;
		// Detach the selected slide from the flexbox layout
		slideo.style.position='fixed';
		slideo.style.transformOrigin='left top';
		slideo.style.backgroundColor='white';
		slideo.style.transform='translate('+(oldpos.left)+'px, '+(oldpos.top)+'px) scale('+(oldpos.width/window.innerWidth)+','+(oldpos.height/window.innerHeight)+')';
		// Animate the selected slide from its position in the overview to the whole screen, while unblurring the background
		let cl=document.getElementById('coverlayer');
		cl.addEventListener('transitionend',function(event) {
			cl.parentNode.removeChild(cl);
		});
		cl.style.opacity='0';
		setTimeout(function() {
			slideo.classList.add('overview-transition');
			slideo.addEventListener('transitionend',function(event) {
				slideo.style.transform=null;
				slideo.style.position=null;
				slideo.style.transformOrigin=null;
				slideo.style.backgroundColor=null;
				slideo.classList.remove('overview-transition');
				remove_overview_wrapper();
				// Prepare the new slide
				if (newslidenum!=curslide) {
					let newslideo=getSlide(newslidenum);
					let slideo=getSlide(curslide);
					let slide=curslide;
					curslide=newslidenum;
					curfragment=0;
					reset_fragments(newslideo,0);
					slideo.style.visibility=null;
					if (slideo.dataset["onhide"]) window[slideo.dataset["onhide"]](slideo);
					newslideo.style.visibility='visible';
					if (newslideo.dataset["onshow"]) window[newslideo.dataset["onshow"]](newslideo);
					program_hashchange=true;
					location.hash="#"+newslideo.id;
					newslideo.visibility=null;
					reset_fragments(slideo,0);
					update_navigation_bar(newslidenum,slide);
					update_footer(newslidenum);
					switch_background(slides[newslidenum]['background']);
				} else {
					let e=document.createEvent('HTMLEvents');
					e.initEvent('hashchange',false,true);
					window.dispatchEvent(e);
				}
			},{capture:false,once:true});
			setTimeout(function() {
				slideo.style.transform='translate(0px,0px) scale(1,1)';
			},20);
		},20);
	}
}

/**********************************
 *        Slide movement          *
 **********************************/
/**
 * This function is executed when the user performs an action to call for the next slide (swipe towards left side, right button).
 */
function to_next_slide() {
	if (!on_overview) {
		let newslide=curslide;
		let newfragment=curfragment;
		if (curfragment==slides[curslide]['numfragments']) {
			if (curslide<slides.length-1) {
				newslide++;
				newfragment=0;
				switch_slide(newslide,newfragment);
			}
		} else {
			newfragment++;
			switch_slide(newslide,newfragment);
		}
	}
}

/**
 * This function is executed when the user performs an action to call for the previous slide (swipe towards right side, left button).
 */
function to_previous_slide() {
	if (!on_overview) {
		let newslide=curslide;
		let newfragment=curfragment;
		if (curfragment==0) {
			if (curslide>0) {
				newslide--;
				newfragment=0;
				switch_slide(newslide,newfragment);
			}
		} else {
			newfragment--;
			switch_slide(newslide,newfragment);
		}
	}
}

/**
 * Display a new slide or a new fragment. The function applies an animation to go from the old slide to the new one.
 * @param {number} newslidenum - New slide index, relative to the {@link slides} array
 * @param {number} newfragmentnum - New fragment index
 */
function switch_slide(newslidenum,newfragmentnum) {
	let increasing=(newslidenum>curslide || (newslidenum==curslide && newfragmentnum>curfragment));
	let newslideo=getSlide(newslidenum);
	let slideo=getSlide(curslide);
	if (newslidenum!=curslide) {
		let slide=curslide;
		curslide=newslidenum;
		curfragment=newfragmentnum;
		if (increasing) {
			reset_fragments(newslideo,0); 
			apply_start_fragments(newslideo,true);
		} else reset_fragments(newslideo,slides[newslidenum]['numfragments']);
		if (newslideo.id=="outline") update_outline_slide(newslidenum);
		apply_animation(slideo,newslideo,increasing,function() {
			reset_fragments(slideo,0);
			apply_start_fragments(newslideo,false);
			animate_fragment(curslide,0,curslide>slide);
			update_navigation_bar(newslidenum,slide);
			update_footer(newslidenum);
		});
		switch_background(slides[newslidenum]['background']);
	} else if (curfragment!=newfragmentnum) {
		let fragment=curfragment;
		curfragment=newfragmentnum;
		animate_fragment(curslide,newfragmentnum,newfragmentnum>fragment);
		reset_fragments(newslideo,newfragmentnum);
	}
}

/**********************************
 *        Swipe handling          *
 **********************************/
function getTouches(evt) {
	return evt.touches || evt.originalEvent.touches;
}

/**
 * Function called when the user initiates a swipe movement.
 * @param {object} evt - Event object
 */
function handleTouchStart(evt) {
	xDown=getTouches(evt)[0].clientX;
	yDown=getTouches(evt)[0].clientY;
}

/**
 * Function called when the user is moving his finger in a swipe movement.
 * @param {object} evt - Event object
 */
function handleTouchMove(evt) {
	xUp=getTouches(evt)[0].clientX;
	yUp=getTouches(evt)[0].clientY;
}

/**
 * Function called when the user releases the screen in a swipe movement.
 * @param {object} evt - Event object
 */
function handleTouchEnd(evt) {
	if (xDown==null || yDown==null || xUp==null || yUp==null) return;
	if (Math.abs(xUp-xDown)>Math.abs(yUp-yDown)) {
		if (Math.abs(xUp-xDown)>200) {
			if (xUp>xDown) to_previous_slide(); else to_next_slide();
		}
	} 
}

/**********************************
 *      Fullscreen toggling       *
 **********************************/
/**
 * Toggles fullscreen mode.
 */
function toggleFullscreen() {
	if (!document.fullscreenElement) document.documentElement.requestFullscreen({'navigationUI':'hide'});
	else document.exitFullscreen();
}

/**********************************
 * Handling of push/pull signals  *
 **********************************/
/**
 * Asynchronously update the location hash on the server. All clients will be notified of the update and will synchronize with the new hash.
 * @param {string} url - Url of the script on the server
 * @param {string} name - Name used for the synchronization channel
 */
function signal(url,name) {
	let xhttp=new XMLHttpRequest();
	xhttp.open('POST',url,true);
	xhttp.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
	xhttp.send('push='+name+'&hash='+location.hash);
}

/**
 * This event handler is meant to be used as the keyUp event handler for the Syncname input field. Updates the syncName variable as read from user input and closes the query bar
 * @param {event} event - Event object
 */
function getSyncName(event) {
	if (event.keyCode==13) {
		let syncf=document.getElementById('syncName');
		syncName=syncf.value;
		if (syncName=='') syncName=null;
		let bar=syncf.parentNode;
		bar.addEventListener('transitionend',function() {
			bar.parentNode.removeChild(bar);
		},{capture:false,once:true});
		bar.style.top=null;
	}
	event.stopPropagation();
}

/**
 * Asynchronously query the new location hash from the server and update the position to synchronize with the server. This function polls the server at a regular interval (10 seconds).
 * @param {string} url - Url of the script on the server
 * @param {string} name - Name used for the synchronization channel
 */
function pollSync(url,name) {
	setInterval(function() {
		if (slaveMode) {
			let xhttp=new XMLHttpRequest();
			xhttp.open('POST',url,true);
			xhttp.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
			xhttp.onreadystatechange=function() {
				if (this.readyState==XMLHttpRequest.DONE && this.status==200) location.hash=this.responseText;
			}
			xhttp.send('pull='+name);
		}
	},10000);
}

/**
 * Query the new location hash from the server and update the position to synchronize with the server. This function listens to HTML5 server-sent events.
 * @param {string} url - Url of the script on the server
 * @param {string} name - Name used for the synchronization channel
 */
function registerSync(url,name) {
	let source=new EventSource(url+'?register='+encodeURIComponent(name));
	source.onmessage=function(e) {
		if (slaveMode) location.hash=e.data;
	};
}

/**
 * Toggle synchronization slave mode.
 * @param {object} elem - Element which has been clicked on to toggle the slave mode.
 */
function toggleSync(elem) {
	slaveMode=!slaveMode;
	if (slaveMode) {
		elem.textContent="Activée";
		elem.parentNode.classList.replace('inactive','active');
	} else {
		elem.textContent="Désactivée";
		elem.parentNode.classList.replace('active','inactive');
	}
}

/**
 * Display QR-Code of sync'ed presentation. This function uses the Google API to generate a QR-Code from a URL.
 * @param {string} syncName - Id of synchronization, may be null if no synchronization has been set
 */
function displayQrcode(syncName) {
	document.body.insertAdjacentHTML('afterbegin','<div id="coverlayer"></div>');
	document.getElementById('coverlayer').style.opacity='1';
	let syncd=document.createElement('div');
	syncd.id='qrcode-view';
	let uri=window.location.protocol+'//'+window.location.hostname+window.location.pathname+window.location.search;
	if (syncName) {
		uri+=(window.location.search!=''?'&':'?')+'sync='+syncName;
	}
	let encodeduri=encodeURIComponent(uri);
	//syncd.innerHTML='<div class="title">Suivez la présentation en direct<br/>en flashant le QR-Code suivant</div><figure><img src="https://chart.googleapis.com/chart?cht=qr&chl='+encodeduri+'&chs=400x400" /></figure><p><a href="'+uri+'">'+uri+'</p>';
	syncd.innerHTML='<div class="title">Suivez la présentation en direct<br/>en flashant le QR-Code suivant</div><figure><img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data='+encodeduri+'" /></figure><p><a href="'+uri+'">'+uri+'</p>';
	on_qrcode=true;
	document.body.insertAdjacentElement('afterbegin',syncd);
	setTimeout(()=>{syncd.classList.add('active');},10);
}

/**
 * Close QR-Code of sync'ed presentation.
 */
function closeQrcode() {
	let cl=document.getElementById('coverlayer');
	cl.addEventListener('transitionend',function(event) {
		cl.parentNode.removeChild(cl);
	});
	cl.style.opacity='0';
	let syncd=document.getElementById('qrcode-view');
	syncd.addEventListener('transitionend',function(event) {
		syncd.parentNode.removeChild(syncd);
		on_qrcode=false;
	},{once:true});
	syncd.classList.remove('active');
}

/**********************************
 *         Notes window           *
 **********************************/
function onNotesLoaded(event) {
	let titles=document.querySelectorAll('body > section > h1');
	let num=titles.length;
	Array.from(wnotes.document.getElementsByTagName('h2')).forEach(function(element) {
		let i=0;
		while (i<num && titles[i].innerHTML!=element.innerHTML) ++i;
		if (i<num) element.id=titles[i].parentNode.id;
	});
}

/**********************************
 *         Outline view           *
 **********************************/
function toggle_outline() {
	let outlinesheet=null;
	let mainsheet=null;
	for (let i=0;i<document.styleSheets.length;++i) {
		if (document.styleSheets[i].title=='mainsheet') mainsheet=document.styleSheets[i];
		if (document.styleSheets[i].title=='outlinesheet') outlinesheet=document.styleSheets[i];
	}
	if (mainsheet!=null && outlinesheet!=null) {
		outlinestyle=!outlinestyle;
		mainsheet.disabled=outlinestyle;
		outlinesheet.disabled=!outlinestyle;
	}
}

/**********************************
 *     Main document functions    *
 **********************************/
/** Pre-process the HTML code. This function does several things:
 *	<ul>
 *		<li>it replaces single quotes by double quotes in JSON attributes</li>
 *		<li>it replaces parameterized text by values obtained from the HTML request command or an external configuration file</li>
 *	</ul>
 */
function process_slideshow() {
	// Replace quotes in JSON attributes
	for (let val of ['fragment','fanim','fstart','autofragment','background']) {
		Array.from(document.querySelectorAll('[data-'+val+']')).forEach(function(element) {
			let attr=element.dataset[val];
			attr=attr.replace(/'/g,'"');
			element.dataset[val]=attr;
		});
	}
	// Replace parameterized text
	Array.from(document.querySelectorAll('[data-variable]')).forEach(function(span) {
		if (span.dataset['variable'] in parameters) span.innerHTML=parameters[span.dataset['variable']];
	});
}


/**
 * Pre-process a slide and generate an object describing it, suited for the {@link slides} array
 * @param {object} element - HTML slide element
 * @param {object} defaults - Object containing the default values for background and animation
 * @returns {object} - Object describing the slide
 */
function process_slide(element,defaults) {
	// Background and animation
	if ('background' in element.dataset) defaults['background']=from_string(element.dataset['background']);
	if ('animation' in element.dataset) defaults['animation']=element.dataset['animation'];
	// Count fragments in slide by first parsing the <tt>data-fragment</tt> and <tt>data-fanim</tt> attributes of objects. The total number of fragments is the highest fragment number referenced by those attributes.
	let numfragments=0;
	if (element.dataset['numfragment']) numfragments=parseInt(element.dataset["numfragment"]);
	else {
		let max=0;
		for (let attr of ["fragment","fanim"]) {
			Array.from(element.querySelectorAll('[data-'+attr+']')).forEach(function(element) {
				let fragspec=JSON.parse(element.dataset[attr]);
				Object.getOwnPropertyNames(fragspec).forEach(function(fraglist) {
					let reg=/(?:^|,)(\d*)(?:-(\d*))?/g;
					while ((frag=reg.exec(fraglist))!==null) {
						let first=(frag[1]=='' ? 0 : parseInt(frag[1]));
						let last=(frag[2] && frag[2]!='') ? parseInt(frag[2]) : first;
						if (first>max) max=first;
						if (last>max) max=last;
					}
				});
			});
		}
		numfragments=max;
	}
	// Autogenerate fragments
	if ('autofragment' in element.dataset) {
		let fragspec=JSON.parse(element.dataset["autofragment"]);
		let fragbefore=['invisible'];
		let fragafter=null;
		let fragcurrent=null;
		let fraganim=null;
		if (fragspec.length>1) {
			if (fragspec[1].length>=4) fraganim=fragspec[1][3];
			if (fragspec[1].length>=3) fragafter=fragspec[1][2];
			if (fragspec[1].length>=2) fragbefore=fragspec[1][0];
			if (fragspec[1].length>=1) fragcurrent=fragspec[1][(fragspec[1].length>=2)?1:0];
		}
		let elements=element.querySelectorAll(fragspec[0]);
		numfragments=elements.length-1;
		for (let i=0;i<elements.length;++i) {
			let fragmentp={};
			if (i>0) {
				if (i>1) fragmentp['0-'+(i-1).toString()]=fragbefore;
				else fragmentp['0']=fragbefore;
			}
			fragmentp[i.toString()]=fragcurrent;
			if (i<elements.length-2) fragmentp[(i+1).toString()+'-'+(elements.length-1).toString()]=fragafter;
			else if (i<elements.length-1) fragmentp[(i+1).toString()]=fragafter;
			elements[i].dataset['fragment']=JSON.stringify(fragmentp);
			if (fraganim!=null) {
				let fragmenta={};
				fragmenta[i.toString()]=fraganim;
				elements[i].dataset['fanim']=JSON.stringify(fragmenta);
			}
		}
	}
	// Section and subsection
	let slide={'id':element.id,'background':defaults['background'],'animation':defaults['animation'],'navigation':!compare(element.dataset['navigation'],'false'),'footer':!compare(element.dataset['footer'],'false'),'numfragments':numfragments};
	if ('section' in element.dataset && element.dataset['section']!='') {
		slide['section']=element.dataset['section'];
		if ('ssection' in element.dataset && element.dataset['ssection']!='') slide['ssection']=element.dataset['ssection'];
	}
	if ('subsection' in element.dataset && element.dataset['subsection']!='') slide['subsection']=element.dataset['subsection'];
	return slide;
}

/**
 * Generate the array of slides {@link slides}
 */
function prepare_slides() {
	process_slideshow();
	// Prepare array of slides
	let slide=document.getElementById('title');
	let outlines=null;
	if (! ('nooutline' in parameters && parameters['nooutline']=='true')) outlines=document.getElementById('outline');
	slides.push({'id':'title','background':slide.dataset['background'],'animation':slide.dataset['animation'],'navigation':compare(slide.dataset['navigation'],'true'),'footer':compare(slide.dataset['footer'],'true'),'numfragments':0});
	let defaults={'background':'','animation':''};
	Array.from(document.getElementsByTagName('section')).forEach(function(element,index) {
		// Give an id to the slide
		let id="slide-"+(index+1);
		if (!element.id) element.id=id;
		if ('#'+id==location.hash) element.style.visibility='visible';
	});
	if ('outline' in parameters) {
		for (let slidespec of parameters['outline']) {
			// Generate slide if it does not exist
			if ('html' in slidespec) {
				let newslide=document.createElement('section');
				slidespec['id']='slide-'+Math.random().toString().substr(2).replace(/./g,s=>String.fromCharCode(s.charCodeAt(0)+17));
				newslide.id=slidespec['id'];
				newslide.innerHTML=slidespec['html'];
				document.body.appendChild(newslide);
			}
			// Prepare default values for background and animation
			let defaultsoverride={};
			if ('data-background' in slidespec) defaultsoverride['background']=from_string(slidespec['data-background']);
			if ('data-animation' in slidespec) defaultsoverride['animation']=slidespec['data-animation'];
			let slideo=process_slide(document.getElementById(slidespec['id']),defaults);
			Object.assign(slideo,slidespec);
			Object.assign(slideo,defaultsoverride);
			// Insert slide in array
			// If the slide starts a new section, also inserts an outline slide
			if (outlines && 'section' in slideo && slideo['section']!='') 
				slides.push({'id':'outline',
					'background':(('background' in outlines.dataset)?outlines.dataset['background']:''),
					'animation':(('animation' in outlines.dataset)?outlines.dataset['animation']:''),
					'navigation':!compare(outlines.dataset['navigation'],'false'),
					'footer':!compare(outlines.dataset['footer'],'false'),
					'numfragments':0,
					'section':slideo['section']});
			slides.push(slideo);
		}
	} else {
		// Process heading (h1 and h2) elements outside slides and replace them with the right attribute in the following slide. This allows for an alternate syntax for specifying new sections and subsections. It is especially needed for conversion with Pandoc because the converter can't rely on the order of the slides in the source document to find the starts of sections and subsections. (The converter is stateless.)
		let noh1=(document.querySelectorAll('body > h1').length==0);
		Array.from(document.querySelectorAll('body > h1,body > h2')).forEach(function(element) {
			let sec=element;
			do {
				sec=sec.nextElementSibling;
			} while (sec!=null && sec.tagName!='SECTION');
			if (sec==null) return;
			let seclevel=(element.tagName=='H1' || noh1);
			sec.dataset[seclevel ? 'section' : 'subsection']=element.textContent;
			if (seclevel && 'ssection' in element.dataset) sec.dataset['ssection']=element.dataset['ssection'];
			element.parentNode.removeChild(element);
		});
		// Add all slides to the array
		Array.from(document.getElementsByTagName('section')).forEach(function(element,index) {
			if (element.id=='title' || element.id=='outline') return;
			let slideo=process_slide(element,defaults);
			// Test if the slide is in the slideshow subset, otherwise skip it
			if ('subset' in parameters && parameters['subset'].length>0) {
				let ok=false;
				if (parameters['subset'].includes(''+(index+1)) || parameters['subset'].includes(element.id)) ok=true;
				if (!ok && 'groups' in element.dataset) for (group of element.dataset['groups'].split(',')) {
					if (parameters['subset'].includes(group)) ok=true;
					break;
				}
				if (!ok) return;
			}
			// Test if the slide is in the slideshow hidden subset, if this is the case, skip it
			if ('hidden' in parameters && parameters['hidden'].length>0 && (parameters['hidden'].includes(''+(index+1)) || parameters['hidden'].includes(element.id))) return;
			// Insert slide in array
			// If the slide starts a new section, also inserts an outline slide
			if (outlines && 'section' in element.dataset) 
				slides.push({'id':'outline',
					'background':(('background' in outlines.dataset)?outlines.dataset['background']:''),
					'animation':(('animation' in outlines.dataset)?outlines.dataset['animation']:''),
					'navigation':!compare(outlines.dataset['navigation'],'false'),
					'footer':!compare(outlines.dataset['footer'],'false'),
					'numfragments':0,
					'section':element.dataset['section']});
			slides.push(slideo);
		});
	}
	compose_outline_slide(); // Fill out outline slides
	if (outlines) slides.splice(1,0,{'id':'outline',
		'background':(('background' in outlines.dataset)?outlines.dataset['background']:''),
		'animation':(('animation' in outlines.dataset)?outlines.dataset['animation']:''),
		'navigation':!compare(outlines.dataset['navigation'],'false'),
		'footer':!compare(outlines.dataset['footer'],'false'),
		'numfragments':0,
		'section':''});
}

document.addEventListener("DOMContentLoaded",function(event) {
	// Read query string
	let querys=decodeURI(location.search.substr(1)).split('&');
	for (let i=0;i<querys.length;++i) {
		let varval=querys[i].split('=');
		parameters[varval[0]]=varval[1];
	}
	if ('subset' in parameters && parameters['subset']!='') parameters['subset']=parameters['subset'].split(',');
	if ('hidden' in parameters && parameters['hidden']!='') parameters['hidden']=parameters['hidden'].split(',');
	// Disable outline stylesheet
	for (let i=0;i<document.styleSheets.length;++i) if (document.styleSheets[i].title=='outlinesheet') document.styleSheets[i].disabled=true;
	// Load external SVG files
	let promises=[];
	Array.from(document.querySelectorAll('div [data-file]')).forEach(function(element) {
		promises.push(new Promise(function(resolve,reject) {
			let xhttp=new XMLHttpRequest();
			xhttp.open('GET',element.dataset['file'],true);
			xhttp.onreadystatechange=function() {
				if (this.readyState==XMLHttpRequest.DONE && this.status==200) {
					element.outerHTML=this.responseText;
					resolve();
				}
			}
			xhttp.send();
		}));
	});
	// Load configuration file if the 'variant' value is in the request parameters
	if ('variant' in parameters) {
		promises.push(new Promise(function(resolve,reject) {
			let xhttp=new XMLHttpRequest();
			xhttp.open('GET',"variant_"+parameters['variant']+".json",true);
			xhttp.onreadystatechange=function() {
				if (this.readyState==XMLHttpRequest.DONE && this.status==200) {
					Object.assign(parameters,JSON.parse(this.responseText));
					resolve();
				}
			}
			xhttp.send();
		}));
	}
	// Execute starting handler
	let fn=window['onSlidesStart'];
	if (fn) promises.push(new Promise(fn));
	// Wait for everything to continue
	Promise.all(promises).then(afterLoad);
});

function afterLoad() {
	window.name="parentpres";
	syncUrl=document.documentElement.dataset['synchronize'];
	// Create background layers
	document.body.insertAdjacentHTML('afterbegin','<div id="newbackground"></div>');
	document.body.insertAdjacentHTML('afterbegin','<div id="background"></div>');
	
	getDate();	// Automatically add date if none is given
	prepare_slides(parameters); // Prepare the array of slides

	// Get current slide
	if (location.hash=='') location.hash='#title';
	if (location.hash=="#title") curslide=0; 
		else if (location.hash=="#outline") {
			curslide=getSlideIndex('outline');
		} else curslide=parseInt(getSlideIndex(location.hash.substring(1)));
	switch_background(slides[curslide]['background']);

	// Add navigation bar
	add_navigation_bar();
	update_navigation_bar(curslide);

	// Add footer bar
	add_footer();
	update_footer(curslide);

	// Hash change handler
	window.addEventListener('hashchange',function() {
		if (program_hashchange) {
			program_hashchange=false;
		} else {
			let slide=curslide;
			getSlide(curslide).style.visibility=null;
			curslide=getSlideIndex(location.hash.substring(1));
			let curslideo=getSlide(curslide);
			curslideo.style.visibility='visible';
			switch_background(slides[curslide]['background']);
			update_navigation_bar(curslide,slide);
			update_footer(curslide);
			reset_fragments(curslideo,0);
		}
		if (wnotes!=null && !wnotes.closed) {
			wnotes.location.hash=location.hash;
			//wnotes.postMessage(getSlide(curslide).getElementsByTagName('h1')[0].innerHTML,'*');
			wnotes.ratio=curslide/slides.length;
		}
		if (!slaveMode && syncUrl && syncName) {
			signal(syncUrl,syncName,location.hash);
		}
	});

	// Pull mode, synchronize with presenter
	if (syncUrl) {
		if (('sync' in parameters) || ('syncp' in parameters)) {
			slaveMode=true;
			let el=document.createElement('div');
			el.id='syncstatus';
			el.innerHTML='Synchronisation : <span class="active"><a href="#" onClick="toggleSync(this);return false;">Activée</a></span>';
			document.body.insertAdjacentElement('afterbegin',el);
			if (parameters['sync']) registerSync(syncUrl,parameters['sync']); else pollSync(syncUrl,parameters['syncp']);
		}
	}

	// Print mode
	window.onbeforeprint=open_print_view;
	window.onafterprint=close_print_view;

	// Handle swipe events
	document.addEventListener('touchstart',handleTouchStart,false);
	document.addEventListener('touchmove',handleTouchMove,false);
	document.addEventListener('touchend',handleTouchEnd,false);

	// Fullscreen on double-click
	document.addEventListener('dblclick',toggleFullscreen,false);

	// Handle key events
	document.addEventListener('keydown',function(e) {
		if (!on_overview && e.keyCode==80) toggle_outline(); // 'p'
		if (outlinestyle) return;
		let newslide=curslide;
		let newfragment=curfragment;
		switch (e.keyCode) {
			case 39:case 32:	// Right arrow, Space
				if (!on_overview) {
					to_next_slide();
				} else {
					if (overview_curslide<slides.length-1) {
						getSlide(overview_curslide).classList.remove('targetted');
						do {
							++overview_curslide;
						} while (overview_curslide<slides.length-1 && getSlide(overview_curslide).id=="outline");
						let oslideo=getSlide(overview_curslide);
						oslideo.classList.add('targetted');
						oslideo=oslideo.parentNode;
						let tl=document.getElementById('thumblayer');
						if (oslideo.offsetTop+oslideo.offsetHeight>tl.offsetHeight+tl.scrollTop) tl.scrollTop+=tl.offsetHeight/2;
					}
				}
				break;
			case 37:	// Left arrow
				if (!on_overview) {
					to_previous_slide();
				} else {
					if (overview_curslide>0) {
						getSlide(overview_curslide).classList.remove('targetted');
						do {
							--overview_curslide;
						} while (overview_curslide>0 && getSlide(overview_curslide).id=="outline");
						let oslideo=getSlide(overview_curslide);
						oslideo.classList.add('targetted');
						oslideo=oslideo.parentNode;
						let tl=document.getElementById('thumblayer');
						if (oslideo.offsetTop<tl.scrollTop) tl.scrollTop-=tl.offsetHeight/2;
					}
				}
				break;
			case 38:	// Up arrow
				if (!on_overview) {
					if (curslide>0) {
						newslide--;
						newfragment=slides[newslide]['numfragments'];
						switch_slide(newslide,newfragment);
					}
				}
				break;
			case 40:	// Down arrow
				if (!on_overview) {
					if (curslide<slides.length-1) {
						newslide++;
						newfragment=0;
						switch_slide(newslide,newfragment);
					}
				}
				break;
			case 33: // Page up
				if (!on_overview) {
					if (newslide>0) newslide--;
					if (! ('nooutline' in parameters && parameters['nooutline']=='true')) while (newslide>0 && getSlide(newslide).id!='outline') newslide--;
					else while (newslide>0 && ! ('section' in slides[newslide])) newslide--;
					newfragment=0;
					switch_slide(newslide,newfragment);
				}
				break;
			case 34: // Page down
				if (!on_overview) {
					if (newslide<slides.length-1) newslide++;
					if (! ('nooutline' in parameters && parameters['nooutline']=='true')) while (newslide<slides.length-1 && getSlide(newslide).id!='outline') newslide++;
					else while (newslide<slides.length-1 && ! ('section' in slides[newslide])) newslide++;
					newfragment=0;
					switch_slide(newslide,newfragment);
				}
				break;
			case 36: // Home
				if (!on_overview) {
					newslide=0;
					newfragment=0;
					switch_slide(newslide,newfragment);
				}
				break;
			case 35: // End
				if (!on_overview) {
					newslide=slides.length-1;
					newfragment=slides[newslide]['numfragments'];
					switch_slide(newslide,newfragment);
				}
				break;
			case 79:	// 'o'
				if (!on_overview) {
					open_overview();
				} else {
					close_overview();
				}
				break;
			case 13:	// enter
				if (on_overview) close_overview(overview_curslide);
				break;
			case 78:	// 'n'
				if (wnotes==null || wnotes.closed) {
					wnotes=window.open(document.documentElement.dataset['notes']+"#"+getSlide(curslide).id,"Notes","left=0, top=0, status=no, menubar=no, toolbar=no, location=no, directories=no, copyhistory=no, width='+w+', height='+h', fullscreen=yes");
					wnotes.onload=onNotesLoaded;
				} else {
					wnotes.close();
				}
				break;
			case 188:	// ','
				if (wnotes!=null && !wnotes.closed) {
					let obj=wnotes.document.getElementById('notes');
					obj.scrollTop+=wnotes.screen.height/2;
				}
				break;
			case 190:	// ';'
				if (wnotes!=null && !wnotes.closed) {
					let obj=wnotes.document.getElementById('notes');
					obj.scrollTop-=wnotes.screen.height/2;
				}
				break;
			case 83:	// 's'
				if (e.shiftKey) {
					if (on_qrcode) {
						closeQrcode();
					} else {
						displayQrcode(syncName);
					}
				} else {
					if (syncUrl) {
						e.stopImmediatePropagation();
						let syncd=document.createElement('div');
						syncd.id='synchronize';
						syncd.innerHTML='Identifiant de synchronisation : <input type="text" id="syncName" maxlength="30">';
						document.body.insertAdjacentElement('afterbegin',syncd);
						setTimeout(function() {
							syncd.style.top='0px';
							let obj=syncd.lastChild;
							obj.addEventListener('keydown',() => {event.stopPropagation()},false);
							obj.addEventListener('keyup',getSyncName,false);
							obj.focus();
						},20);
					}
				}
				break;
		}
	});

}
