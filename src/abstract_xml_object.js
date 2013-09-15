function AbstractXMLObject(editor, objectType) {
	this.editor = editor;
	this.guiEditor = this.editor.guiEditor;
	this.objectType = objectType;
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
	if (this.objectType.values.length > 0){
		var selectionValues = this.objectType.values;
		input = document.createElement('select');
		input.id = inputID;
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
	else if ((this.objectType.element && (this.objectType.type == 'string' || this.objectType.type == 'mixed')) 
			|| this.objectType.attribute){
		input = document.createElement('textarea');
		input.id = inputID;
		input.className = 'xml_textarea';
		// Text areas start out with a space so that the pretty formating won't collapse the field
		input.value = startingValue? startingValue : " ";
		appendTarget.appendChild(input);
		
		$input = $(input);
		var self = this;
		// Clear out the starting space on first focus.  This space is there to prevent field collapsing
		// on new elements in the text editor view
		$input.one('focus', function() {
			if (!self.objectType.attribute && self.editor.options.expandingTextAreas)
				$input.autosize();
			if (this.value == " ")
				this.value = "";
		});
	} else if (this.objectType.type == 'date'){
		// Some browsers support the date input type at this point.  If not, it just behaves as text
		input = document.createElement('input');
		input.type = 'date';
		input.id = inputID;
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
		input.value = startingValue? startingValue : "";
		appendTarget.appendChild(input);
		
		$input = $(input);
	}
	return $input;
};

// Change the editors focus to this xml object
AbstractXMLObject.prototype.focus = function() {
	if (this.getDomNode() != null)
		this.guiEditor.focusObject(this.getDomNode());
};

AbstractXMLObject.prototype.getDomNode = function () {
	return this.domNode;
};
