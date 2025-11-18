class InerisFooterObject extends Component {
	constructor(pconfig) {
		super()
		this.componentName = 'component-inerisfooter';
		this.config = pconfig;
	}

	add_to(slide, slideo) {
		super.add_to(slide, slideo);
		let footer=document.createElement('footer');
		footer.classList.add(this.componentName);
		footer.innerHTML="<div>Institut national de l'environnement industriel et des risques</div><div>"+slideo["num"]+'/'+(slides.length-1)+'</div>';
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
function InerisFooter(pconfig) {return new InerisFooterObject(pconfig);}

