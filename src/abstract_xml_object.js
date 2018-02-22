function AbstractXMLObject(objectType, editor) {
	this.editor = editor;
	this.guiEditor = this.editor.guiEditor;
	this.objectType = objectType;

	// ID of the dom node for this element
	this.domNodeID = null;
	// dom node for this element
	this.domNode = null;
	// XMLElement which is the parent of this element
	this.parentElement = null;
	// Main input for text node of this element
	this.textInput = null;
}

// Generates input fields for elements and attributes, depending on the type of value in the definition
// inputID - id attribute for the new input field
// startingValue - initial value for the new input
// appendTarget - DOM element which the new input will be append to
AbstractXMLObject.prototype.createElementInput = function (inputID, startingValue, appendTarget){
	if (startingValue === undefined)
		startingValue = "";
	var input = null;
	var $input = null;
	// Select input for fields with a predefined set of values
	if (this.objectType.values && this.objectType.values.length > 0){
		var selectionValues = this.objectType.values;
		input = document.createElement('select');
		input.id = inputID;
		input.readOnly = !this.editor.options.enableEdit; // Added readonly behaviour 
		input.className = 'xml_select';
		appendTarget.appendChild(input);
		
		for (var index in selectionValues) {
			var selectionValue = selectionValues[index];
			var option = new Option(selectionValue.toString(), selectionValue);
			input.options[index] = option;
			if (startingValue == selectionValue) {
				input.options[index].selected = true;
			}
		}
		if ((startingValue == " ") || (startingValue == ""))
			input.selectedIndex = -1;
		$input = $(input);
	} // Text area for normal elements and string attributes
	else if ((this.objectType.text && (this.objectType.type == 'string' || this.objectType.type == 'mixed')) 
			|| this.objectType.attribute || this.objectType.cdata || this.objectType.comment){
		input = document.createElement('textarea');
		input.id = inputID;
		input.rows = 1; // added start size of 1 row
		input.style.height = '18px'; // Predefined height for 1 row. Will be expanded using jQuery.autosize
		input.readOnly = !this.editor.options.enableEdit; // Added readonly behaviour
		input.className = 'xml_textarea';
		// Text areas start out with a space so that the pretty formating won't collapse the field
		input.value = startingValue? startingValue : " ";
		// Set width of generated fields manually.
		if (this.objectType.attribute && startingValue) {
			var len = startingValue.length * 10;
			if (len < 80) { len = 80; }
			else if (len > 600) { len = 600; }
			if (len != -1) {
				input.style.width = len + "px";
			}
		}
		// End feature of resized fields.
		appendTarget.appendChild(input);
		
		$input = $(input);
		var self = this;
		// Clear out the starting space on first focus.  This space is there to prevent field collapsing
		// on new elements in the text editor view
		$input.one('focus', function() {
			if (!self.objectType.attribute && self.editor.options.expandingTextAreas) // No autosize when attribute is set
				$input.autosize();
			if (this.value == " ")
				this.value = "";
		});
	} else if (this.objectType.type == 'date'){
		// Some browsers support the date input type at this point.  If not, it just behaves as text
		input = document.createElement('input');
		input.type = 'date';
		input.id = inputID;
		input.readOnly = !this.editor.options.enableEdit; // Added readonly mode
		input.className = 'xml_date';
		input.value = startingValue? startingValue : "";
		appendTarget.appendChild(input);
		
		$input = $(input);
	} else if (this.objectType.type){
		input = document.createElement('input');
		if (this.objectType.type == 'date') {
			// Some browsers support the date input type.  If not, it should behaves as text
			input.type = 'date';
			input.className = 'xml_date';
		} else if (this.objectType.type == 'dateTime') {
			// May not be supported by browsers yet
			input.type = 'datetime';
			input.className = 'xml_datetime';
		} else {
			// All other types as text for now
			input.type = 'text';
			input.className = 'xml_input';
		}
		input.id = inputID;
		input.readOnly = !this.editor.options.enableEdit; // Added readonly mode
		input.value = startingValue? startingValue : "";
		appendTarget.appendChild(input);
		
		$input = $(input);
	}
	return $input;
};

// Change the editors focus to this xml object
AbstractXMLObject.prototype.focus = function() {
	if (this.domNode != null)
		this.guiEditor.focusObject(this.domNode);
	if (this.textInput)
		this.textInput.focus();
};

AbstractXMLObject.prototype.getDomNode = function () {
	return this.domNode;
};

// Remove this element from the xml document and editor
AbstractXMLObject.prototype.remove = function() {
	// Remove the element from the xml doc
	this.xmlNode.remove();
	
	if (this.domNode != null) {
		this.domNode.remove();
	}
};

// Swap the gui representation of this element to the location of swapTarget
AbstractXMLObject.prototype.swap = function (swapTarget) {
	if (swapTarget == null) {
		return;
	}
	
	// Swap the xml nodes
	swapTarget.xmlNode.detach().insertAfter(this.xmlNode);
	if (swapTarget.domNode != null && this.domNode != null) {
		// Swap the gui nodes
		swapTarget.domNode.detach().insertAfter(this.domNode);
	}
};

// Move this element up one location in the gui.  Returns true if the swap was able to happen
AbstractXMLObject.prototype.moveUp = function() {
	var previousSibling = this.domNode.prev("." + xmlNodeClass);
	if (previousSibling.length > 0) {
		this.swap(previousSibling.data("xmlObject"));
		return true;
	} else {
		return false;
	}
};

// Move this element down one location in the gui.  Returns true if the swap was able to happen
AbstractXMLObject.prototype.moveDown = function() {
	var nextSibling = this.domNode.next("." + xmlNodeClass);
	if (nextSibling.length > 0) {
		nextSibling.data("xmlObject").swap(this);
		return true;
	} else {
		return false;
	}
};

AbstractXMLObject.prototype.select = function() {
	this.domNode.addClass("selected");
};

AbstractXMLObject.prototype.isSelected = function() {
	return this.domNode.hasClass("selected");
};
