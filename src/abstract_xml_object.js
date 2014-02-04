function AbstractXMLObject(editor, objectType) {
	this.editor = editor;
	this.guiEditor = this.editor.guiEditor;
	this.objectType = objectType;
}

AbstractXMLObject.prototype.createElementInput = function (inputID, startingValue, appendTarget){
	if (startingValue === undefined)
		startingValue = "";
	var input = null;
	var $input = null;
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
	} else if ((this.objectType.element && (this.objectType.type == 'string' || this.objectType.type == 'mixed')) 
			|| this.objectType.attribute){
		input = document.createElement('textarea');
		input.id = inputID;
		input.className = 'xml_textarea';
		input.value = startingValue;
		appendTarget.appendChild(input);
		
		$input = $(input);
		var self = this;
		$input.one('focus', function() {
			if (!self.objectType.attribute && self.editor.options.expandingTextAreas)
				$input.autosize();
			if (this.value == " ")
				this.value = "";
		});
	} else if (this.objectType.type){
		input = document.createElement('input');
		input.type = 'text';
		input.id = inputID;
		input.className = 'xml_input';
		input.value = startingValue;
		appendTarget.appendChild(input);
		
		$input = $(input);
		$input.one('focus', function() {
			if (this.value == " ")
				this.value = "";
		});
	}
	return $input;
};

AbstractXMLObject.prototype.focus = function() {
	if (this.getDomElement() != null)
		this.guiEditor.focusObject(this.getDomElement());
};

AbstractXMLObject.prototype.getDomElement = function () {
	return null;
};
