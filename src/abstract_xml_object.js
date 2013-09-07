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
	} // Until there is better browser support for inputs like date and datetime, treat definitions with types as text
	else if (this.objectType.type){
		input = document.createElement('input');
		input.type = 'text';
		input.id = inputID;
		input.className = 'xml_input';
		input.value = startingValue? startingValue : "";
		appendTarget.appendChild(input);
		
		$input = $(input);
	}
	return $input;
};

// Change the editors focus to this xml object
AbstractXMLObject.prototype.focus = function() {
	if (this.getDomElement() != null)
		this.guiEditor.focusObject(this.getDomElement());
};

AbstractXMLObject.prototype.getDomElement = function () {
	return null;
};
