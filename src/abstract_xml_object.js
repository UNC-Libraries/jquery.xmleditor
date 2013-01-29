function AbstractXMLObject(editor, objectType) {
	this.editor = editor;
	this.guiEditor = this.editor.guiEditor;
	this.objectType = objectType;
}

AbstractXMLObject.prototype.createElementInput = function (inputID, startingValue, appendTarget){
	var input = null;
	if (this.objectType.values.length > 0){
		var selectionValues = this.objectType.values;
		input = $('<select />').attr({
			'id' : inputID
		}).appendTo(appendTarget);

		$.each(selectionValues, function() {
			$('<option />', {
				value : this,
				text : this.toString(),
				selected : (startingValue == this)
			}).appendTo(input);
		});
	} else if ((this.objectType.element && (this.objectType.type == 'string' || this.objectType.type == 'mixed')) 
			|| this.objectType.attribute){
		input = $('<textarea/>').attr({
			'id' : inputID,
			'value' : startingValue
		}).appendTo(appendTarget).one('focus', function() {
			if ($(this).val() == " ") {
				$(this).val("");
			}
		});
		if (!this.objectType.attribute)
			input.expandingTextarea();
	} else if (this.objectType.type == 'ID' || this.objectType.type == 'date' || this.objectType.type == 'anyURI' ){
		input = $('<input/>').attr({
			'id' : inputID,
			'type' : 'text',
			'value' : startingValue
		}).appendTo(appendTarget).one('focus', function() {
			if ($(this).val() == " ") {
				$(this).val("");
			}
		});
	}
	return input;
};

AbstractXMLObject.prototype.focus = function() {
	if (this.getDomElement() != null)
		this.guiEditor.focusObject(this.getDomElement());
};

AbstractXMLObject.prototype.getDomElement = function () {
	return null;
};
