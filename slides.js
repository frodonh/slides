/** Array of slides together with ook characteristics
 *	Each element of the slide is an object with the following members:
 *	<dl>
 *		<dt>id</dt><dd>id of the slide</dd>
 *		<dt>element</dt><dd>DOM element for the slide</dd>
 *		<dt>num</dt><dd>The number of the slide in the slideshow</dd>
 *		<dt>numfragments</dt><dd>Number of fragments in the slide</dd>
 *		<dt>groups</dt><dd>Array of groups the slide belongs to</dd>
 *	</dl>
 */
var slides=[];
/** Structure of the slideshow
 *  The structure is an array of elements. Each element is an object with the following members:
 *  <dl>
 *  	<dt>name</dt><dd>Title of the part</dd>
 *  	<dt>level</dt><dd>Level of the heading (0 for h1, 1 for h2...)</dd>
 *  	<dt>short</dt><dd>Short title of the part</dd>
 *  	<dt>element</dt><dd>DOM element of the heading</dd>
 *  	<dt>parts</dt><dd>List of subparts</dd>
 *  	<dt>parent</dt><dd>Parent entry of the element</dd>
 *  	<dt>target</dt><dd>Target slide of the heading, when a link to the heading is clicked. For a normal slide, it is the very same slide. For a header, it is the outline slide generated for this header if it exists, otherwise the next standard slide</dd>
 *  </dl>
 *
 *  This variable holds the root of the structure. Therefore it should only have one element which is the title of the document and the list of sections.
 */
var structure = [];
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
/** Touch event starting and ending point coordinate */
var xDown = null;
var yDown = null;
var xUp = null;
var yUp = null;
/** URL used for synchronization */
var syncUrl=null;
/** Name used for synchronization */
var syncName=null;
/** Slave mode */
var slaveMode=false;
/** Outline stylesheet activated */
var outlinestyle=false;
/** Array of slideshow parameters */
var parameters=[];
/** Metadata */
var meta = [];
/** General configuration of the slidehow */
var config = [];
/** Promises used to wait for everything to load */
var promises = [];

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
	//return document.getElementById(slides[num]['id']);
	return slides[num]['element'];
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
 *      General API for users     *
 **********************************/
/**
 * Generate a QR code image that can be added to a slide
 *
 * @param {string} qrclass - A class name. All the DOM elements with this class will be replaced by the QR-Code.
 * @param {string} prompt - Prompt string to use at the top of the QR-Code.
 * @returns - DOM object for the QR-code
 */
function generate_qr_code(qrclass, prompt=null) {
	const prompts = {
		"fr": "Retrouvez ce diaporama sur :",
		"en": "This slideshow is available at:"
	};
	if (!prompt) {
		const lang = document.documentElement.lang;
		prompt = lang in prompts ? prompts[lang] : prompts["en"];
	}
	let uri = window.location.protocol + '//' + window.location.hostname + window.location.pathname + window.location.search;
	let encodeduri = encodeURIComponent(uri);
	Array.from(document.getElementsByClassName(qrclass)).forEach(function(el) {
		el.innerHTML = `
			<p style="text-align:center">${prompt}<br/><a href="${uri}">${uri}</a></p>
			<figure class="centered">
				<img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeduri}" />
			</figure>`;
	});
}

/**********************************
 *   Background and foreground    *
 **********************************/
/**
 * Switch background or foreground layer, applying a smooth transition between them
 * @param {string} layer - "background" or "foreground", choose which layer to switch
 * @param {slideo} New slide object
 */
function switch_layer(layer, slideo) {
	if (!config[layer+"Layer"]) return;
	let oldlayer = document.getElementById(layer);
	let newlayer = document.getElementById('new'+layer);
	if (oldlayer && (slideo.element.dataset[layer] == oldlayer.dataset[layer] || "force" in oldlayer.dataset)) {
		if ((layer+"-components") in slideo) for (let comp of slideo[layer+"-components"]) comp.update(oldlayer, slideo);
		return;
	}
	newlayer.innerHTML = '';
	newlayer.removeAttribute("style");
	oldlayer.id = "temp";
	newlayer.id = layer;
	oldlayer.id = "new" + layer;
	if (slideo && slideo.element.dataset[layer]) {
		newlayer.dataset[layer] = slideo.element.dataset[layer];
		for (let comp of eval(slideo.element.dataset[layer]).toReversed()) {
			comp.add_to(newlayer, slideo);
			if (comp.isDynamic) newlayer.dataset["force"] = "true";
		}
	}
	oldlayer.style.opacity = '0';
	setTimeout(function() {
		newlayer.style.opacity = '1';
	},20);
}

/**********************************
 *       Fragment functions       *
 **********************************/
/**
 * Test if the fragment num is included in the fragspec.
 * @param {string} fragspec - A string which specifies the fragments indexes for which the slide should be displayed. It is a sequence of elementary fragment specifications separated by commas. An elementary fragment sequence is either an individual index (number), either an interval (number-number).<br/>Example : "1,4-7,12". It can also hold the special value "start".
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
 * Apply a class to the objects of a slide according to whether their fragspec includes or not the fragment with index num.
 * If num is in the fragspec of the object, the matching class is added to the object. Otherwise, it is removed.
 * @param {object} slide - DOM element for the slide
 * @param {number} num - Fragment number, last fragment if num==-1
 * @param {number} apply_start - If 1, the start fragments are applied. If -1, they are removed. Otherwise, they are left untouched.
 */
function reset_fragments(slide, num, apply_start=0) {
	Array.from(slide.querySelectorAll('[data-fragment]')).forEach(function(element) {
		let fragspec=JSON.parse(element.dataset["fragment"]);
		if (num == -1) {
			let obj = getSlideElement(slide.id);
			if (!obj) return;
			num = obj["numfragments"];
		}
		Object.getOwnPropertyNames(fragspec).forEach(function(fraglist) {
			if (fragspec[fraglist]!=null) {
				if (fraglist == "start") {
					fragspec[fraglist].forEarch(function(val) {
						if (apply_start == 1) element.classList.add(val);
						else if (apply_start == -1) element.classList.remove(val);
					});
				} else if (test_frag(fraglist,num)) {
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
 * Generic animation function
 *
 * This function executes a sequence of DOM modifications to run a transition between two slides.
 * @param {object} source - DOM object for the source slide
 * @param {object} dest - DOM object for the destination slide
 * @param {array} sequence - Array of three functions which are executed in a sequence
 * @param {function} callback_at_dest_end - Callback function used to clean up the destination DOM object after the end of the transitions
 * @param {function} callback_at_source_end - Callback function used to clean up the source DOM object after the end of the transitions
 * @param {function} callback - General callback function when all animations are over
 * @param {number} max_delay - Maximum delay of the animations. After this delay, the source and destination objectfs are cleaned up with the two corresponding callbacks.
 */
function generic_animate(source, dest, sequence, callback_at_dest_end, callback_at_source_end, callback, max_delay) {
	sequence[0]();
	// Timeouts are needed, otherwise the browser changes the order of the events
	setTimeout(function() {
		sequence[1]();
		let destfinish=false;
		let sourcefinish=false;
		// Callbacks at end of animations
		function destend(event) {
			//console.log('destend : destfinish='+destfinish+' source='+source.id+' dest='+dest.id);
			if (destfinish) return;
			destfinish=true;
			dest.removeEventListener('transitionend',destend);
			callback_at_dest_end();
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
			callback_at_source_end();
			if (source.dataset["onhide"]) window[source.dataset["onhide"]](source);
			source.style.visibility=null;
		}
		setTimeout(function() {
			// Set callbacks
			// Animation
			source.addEventListener("transitionend",sourceend);
			dest.addEventListener("transitionend",destend);
			setTimeout(function() {
				//console.log('animate : source='+source.id+' dest='+dest.id);
				dest.style.visibility='visible';
				sequence[2]();
				setTimeout(function() {
					destend();
					sourceend();
				}, max_delay);
			},20);
		},20);
	},20);
}

/**
 * Animation for a transition between two slides: this function applies CSS transitions.
 * The transition is applied by adding and removing classes to the slide, with names like 'anim-sweep-from', 'anim-sweep-to', 'anim-sweep-transitions' where 'sweep' is the name read from the name argument.
 * @param {object} source - DOM object for the old slide
 * @param {object} dest - DOM object for the new slide
 * @param {boolean} increasing - Direction of the animation
 *
 * @param {function} callback - Callback function called when the animation ends
 * @param {string} name - Name of the animation
 */
function animate_css(source,dest,increasing,callback,name) {
	generic_animate(source, dest, [
		() => dest.classList.add(increasing ? ('anim-'+name+'-from') : ('anim-'+name+'-to')),
		() => {
			source.classList.add('anim-'+name+'-transitions');
			dest.classList.add('anim-'+name+'-transitions');
		},
		() => {
			source.classList.add(increasing ? ('anim-'+name+'-to') : ('anim-'+name+'-from'));
			dest.classList.remove(increasing ? ('anim-'+name+'-from') : ('anim-'+name+'-to'));
		}],
		() => dest.classList.remove('anim-'+name+'-transitions'),
		() => {
			source.classList.remove('anim-'+name+'-transitions');
			source.classList.remove(increasing ? ('anim-'+name+'-to') : ('anim-'+name+'-from'));
		},
		callback, 1200);
}

function animate_sponge(source, dest, increasing, callback) {
	let mask = document.getElementById("tempmask");
	if (!mask) return;
	mask.innerHTML = "";
	let maskb = document.getElementById("tempmaskb");
	if (!maskb) return;
	maskb.innerHTML = "";
	let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
	rect.setAttribute("width", "100%");
	rect.setAttribute("height", "100%");
	rect.style.fill = "black";
	let rectb = rect.cloneNode(true);
	rectb.style.fill = "white";
	mask.append(rect);
	maskb.append(rectb);
	let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
	path.setAttribute("d", "m 0.148148,0.633333 c 0.0,0.0 -0.023569,-0.17619 0.047138,-0.242857 L 0.272727,0.32381 0.626263,0.138095 0.747475,0.42381 0.52862,0.328571 0.178451,0.571429 c 0.0,0.0 -0.131313,0.157143 0.026936,0.119048 L 0.447811,0.614286 0.579125,0.42381 0.888889,0.228571 0.707071,0.590476 0.582492,0.552381 0.521886,0.747619 0.03367,0.871429 0.074074,0.438095 0.050505,0.22381 0.043771,0.042857 0.424242,0.333333 0.939394,0.066667 0.956229,0.952381 0.043771,0.961905 0.047138,0.895238 0.888889,0.895238 0.43771,0.809524 0.905724,0.8 0.572391,0.704762 0.912458,0.666667 0.59596,0.614286 0.909091,0.466667 c 0.0,0.0 0.063973,-0.47619 -0.013468,-0.366667 l -0.087542,0.119048 c 0.0,0.0 0.148148,0.395238 0.030303,0.17619 L 0.713805,0.180952 c 0.0,0.0 0.292929,-0.142857 0.077441,-0.142857 L 0.424242,0.033333 c 0.0,0.0 -0.309764,0.004762 -0.313131,0.052381 -0.003367,0.042857 0.276094,0.080952 0.276094,0.080952 0.0,0.0 -0.279461,-0.066667 -0.279461,0.02381 L 0.107744,0.295238 0.531987,0.138095 0.117845,0.414286 0.077441,0.795238 0.461279,0.719048 0.252525,0.542857 0.612795,0.233333 0.397306,0.852381 0.104377,0.87619 0.023569,0.428571 0.016835,0.047619 0.373737,0.533333 0.902357,0.57619 0.299663,0.37619");
	path.style.stroke = "white";
	path.style.fill = "none";
	path.style.strokeWidth = 0.15;
	path.style.strokeDasharray = 20;
	path.style.strokeDashoffset = "20";
	mask.append(path);
	let pathb = path.cloneNode(true);
	pathb.style.stroke = "black";
	maskb.append(pathb);
	setTimeout(() => {
		generic_animate(source, dest, [
			() => {
				source.style.maskImage = "url(#tempmaskb)";
				dest.style.maskImage = "url(#tempmask)";
			},
			() => {
				path.style.transition = "stroke-dashoffset 5s linear 0s";
				pathb.style.transition = "stroke-dashoffset 5s linear 0s";
			},
			() => {
				path.style.strokeDashoffset = "0";
				pathb.style.strokeDashoffset = "0";
			}
		], () => dest.style.removeProperty("mask-image"), () => source.style.removeProperty("mask-image"), callback, 5200);
	}, 20);
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
	if (slides[destid].element.dataset["animation"] && slides[destid].element.dataset["animation"]!='') {
		fn=window["animate_"+slides[destid].element.dataset["animation"]];
		if (!fn) {
			name=slides[destid].element.dataset["animation"];
			fn=animate_css;
		} 
	} else fn=animate_none;
	if (dest.id==source.id) fn=animate_none;
	fn(source,dest,increasing,callback,name);
}

/**********************************
 *        Slide components        *
 **********************************/
/**
 * Abstract base class for slides components
 *
 * @class Component
 */
class Component {
	constructor() {
		if (this.constructor == Component)  {
			throw new Error("Component is an abstract class and cannot be instantiated.");
		}
		this.componentName = null; // Class name of the component
	}

	/**
	 * Add the component to the slide object
	 *
	 * @param {object} slide - DOM object for the slide
	 * @param {object} slideo - Slide object
	 */
	add_to(slide, slideo=null) {
	}

	/**
	 * Update the component in a slide.
	 * This function should only be used for background and foreground slides, where the component may stay during the whole slideshow but has to be updated according to the progress.
	 *
	 * @param {object} slide - DOM object for the slide
	 * @param {object} slideo - Slide object
	 */
	update(slide, slideo=null) {
	}
}

// Backgrounds
class ImageBackgroundObject extends Component {
	/**
	 * Constructor of the background object
	 *
	 * @param {object} path - Either a string with the URL of the background image, or an array of strings from which the image is randomly chosen
	 */
	constructor(path) {
		super()
		this.componentName = 'component-imagebackground';
		if (typeof path === 'string' || path instanceof String) path = [ path ];
		this.path = path.map((el)=>(el.startsWith('/')) ? el : (meta.template_path + el));
		if (this.path.length>1) this.isDynamic = true;
	}

	add_to(slide, slideo=null) {
		super.add_to(slide, slideo);
		let url = this.path.length==1 ? this.path[0] : this.path[Math.floor(Math.random()*this.path.length)];
		slide.style.backgroundImage = 'url(' + url + ')';
	}

}
function ImageBackground(path) {return new ImageBackgroundObject(path);}

class ColorBackgroundObject extends Component {
	/**
	 * Constructor of the background object
	 *
	 * @param {string} color - Name of a color (as supported by CSS)
	 */
	constructor(color) {
		super()
		this.componentName = 'component-colorbackground';
		this.background = color;
	}

	add_to(slide, slideo=null) {
		super.add_to(slide, slideo);
		slide.style.backgroundColor = this.background;
	}

}
function ColorBackground(color) {return new ColorBackgroundObject(color);}

// Elements
class SimpleElementObject extends Component {
	/**
	 * Constructor of a simple element object
	 *
	 * @param {string} script - Javascript expression which returns the HTML code of a single element
	 */
	constructor(script) {
		super()
		this.componentName = 'component-simpleelement';
		this.code = script;
	}

	add_to(slide, slideo=null) {
		super.add_to(slide, slideo);
		let parser = new DOMParser();
		let doc = parser.parseFromString(this.code, "text/html");
		slide.prepend(...doc.body.children);
	}
}
function SimpleElement(script) {return new SimpleElementObject(script);}

// Navigation bars
class MinitocObject extends Component {
	constructor(pconfig) {
		super()
		this.componentName = 'component-minitoc';
		this.config = pconfig;
	}

	/**
	 * Navigation bar on top of the slide, populated with small circles representing the slides, and with the names of sections..
	 * A new section is started by a slide with a <tt>data-section</tt> attribute. This attribute stands for the title of the new section.
	 * A <tt>data-ssection</tt> attribute may be added to provide a short name for the title of the section. In that case, the short title is used in the navigation bar.
	 * A new subsection is started by a slide with a <tt>data-subsection</tt> attribute. This attribute stands for the title of the new subsection.
	 *
	 * @param {object} slide - DOM object for the slide where the component has to be added
	 * @param {object} slideo - Slide object
	 */
	add_to(slide, slideo=null) {
		super.add_to(slide, slideo);
		// Add the navigation bar to the slide
		let nav=document.createElement('nav');
		nav.classList.add(this.componentName);
		slide.insertAdjacentElement('afterbegin',nav);
		let spart = generate_html_from_structure(structure[0].parts, null, slideo.id, (entry) => entry.short ? entry.short : entry.name);
		if (spart) nav.append(spart);
	}

	/**
	 * Update the navigation bar: the new slide is represented by a filled circle, the old slide is reverted to its original state. The section and subsection of the new slide also get new styles by adding the <tt>currentSection</tt> and <tt>currentSubsection</tt> classes to them.
	 *
	 * @param {object} slide - DOM object for the slide where the component has to be updated
	 * @param {object} slideo - Slide object
	 */
	update(slide, slideo=null) {
		super.update(slide, slideo);
		let nav = slide.getElementsByClassName(this.componentName)[0];
		Array.from(nav.getElementsByTagName('li')).forEach(element => {
			element.classList.remove('current');
		});
		Array.from(nav.querySelectorAll('[href="#'+slideo['id']+'"]')).forEach(function(element) {
			element.parentNode.classList.add("current");
		});
	}
}
function Minitoc(pconfig) {return new MinitocObject(pconfig);}

// Footers
class ClassicFooterObject extends Component {
	constructor(pconfig) {
		super()
		this.componentName = 'component-classicfooter';
		this.config = pconfig;
	}

	add_to(slide, slideo) {
		super.add_to(slide, slideo);
		let footer=document.createElement('footer');
		footer.classList.add(this.componentName);
		footer.innerHTML='<div>'+meta["date"]+'</div><div>'+meta["title"]+'</div><div>'+slideo["num"]+'/'+(slides.length-1)+'</div>';
		slide.insertAdjacentElement('afterbegin',footer);
	}

	/**
	 * Update the footer when a new slide is displayed. The function change the page index in the footer
	 *
	 * @param {object} slide - DOM object for the slide where the component has to be updated
	 * @param {object} slideo - Slide object
	 */
	update(slide, slideo) {
		super.update(slide, slideo);
		let footer=slide.getElementsByClassName(this.componentName)[0];
		footer.querySelector('div:last-child').innerHTML=slideo["num"]+'/'+(slides.length-1);
	}
}
function ClassicFooter(pconfig) {return new ClassicFooterObject(pconfig);}

/**********************************
 *         Outline slides         *
 **********************************/
/**
 * Browse structure using depth-first run and execute callbacks for each heading
 *
 * @param {object} struct - Structure to browse
 * @param {array} tags - Array of tags to include in the outline, null if all tags must be included
 * @param {function} callback - Callback function to execute on each entry. The function takes one argument: the entry as stored in the struct array
 */
function execute_structure(struct, tags=null, callback) {
	if (!struct) return;
	for (const entry of struct) if (!tags || tags.includes(entry.element.tagName)) {
		callback(entry);
		execute_structure(entry.parts, tags, callback);
	}
}

/**
 * Generate a HTML list from the outline structure
 *
 * @param {object} struct - Structure to browse
 * @param {array} tags - Array of tags to include in the outline, null if all tags must be included
 * @param {string} section - Id of the section to highlight
 * @param {function} custom_name - Function to generate a custom title for an element. It takes one parameter which is the structure entry. It returns the HTML string that has to be displayed in the outline. When it returns an array of two strings, the second one is used when the slide is the current one.
 * @returns {object} - HTML list
 */
function generate_html_from_structure(struct, tags=null, section=null, custom_name=(entry)=>entry.name) {
	if (!struct || struct.length==0) return;
	let ul = document.createElement("ul");
	for (const entry of struct) if (!tags || tags.includes(entry.element.tagName)) {
		let li = document.createElement("li");
		li.classList.add(entry.element.tagName.toLowerCase());
		let sname = custom_name(entry);
		if (Array.isArray(sname)) sname = (section == entry.element.id) ? sname[1] : sname[0];
		let a = document.createElement("a");
		a.href = "#" + entry.target.id;
		a.innerHTML = sname;
		li.append(a);
		if (section == entry.target.id) li.classList.add("current");
		let spart = generate_html_from_structure(entry.parts, tags, section, custom_name); 
		if (spart) li.append(spart);
		ul.appendChild(li);
	}
	return (ul.childElementCount>0) ? ul : null;
}


/**
 * Abstract base class for outline slides
 *
 * @class OutlineSlide
 */
class OutlineSlide {
	static index = 0; 	// Static index of the outline, used to give unique IDs to slides
	static outline_title = {
		"fr" : "Sommaire",
		"en" : "Outline"
	};

	constructor() {
		if (this.constructor == OutlineSlide)  {
			throw new Error("Component is an abstract class and cannot be instantiated.");
		}
	}

	/**
	 * Compose an outline slide. 
	 *
	 * @param {array} entry - Structure of the current heading, an entry in the {@link structure} array
	 * @param {array} structure - Structure of the full slideshow, usually the {@link structure} array
	 * @returns {object} - slide object adapted for the {@link slides} array, with an additional entry 'element' holding a reference to the DOM element
	 */
	compose(entry, structure) {
		throw new Error("Method compose is not implemented.")
	}
}

/**
 * Classic model of outline slide: generic title and list of sections and subsections
 */
class ClassicOutlineSlideObject extends OutlineSlide {
	/**
	 * Compose an outline slide. 
	 *
	 * @param {array} entry - Structure of the current heading, an entry in the {@link structure} array
	 * @param {array} structure - Structure of the full slideshow, usually the {@link structure} array
	 * @returns {object} - slide object adapted for the {@link slides} array, with an additional entry 'element' holding a reference to the DOM element
	 */
	compose(entry, structure) {
		let h = document.createElement("h1");
		const lang = document.documentElement.lang;
		h.textContent = OutlineSlide.outline_title[lang ? lang : "en"];
		entry.target.append(h);
		let outline = document.createElement("div");
		outline.classList.add("content")
		entry.target.append(outline);
		let spart = generate_html_from_structure(structure[0].parts, ['H2', 'H3'], entry.target.id);
		if (spart) outline.append(spart);
	}
}
function ClassicOutlineSlide() {return new ClassicOutlineSlideObject();}

/**
 * Another model of outline slide: only the title of the current section and the next level headings
 */
class FocusOutlineSlideObject extends OutlineSlide {
	/**
	 * Compose an outline slide. 
	 *
	 * @param {array} entry - Structure of the current heading, an entry in the {@link structure} array
	 * @param {array} structure - Structure of the full slideshow, usually the {@link structure} array
	 * @returns {object} - slide object adapted for the {@link slides} array, with an additional entry 'element' holding a reference to the DOM element
	 */
	compose(entry) {
		let h = document.createElement("h1");
		h.innerHTML = entry.name;
		entry.target.append(h);
		let outline = document.createElement("div");
		outline.classList.add("content")
		entry.target.append(outline);
		let spart = generate_html_from_structure(entry.parts, ['H'+(entry.level+1).toString()], entry.target.id);
		if (spart) outline.append(spart);
	}
}
function FocusOutlineSlide() {return new FocusOutlineSlideObject();}

/**********************************
 *        Printing management     *
 **********************************/
/**
 * Make thumbnails out of the slides. The function scales all slides, displays their final fragments, and places them of a flexbox div.
 */
function open_print_view() {
	if (outlinestyle) return;
	// Wrap all slides in new divs to put them in a flexbox layout, and make them thumbnails
	for (let el of document.querySelectorAll("body > section")) {
		if (el.classList.contains('thumbnail')) continue;
		el.classList.add('thumbnail');
		reset_fragments(el, -1);
		let wrapper = document.createElement('div');
		wrapper.classList.add('wthumb');
		el.parentNode.insertBefore(wrapper, el);
		wrapper.appendChild(el);
	}
	let tl = document.createElement("div");
	tl.id = "thumblayer";
	for (let el of document.querySelectorAll("body > div.wthumb, body > h1, body > h2, body > h3, body > h4, body > h5, body > h6")) tl.appendChild(el);
	document.body.appendChild(tl);
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
	if (outlinestyle) return;
	// Unwrap all slides from their flexbox layout
	document.querySelectorAll('div.wthumb').forEach(function(element) {
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
	for (let el of document.querySelectorAll("body > section")) {
		if (el.classList.contains('thumbnail')) continue;
		el.classList.add('thumbnail');
		let wrapper = document.createElement('div');
		wrapper.classList.add('wthumb');
		el.parentNode.insertBefore(wrapper, el);
		wrapper.appendChild(el);
		wrapper.addEventListener('click',function() {
			close_overview(getSlideIndex(el.id));
		});
	}
	let tl = document.createElement("div");
	tl.id = "thumblayer";
	for (let el of document.querySelectorAll("body > div.wthumb, body > h1, body > h2, body > h3, body > h4, body > h5, body > h6")) tl.appendChild(el);
	document.body.appendChild(tl);
	let wrapper=slideo.parentNode;
	// Scroll the overview div so that the current slide is visible
	tl.scrollTop=tl.offsetTop+wrapper.offsetTop;
	wrapper.style.zIndex='30';
	let newpos=wrapper.getBoundingClientRect();	// Remember the new position of the current slide
	//let deltal=newpos.left-oldpos.left;
	//let deltat=newpos.top-oldpos.top;
	//let deltaw=newpos.width/oldpos.width-1;
	//let deltah=newpos.height/oldpos.height-1;
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

/**
 * Close the overview. This function puts all slides to their original states, removes the divs created to make the overview, and animates the selected slide while it grows to the whole screen.
 * @param {number} newslidenum - Selected slide which shall become the active slide when the overview is closed. If null, the previously active slide remains active.
 */
function close_overview(newslidenum=null) {
	function remove_overview_wrapper() {
		document.querySelectorAll('div.wthumb').forEach(function(element) {
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
	}
	on_overview=false;
	getSlide(overview_curslide).classList.remove('targetted');	// Remove the visual style of the targetted slide in the overview
	if (newslidenum==null) newslidenum=curslide;	// If no new slide was selected, the previously active slide will be animated to cover the whole screen
	let slideo=getSlide(newslidenum);
	slideo.parentNode.style.zIndex='30';
	let oldpos=slideo.getBoundingClientRect();	// Remember the current position of the selected slide
	//let deltal=oldpos.left;
	//let deltat=oldpos.top;
	//let deltaw=oldpos.width/window.innerWidth-1;
	//let deltah=oldpos.height/window.innerHeight-1;
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
				newslideo.style.visibility=null;
				reset_fragments(slideo,0);
				update_navigation_bar(newslidenum,slide);
				update_footer(newslidenum);
				for (let l of ["background", "foreground"]) switch_layer(l, slides[newslidenum]);
			} else {
				let e=new Event("hashchange",{bubbles:false, cancelable:true})
				window.dispatchEvent(e);
			}
		},{capture:false,once:true});
		setTimeout(function() {
			slideo.style.transform='translate(0px,0px) scale(1,1)';
		},20);
	},20);
}

/**********************************
 *        Slide movement          *
 **********************************/
/**
 * This function is executed when the user performs an action to call for the next fragment (swipe towards left side, right button).
 */
function to_next_fragment() {
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
 * This function is executed when the user performs an action to call for the previous fragment (swipe towards right side, left button).
 */
function to_previous_fragment() {
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
 * This function is executed when the user performs an action to call for the next slide (swipe towards up side, down button).
 */
function to_next_slide() {
	if (!on_overview) {
		let newslide=curslide;
		let newfragment=curfragment;
		if (curslide<slides.length-1) {
			newslide++;
			newfragment=0;
			switch_slide(newslide,newfragment);
		}
	}
}

/**
 * This function is executed when the user performs an action to call for the previous slide (swipe towards bottom side, up button).
 */
function to_previous_slide() {
	if (!on_overview) {
		let newslide=curslide;
		let newfragment=curfragment;
		if (curslide>0) {
			newslide--;
			newfragment=slides[newslide]['numfragments'];
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
			reset_fragments(newslideo, 0, 1); 
		} else reset_fragments(newslideo, slides[newslidenum]['numfragments'], -1);
		apply_animation(slideo,newslideo,increasing,function() {
			reset_fragments(slideo, 0, -1);
			animate_fragment(curslide,0,curslide>slide);
		});
		for (const layer of ["background", "foreground"]) switch_layer(layer, slides[newslidenum]);
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
	if (!xDown || !yDown || !xUp || !yUp) return;
	if (Math.abs(xUp-xDown)>Math.abs(yUp-yDown)) {
		if (Math.abs(xUp-xDown)>200) {
			if (xUp>xDown) to_previous_fragment(); else to_next_fragment();
		}
	} else {
		if (Math.abs(yUp-yDown)>200) {
			if (yUp>yDown) to_previous_slide(); else to_next_slide();
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
	Array.from(wnotes.document.getElementsByTagName('h1,h2,h3,h4,h5,h6')).forEach(function(element) {
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
 *   Pre-processing of slides     *
 **********************************/
/** Create the automatically generated slides (title and outlines) and generate the structure
 */
function create_structure() {
	// Create title slide and title heading
	let tslide = document.getElementById("title");
	if (!tslide) {
		let h = document.createElement("h1");
		h.innerHTML = (meta.title ? meta.title : "");
		document.body.insertAdjacentElement("afterbegin", h);
		tslide = document.createElement("section");
		tslide.id = "title";
		tslide.innerHTML = `
			<h1><span data-variable="title">${meta.title ? meta.title : ""}</span><br/><span class="subtitle" data-variable="subtitle">${meta.subtitle ? meta.subtitle : ""}</span></h1>
			<div class="authordate"><span data-variable="author">${meta.authors ? meta.authors : ""}</span><br/><time data-variable="date">${meta.date}</time></div>
		`;
		document.body.insertAdjacentElement("afterbegin", tslide);
	}

	// Generate structure and create placeholder outline slides (we can't create the full outline slides at this stage because the slides don't have any ids, thus we can't link to them)
	let parents = [structure];
	Array.from(document.querySelectorAll(Array.from({length: 6}, (_, i) => 1+i).map((val) => "body > h" + val.toString()).join() + ', body > section:not(#title)')).forEach(function(el) {
		let entry = {"element": el};
		if (el.tagName == 'SECTION') {
			entry.level = parents.length;
			entry.name = el.querySelector('h1').innerHTML;
			entry.target = el;
		} else {
			entry.name = el.innerHTML;	
			entry.level = Number.parseInt(el.tagName.substring(1));
			entry.parts = [];
			let outlinestyle = el.dataset['outline'];
			if (!outlinestyle) outlinestyle = window.getComputedStyle(el).getPropertyValue('--outline');
			if (outlinestyle) {
				let oslide = document.createElement("section");
				oslide.classList.add("outline");
				oslide.dataset["level"] = entry.level;
				el.insertAdjacentElement('afterend', oslide);
				entry.target = oslide;
			} else {
				let sibling = entry.element;
				do { sibling = sibling.nextElementSibling; } while (sibling && (sibling.tagName != 'SECTION' || sibling.classList.contains("outline")));
				if (sibling) entry.target = sibling;
			}
			if (el.id && entry.target) {
				let save_id = el.id;
				el.removeAttribute("id");
				entry.target.id = save_id;
			}
			parents[entry.level] = entry.parts;
			parents.length = entry.level + 1;
		}
		if ("short" in el.dataset) entry["short"] = el.dataset["short"];
		if (entry.level > parents.length) {
			for (const i=parents.length ; i<entry.level ; ++i) {
				parents.push({"name": "", "parts": []});
			}
		}
		entry.parent = parents[entry.level-1];
		parents[entry.level-1].push(entry);
	});

	// Create background and foreground layers if they are not disabled and they are not provided
	for (const layer of ['foreground', 'background']) if (config[layer+"Layer"]) {
		let layers = document.getElementById(layer);
		if (!layers) {
			layers = document.createElement('div');
			layers.id = layer;
			document.body.insertAdjacentElement('afterbegin', layers);
		}
		let newlayers = layers.cloneNode(true);
		newlayers.id = 'new' + layer;
		document.body.insertAdjacentElement('afterbegin', newlayers);
	}
}

function quote(str) {
	return str.replace(/(?<!\\\\)'/g, '"').replace(/\\\\'/g, "'");
}

/** Read CSS properties and add them to data attributes
 *
 * @param {object} element - Element on which the function should be applied
 */
function css_to_data(element) {
	let properties = window.getComputedStyle(element);
	for (const prop of ["background", "foreground", "animation", "components", "autofragment"]) {
		if (!element.dataset[prop]) {
			let val = properties.getPropertyValue('--'+prop);
			if (val) val = val.replace(/^"|"$/g, "");
			if (val && val != "") element.dataset[prop] = quote(val);
		} else element.dataset[prop] = quote(element.dataset[prop]);
	}
}

/** Pre-process the HTML code. This function does several things:
 *	<ul>
 *		<li>it replaces single quotes by double quotes in JSON attributes</li>
 *		<li>it replaces parameterized text by values obtained from the HTML request command or an external configuration file</li>
 *	</ul>
 */
function process_slideshow() {
	// Replace quotes in JSON attributes
	for (const val of ['fragment','fanim','autofragment','background','foreground','animation','components']) {
		Array.from(document.querySelectorAll('[data-'+val+']')).forEach(function(element) {
			element.dataset[val]=quote(element.dataset[val]);
		});
	}

	// Replace CSS properties with the corresponding data attributes
	document.body.querySelectorAll("section, section *").forEach(css_to_data);

	// Read some configuration options from the CSS or the inline document
	// Then update it with user-provided configuration options
	let properties = window.getComputedStyle(document.body);
	if ("background-layer" in document.body.dataset) config.backgroundLayer = true;
		else config.backgroundLayer = properties.getPropertyValue("--background-layer") == '"active"' ? true : false;
	if ("foreground-layer" in document.body.dataset) config.foregroundLayer = true;
		else config.foregroundLayer = properties.getPropertyValue("--foreground-layer") == '"active"' ? true : false;

	// Replace parameterized text
	Array.from(document.querySelectorAll('[data-variable]')).forEach(function(span) {
		if (span.dataset['variable'] in parameters) span.innerHTML=parameters[span.dataset['variable']];
	});
}

/**
 * Pre-process a slide and generate an object describing it, suited for the {@link slides} array
 * @param {object} element - HTML slide element
 * @returns {object} - Object describing the slide
 */
function process_slide(element) {
	// Generate fragment specification while processing auto-fragments
	function generate_fragment(element, i, fragbefore, fragafter, fragcurrent, fraganim) {
		let fragmentp={};
		if (i>0 && fragbefore) {
			if (i>1) fragmentp['0-'+(i-1).toString()]=fragbefore;
			else fragmentp['0']=fragbefore;
		}
		if (fragcurrent) fragmentp[i.toString()]=fragcurrent;
		if (fragafter) fragmentp[(i+1).toString()+'-']=fragafter;
		element.dataset['fragment']=JSON.stringify(fragmentp);
		if (fraganim!=null) {
			let fragmenta={};
			fragmenta[i.toString()]=fraganim;
			element.dataset['fanim']=JSON.stringify(fragmenta);
		}
	}
	// Create slide object and get properties
	let slide = {
		'id': element.id,
		'element': element
	};
	// Autogenerate fragments based on slide section <tt>autofragment</tt> attribute
	if ("autofragment" in element.dataset) {
		let fragspec = JSON.parse(element.dataset["autofragment"]);
		if (fragspec.length>1) {
			let fragbefore = ("before" in fragspec[1]) ? fragspec[1]["before"] : ['invisible'];
			let fragafter = ("after" in fragspec[1]) ? fragspec[1]["after"] : null;
			let fragcurrent = ("current" in fragspec[1]) ? fragspec[1]["current"] : null;
			let fraganim = ("animation" in fragspec[1]) ? fragspec[1]["animation"] : null;
			element.querySelectorAll(fragspec[0]).forEach(function(el, i) {
				generate_fragment(el, i, fragbefore, fragafter, fragcurrent, fraganim);
			});
		}
	} else { // Otherwise autogenerate fragments based on HTML elements <tt>autofragment</tt> attributes
		element.querySelectorAll("[data-autofragment]").forEach(function(obj, i) {
			let fragspec = JSON.parse(obj.dataset["autofragment"]);
			let fragbefore = ("before" in fragspec) ? fragspec["before"] : ['invisible'];
			let fragafter = ("after" in fragspec) ? fragspec["after"] : null;
			let fragcurrent = ("current" in fragspec) ? fragspec["current"] : null;
			let fraganim = ("animation" in fragspec) ? fragspec["animation"] : null;
			generate_fragment(obj, i, fragbefore, fragafter, fragcurrent, fraganim);
		});
	}
	// Count fragments in slide by first parsing the <tt>data-fragment</tt> and <tt>data-fanim</tt> attributes of objects. The total number of fragments is the highest fragment number referenced by those attributes.
	slide['numfragments'] = 0;
	if (element.dataset['numfragment']) slide['numfragments'] = parseInt(element.dataset["numfragment"]);
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
		slide['numfragments'] = max;
	}
	return slide;
}

/**
 * Fill out outline slides
 */
function compose_outline_slides() {
	execute_structure(structure, ["H1", "H2", "H3", "H4", "H5", "H6"], function(entry) {
		if (entry.target) {
			let outlinestyle = entry.element.dataset['outline'];
			if (!outlinestyle) outlinestyle = window.getComputedStyle(entry.element).getPropertyValue('--outline').replace(/^"|"$/g, "");
			if (!outlinestyle) return;
			let element = window[outlinestyle]();
			element.compose(entry, structure);
			css_to_data(entry.target);
		}
	});
}

/**
 * Add the components to a slide
 *
 * @param {object} slideo - Slide object, relative to the {@link slides} array
 */
function add_components(slideo) {
	if (slideo.element.dataset["components"]) for (const comp of eval(slideo.element.dataset["components"])) {
		comp.add_to(slideo.element, slideo);
		if (!("slide-components" in slideo)) slideo["slide-components"] = [];
		slideo["slide-components"].push(comp);
	}
	if (slideo.element.dataset["background"]) for (const comp of eval(slideo.element.dataset['background'])) {
		if (config.backgroundLayer) {
			if (!("background-components" in slideo)) slideo["background-components"] = [];
			slideo["background-components"].push(comp);
		}
		else comp.add_to(slideo.element, slideo);
	}
	if (slideo.element.dataset["foreground"]) for (const comp of eval(slideo.element.dataset['foreground'])) {
		if (config.foregroundLayer) {
			if (!("foreground-components" in slideo)) slideo["foreground-components"] = [];
			slideo["foreground-components"].push(comp);
		}
		else comp.add_to(slideo.element, slideo);
	}
}

/**
 * Generate the array of slides {@link slides}
 */
function prepare_slides() {
	// Prepare array of slides
	Array.from(document.getElementsByTagName('section')).forEach(function(element,index) {
		// Give an id to the slide
		let id="slide-"+(index+1);
		if (!element.id) element.id=id;
	});
	if ('outline' in parameters) {
		for (let slidespec of parameters['outline']) {
			let slidee;
			if ('html' in slidespec) { // Generate slide if it does not exist
				let slidee=document.createElement('section');
				slidespec['id']='slide-'+Math.random().toString().substring(2).replace(/./g,s=>String.fromCharCode(s.charCodeAt(0)+17));
				slidee.id=slidespec['id'];
				slidee.innerHTML=slidespec['html'];
			} else { // Overrides attributes with the one given as parameters
				slidee = document.getElementById(slidespec['id']);
				for (const att in slidespec) if (att!='id' && att!='html') {
					slidee.dataset[att.replace(/^data-/, '')] = from_string(slidespec[att]);
				}
			}
			let slideo=process_slide(slidee);
			// Insert slide in array
			if ('html' in slidespec) document.body.appendChild(slidee);
			slides.push(slideo);
		}
	} else {
		// Add all slides to the array
		Array.from(document.getElementsByTagName('section')).forEach(function(element,index) {
			// Test if the slide is in the slideshow subset, otherwise skip it
			if ('subset' in parameters && parameters['subset'].length>0) {
				let ok=false;
				if (parameters['subset'].includes(''+(index+1)) || parameters['subset'].includes(element.id)) ok=true;
				if (!ok && 'groups' in element.dataset) for (const group of element.dataset['groups'].split(',')) {
					if (parameters['subset'].includes(group)) ok=true;
					break;
				}
				if (!ok) return;
			}
			// Test if the slide is in the slideshow hidden subset, if this is the case, skip it
			if ('hidden' in parameters && parameters['hidden'].length>0 && (parameters['hidden'].includes(''+(index+1)) || parameters['hidden'].includes(element.id))) return;
			// Insert slide in array
			let slideo = process_slide(element);
			slides.push(slideo);
		});
	}
	let tslide = document.getElementById("title");
	if (tslide) css_to_data(tslide);
	compose_outline_slides(); // Fill out outline slides
	slides.forEach(function(slideo, num) {
		slideo["num"] = num; // Fill out slides numbers
		add_components(slideo); // Add components to all slides
	}); 
}

/**********************************
 *       Handler functions        *
 **********************************/
document.addEventListener("DOMContentLoaded",function(event) {
	// Fill document head
	let head = document.getElementsByTagName('head')[0];
	if ("title" in meta && head.getElementsByTagName('title').length == 0) {
		let title = document.createElement('title');
		title.textContent = meta.title;
		head.prepend(title);
	}
	if ("description" in meta && head.querySelector('meta[name="description"]')==null) {
		let bmeta = document.createElement('meta');
		bmeta.name = "description";
		bmeta.content = meta.description;
		head.prepend(bmeta);
	}

	// Read some attributes
	let ss = head.querySelector('link[rel="stylesheet"]');
	if (ss) meta.template_path = ss.getAttribute("href").replace(/[^\/]*$/, "");

	// Initialize metadata
	if (!("date" in meta)) {
		let d = new Date().toLocaleDateString(document.documentElement.lang,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
		meta["date"] = d[0].toUpperCase()+d.slice(1);
	}

	// Read query string
	let querys=decodeURI(location.search.substring(1)).split('&');
	for (let i=0;i<querys.length;++i) {
		let varval=querys[i].split('=');
		parameters[varval[0]]=varval[1];
	}
	if ('subset' in parameters && parameters['subset']!='') parameters['subset']=parameters['subset'].split(',');
	if ('hidden' in parameters && parameters['hidden']!='') parameters['hidden']=parameters['hidden'].split(',');

	// Disable outline stylesheet
	for (let i=0;i<document.styleSheets.length;++i) if (document.styleSheets[i].title=='outlinesheet') document.styleSheets[i].disabled=true;

	// Preprocess the document
	process_slideshow();
	create_structure();

	// Load external SVG files
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
	prepare_slides(parameters); // Prepare the array of slides
	if (location.hash=='') location.hash='#title';

	// Hash change handler
	window.addEventListener('hashchange',function() {
		if (program_hashchange) {
			program_hashchange=false;
		} else {
			let slide=curslide;
			curslide=getSlideIndex(location.hash.substring(1));
			let curslideo=getSlide(curslide);
			for (const layer of ["background", "foreground"]) switch_layer(layer, slides[curslide]);
			reset_fragments(curslideo,0);
		}
		if (wnotes!=null && !wnotes.closed) {
			wnotes.location.hash=location.hash;
			wnotes.ratio=curslide/slides.length;
		}
		if (!slaveMode && syncUrl && syncName) {
			signal(syncUrl,syncName,location.hash);
		}
	});

	// Get current slide and force hashchange event
	curslide=parseInt(getSlideIndex(location.hash.substring(1)));
	for (const layer of ["background", "foreground"]) switch_layer(layer, slides[curslide]);
	if (location.hash != "#title") setTimeout(()=>location.hash = location.hash,20); // Force hash change event to make CSS :target selector work on dynamically-generated IDs

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
		if (!on_overview && e.key=='p') toggle_outline(); // 'p'
		if (outlinestyle) return;
		let newslide=curslide;
		let newfragment=curfragment;
		switch (e.key) {
			case "ArrowRight":case " ":	// Right arrow, Space
				if (!on_overview) {
					to_next_fragment();
				} else {
					if (overview_curslide<slides.length-1) {
						getSlide(overview_curslide).classList.remove('targetted');
						do {
							++overview_curslide;
						} while (overview_curslide<slides.length-1 && getSlide(overview_curslide).id=="outline");
						let oslideo=getSlide(overview_curslide);
						oslideo.classList.add('targetted');
						oslideo=oslideo.parentNode;
						let tl = document.getElementById("thumblayer");
						if (oslideo.offsetTop+oslideo.offsetHeight>tl.offsetHeight+tl.scrollTop) tl.scrollTop+=tl.offsetHeight/2;
					}
				}
				break;
			case "ArrowLeft":	// Left arrow
				if (!on_overview) {
					to_previous_fragment();
				} else {
					if (overview_curslide>0) {
						getSlide(overview_curslide).classList.remove('targetted');
						do {
							--overview_curslide;
						} while (overview_curslide>0 && getSlide(overview_curslide).id=="outline");
						let oslideo=getSlide(overview_curslide);
						oslideo.classList.add('targetted');
						oslideo=oslideo.parentNode;
						let tl = document.getElementById("thumblayer");
						if (oslideo.offsetTop<tl.scrollTop) tl.scrollTop-=tl.offsetHeight/2;
					}
				}
				break;
			case "ArrowUp":	// Up arrow
				if (!on_overview) {
					to_previous_slide();
				}
				break;
			case "ArrowDown":	// Down arrow
				if (!on_overview) {
					to_next_slide();
				}
				break;
			case "PageUp": // Page up
				if (!on_overview) {
					if (newslide>0) newslide--;
					while (newslide>0 && !slides[newslide].element.classList.contains("outline")) newslide--;
					newfragment=0;
					switch_slide(newslide,newfragment);
				}
				break;
			case "PageDown": // Page down
				if (!on_overview) {
					if (newslide<slides.length-1) newslide++;
					while (newslide<slides.length-1 && !slides[newslide].element.classList.contains("outline")) newslide++;
					newfragment=0;
					switch_slide(newslide,newfragment);
				}
				break;
			case "Home": // Home
				if (!on_overview) {
					newslide=0;
					newfragment=0;
					switch_slide(newslide,newfragment);
				}
				break;
			case "End": // End
				if (!on_overview) {
					newslide=slides.length-1;
					newfragment=slides[newslide]['numfragments'];
					switch_slide(newslide,newfragment);
				}
				break;
			case "o":	// 'o'
				if (!on_overview) {
					open_overview();
				} else {
					close_overview();
				}
				break;
			case "Enter":	// enter
				if (on_overview) close_overview(overview_curslide);
				break;
			case "n":	// 'n'
				if (wnotes==null || wnotes.closed) {
					wnotes=window.open(document.documentElement.dataset['notes']+"?origin="+encodeURIComponent(location.href)+"#"+getSlide(curslide).id,"Notes","left=0, top=0, status=no, menubar=no, toolbar=no, location=no, directories=no, copyhistory=no, width='+w+', height='+h', fullscreen=yes");
					wnotes.onload=onNotesLoaded;
				} else {
					wnotes.close();
				}
				break;
			case ",":	// ','
				if (wnotes!=null && !wnotes.closed) {
					let obj=wnotes.document.getElementById('notes');
					obj.scrollTop+=wnotes.screen.height/2;
				}
				break;
			case ";":	// ';'
				if (wnotes!=null && !wnotes.closed) {
					let obj=wnotes.document.getElementById('notes');
					obj.scrollTop-=wnotes.screen.height/2;
				}
				break;
			case "s":case "S":	// 's'
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
							obj.addEventListener('keydown',(evt) => {evt.stopPropagation()},false);
							obj.addEventListener('keyup',getSyncName,false);
							obj.focus();
						},20);
					}
				}
				break;
		}
	});

}

/**********************************
 *     Template initializer       *
 **********************************/
/**
 * Initialize the template and slideshow metadata.
 * @param {string} pmeta - Metadata of the slideshow. This dictionary should contain at least the following values: title, authors, date, description.
 */
function initialize(pmeta) {
	meta = pmeta;
}
